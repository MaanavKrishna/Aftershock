import { describe, test, expect } from "vitest";
import { createPublicKey, verify } from "node:crypto";
import { canonicalize } from "@/lib/evidence/jcs";
import { evidenceKey, jwks, signBundle, verifyBundle } from "@/lib/evidence/sign";

const env = { AUTH_SECRET: "test-auth-secret-0123456789abcdef0123456789" };

describe("canonicalize (RFC 8785 JCS)", () => {
  test("sorts keys at every level, drops undefined, keeps arrays in order", () => {
    expect(canonicalize({ b: 1, a: { d: [3, 1], c: "x" }, u: undefined })).toBe('{"a":{"c":"x","d":[3,1]},"b":1}');
  });
  test("numbers and strings serialise like ECMAScript", () => {
    expect(canonicalize([1e21, 0.1, -0, "é\n", true, null])).toBe('[1e+21,0.1,0,"é\\n",true,null]');
  });
  test("refuses values JSON cannot represent", () => {
    expect(() => canonicalize({ x: Number.NaN })).toThrow();
    expect(() => canonicalize({ d: new Date() })).toThrow();
  });
});

describe("evidence signing", () => {
  test("the key is stable for the same secret and has a kid", () => {
    const a = evidenceKey(env);
    expect(a.kid).toMatch(/^as-[0-9a-f]{16}$/);
    expect(evidenceKey(env).kid).toBe(a.kid);
    expect(evidenceKey({ AUTH_SECRET: "another-secret-another-secret-xx" }).kid).not.toBe(a.kid);
  });
  test("a signed bundle verifies against the published JWKS, with any standard Ed25519 verifier", () => {
    const payload = { schema: "aftershock.evidence/v1", incident: { key: "INC-3" }, issuedAt: "2026-10-24T00:00:00.000Z" };
    const bundle = signBundle(payload, env);
    expect(bundle.signature).toMatchObject({ alg: "EdDSA", kid: evidenceKey(env).kid, canonicalization: "RFC8785" });
    const keys = jwks(env);
    expect(verifyBundle(bundle, keys)).toBe(true);
    const jwk = keys.keys.find((k) => k.kid === bundle.signature.kid)!;
    const pub = createPublicKey({ key: jwk as never, format: "jwk" });
    expect(verify(null, Buffer.from(canonicalize(bundle.payload)), pub, Buffer.from(bundle.signature.value, "base64url"))).toBe(true);
  });
  test("any change to the payload breaks the signature", () => {
    const bundle = signBundle({ verdict: "proven" }, env);
    expect(verifyBundle({ ...bundle, payload: { verdict: "unproven" } }, jwks(env))).toBe(false);
    expect(verifyBundle({ ...bundle, signature: { ...bundle.signature, kid: "as-unknown" } }, jwks(env))).toBe(false);
  });
  test("an explicit key wins, and previous public keys stay published for old bundles", () => {
    const old = signBundle({ n: 1 }, env);
    const prev = JSON.stringify(jwks(env).keys);
    const rotated = { AUTH_SECRET: env.AUTH_SECRET, AFTERSHOCK_EVIDENCE_KEY: Buffer.alloc(32, 7).toString("base64"), AFTERSHOCK_EVIDENCE_PREVIOUS_JWKS: prev };
    expect(evidenceKey(rotated).kid).not.toBe(evidenceKey(env).kid);
    expect(jwks(rotated).keys).toHaveLength(2);
    expect(verifyBundle(old, jwks(rotated))).toBe(true);
    expect(jwks(rotated).keys.every((k) => !("d" in k))).toBe(true);
  });
});
