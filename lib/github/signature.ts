import { createHmac, timingSafeEqual } from "node:crypto";

/** X-Hub-Signature-256: "sha256=" + HMAC-SHA256(body, secret), compared in constant time. */
export function verifyGithubSignature(body: string, header: string | null, secret: string): boolean {
  if (!secret || !header || !header.startsWith("sha256=")) return false;
  const expected = Buffer.from("sha256=" + createHmac("sha256", secret).update(body).digest("hex"));
  const got = Buffer.from(header);
  return got.length === expected.length && timingSafeEqual(got, expected);
}
