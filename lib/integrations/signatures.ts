import { createHmac, timingSafeEqual } from "node:crypto";

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
