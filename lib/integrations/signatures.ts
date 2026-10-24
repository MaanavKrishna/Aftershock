import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Deliveries signed with a timestamp are accepted for five minutes either side of now. */
export const REPLAY_WINDOW_MS = 5 * 60_000;

const eqHex = (a: string, b: string) => {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Sentry: sentry-hook-signature = hex HMAC-SHA256 of the raw body with the client secret. */
export function verifySentry(body: string, header: string | null, secret: string): boolean {
  if (!header || !secret) return false;
  return eqHex(header.trim(), createHmac("sha256", secret).update(body).digest("hex"));
}

/** PagerDuty v3: X-PagerDuty-Signature = "v1=<hex>[,v1=<hex>]" (several during secret rotation). */
export function verifyPagerDuty(body: string, header: string | null, secret: string): boolean {
  if (!header || !secret) return false;
  const expected = "v1=" + createHmac("sha256", secret).update(body).digest("hex");
  return header.split(",").map((p) => p.trim()).some((p) => eqHex(p, expected));
}

const standardKey = (secret: string) => Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");

/** A Standard Webhooks secret: "whsec_" plus 24 random bytes in base64. */
export function newStandardSecret(): string {
  return "whsec_" + randomBytes(24).toString("base64");
}

/** Standard Webhooks signature header value for one message. */
export function signStandardWebhook(id: string, timestamp: string, body: string, secret: string): string {
  return "v1," + createHmac("sha256", standardKey(secret)).update(`${id}.${timestamp}.${body}`).digest("base64");
}

/**
 * Standard Webhooks (incident.io, the generic endpoint): HMAC-SHA256 over "id.timestamp.body" with the
 * base64-decoded secret; the header lists one or more "v1,<base64>" signatures separated by spaces.
 */
export function verifyStandardWebhook(body: string, h: { id: string | null; timestamp: string | null; signature: string | null }, secret: string, now = Date.now()): boolean {
  if (!h.id || !h.timestamp || !h.signature || !secret) return false;
  if (!/^\d{1,12}$/.test(h.timestamp) || Math.abs(now - Number(h.timestamp) * 1000) > REPLAY_WINDOW_MS) return false;
  const expected = signStandardWebhook(h.id, h.timestamp, body, secret);
  return h.signature.split(" ").map((p) => p.trim()).some((p) => eqHex(p, expected));
}

/** Linear: Linear-Signature = hex HMAC-SHA256 of the raw body; webhookTimestamp (ms) in the body must be recent. */
export function verifyLinear(body: string, header: string | null, secret: string, now = Date.now()): boolean {
  if (!header || !secret) return false;
  if (!eqHex(header.trim(), createHmac("sha256", secret).update(body).digest("hex"))) return false;
  try {
    const ts = (JSON.parse(body) as { webhookTimestamp?: unknown }).webhookTimestamp;
    return typeof ts === "number" && Math.abs(now - ts) <= REPLAY_WINDOW_MS;
  } catch {
    return false;
  }
}

/** Shared-token auth for sources without a documented signing scheme. Hashing first keeps the compare constant-time. */
export function verifyToken(provided: string | null, secret: string): boolean {
  if (!provided || !secret) return false;
  const h = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(h(provided), h(secret));
}
