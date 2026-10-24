import { describe, test, expect } from "vitest";
import { createHmac } from "node:crypto";
import { newStandardSecret, signStandardWebhook, verifyLinear, verifyStandardWebhook, verifyToken } from "@/lib/integrations/signatures";

const NOW = 1_790_000_000_000;

describe("Standard Webhooks (incident.io, generic)", () => {
  const secret = "whsec_" + Buffer.from("a-very-secret-key-for-tests").toString("base64");
  const body = '{"event_type":"x"}';
  const ts = String(Math.floor(NOW / 1000));
  const sig = signStandardWebhook("msg_1", ts, body, secret);

  test("a correct signature inside the window verifies", () => {
    expect(sig).toMatch(/^v1,[A-Za-z0-9+/=]+$/);
    expect(verifyStandardWebhook(body, { id: "msg_1", timestamp: ts, signature: sig }, secret, NOW)).toBe(true);
  });
  test("one matching signature among several (secret rotation) verifies", () => {
    expect(verifyStandardWebhook(body, { id: "msg_1", timestamp: ts, signature: `v1,AAAA ${sig}` }, secret, NOW)).toBe(true);
  });
  test("the signature is checked against the id, the timestamp and the body", () => {
    expect(verifyStandardWebhook(body + " ", { id: "msg_1", timestamp: ts, signature: sig }, secret, NOW)).toBe(false);
    expect(verifyStandardWebhook(body, { id: "msg_2", timestamp: ts, signature: sig }, secret, NOW)).toBe(false);
    expect(verifyStandardWebhook(body, { id: "msg_1", timestamp: ts, signature: sig }, "whsec_" + Buffer.from("other").toString("base64"), NOW)).toBe(false);
  });
  test("deliveries older or newer than five minutes are refused, even when correctly signed", () => {
    const old = String(Math.floor(NOW / 1000) - 301);
    expect(verifyStandardWebhook(body, { id: "msg_1", timestamp: old, signature: signStandardWebhook("msg_1", old, body, secret) }, secret, NOW)).toBe(false);
    const future = String(Math.floor(NOW / 1000) + 301);
    expect(verifyStandardWebhook(body, { id: "msg_1", timestamp: future, signature: signStandardWebhook("msg_1", future, body, secret) }, secret, NOW)).toBe(false);
  });
  test("missing headers or secret never verify", () => {
    expect(verifyStandardWebhook(body, { id: null, timestamp: ts, signature: sig }, secret, NOW)).toBe(false);
    expect(verifyStandardWebhook(body, { id: "msg_1", timestamp: "soon", signature: sig }, secret, NOW)).toBe(false);
    expect(verifyStandardWebhook(body, { id: "msg_1", timestamp: ts, signature: sig }, "", NOW)).toBe(false);
  });
  test("a secret pasted without the whsec_ prefix still works", () => {
    expect(verifyStandardWebhook(body, { id: "msg_1", timestamp: ts, signature: sig }, secret.slice(6), NOW)).toBe(true);
  });
  test("new secrets use the whsec_ format with 24 random bytes", () => {
    const a = newStandardSecret();
    expect(a).toMatch(/^whsec_[A-Za-z0-9+/=]{32}$/);
    expect(newStandardSecret()).not.toBe(a);
  });
});

describe("Linear", () => {
  const secret = "lin_wh_secret";
  const body = JSON.stringify({ type: "Issue", action: "create", webhookTimestamp: NOW - 10_000 });
  const hex = createHmac("sha256", secret).update(body).digest("hex");
  test("a hex HMAC of the raw body inside the window verifies", () => {
    expect(verifyLinear(body, hex, secret, NOW)).toBe(true);
  });
  test("a wrong signature or an old webhookTimestamp is refused", () => {
    expect(verifyLinear(body, hex.replace(/.$/, "0"), secret, NOW)).toBe(false);
    const stale = JSON.stringify({ type: "Issue", webhookTimestamp: NOW - 301_000 });
    expect(verifyLinear(stale, createHmac("sha256", secret).update(stale).digest("hex"), secret, NOW)).toBe(false);
    const none = JSON.stringify({ type: "Issue" });
    expect(verifyLinear(none, createHmac("sha256", secret).update(none).digest("hex"), secret, NOW)).toBe(false);
    expect(verifyLinear("not json", createHmac("sha256", secret).update("not json").digest("hex"), secret, NOW)).toBe(false);
  });
});

describe("token auth (Opsgenie, Datadog, Rootly, Jira)", () => {
  test("only the exact token matches", () => {
    expect(verifyToken("tok_abc", "tok_abc")).toBe(true);
    expect(verifyToken("tok_abd", "tok_abc")).toBe(false);
    expect(verifyToken("tok_ab", "tok_abc")).toBe(false);
    expect(verifyToken("", "")).toBe(false);
    expect(verifyToken(null, "tok_abc")).toBe(false);
  });
});
