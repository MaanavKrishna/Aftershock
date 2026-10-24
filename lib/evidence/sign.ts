import { createHash, createPrivateKey, createPublicKey, hkdfSync, sign, verify, type KeyObject } from "node:crypto";
import { canonicalize } from "./jcs";

type Env = Record<string, string | undefined>;
export type Jwk = { kty: "OKP"; crv: "Ed25519"; x: string; kid: string; alg: "EdDSA"; use: "sig" };
export type SignedBundle<T = unknown> = { payload: T; signature: { alg: "EdDSA"; kid: string; canonicalization: "RFC8785"; value: string } };

const PKCS8_ED25519 = Buffer.from("302e020100300506032b657004220420", "hex");

/**
 * The evidence signing key: AFTERSHOCK_EVIDENCE_KEY (a base64 32-byte seed or a PKCS8 PEM) when set,
 * otherwise derived from AUTH_SECRET with HKDF so every deployment can sign without extra setup.
 */
export function evidenceKey(env: Env = process.env): { kid: string; privateKey: KeyObject; jwk: Jwk } {
  const explicit = env.AFTERSHOCK_EVIDENCE_KEY?.trim();
  let privateKey: KeyObject;
  if (explicit?.includes("BEGIN")) privateKey = createPrivateKey(explicit);
  else {
    const seed = explicit ? Buffer.from(explicit, "base64") : env.AUTH_SECRET ? Buffer.from(hkdfSync("sha256", env.AUTH_SECRET, "aftershock", "evidence-signing-v1", 32)) : null;
    if (!seed || seed.length !== 32) throw new Error("Set AUTH_SECRET or AFTERSHOCK_EVIDENCE_KEY (32-byte base64 seed) to sign evidence");
    privateKey = createPrivateKey({ key: Buffer.concat([PKCS8_ED25519, seed]), format: "der", type: "pkcs8" });
  }
  const pub = createPublicKey(privateKey).export({ format: "jwk" }) as { x: string };
  const kid = `as-${createHash("sha256").update(pub.x).digest("hex").slice(0, 16)}`;
  return { kid, privateKey, jwk: { kty: "OKP", crv: "Ed25519", x: pub.x, kid, alg: "EdDSA", use: "sig" } };
}

/** Current key first, then retired public keys (AFTERSHOCK_EVIDENCE_PREVIOUS_JWKS, a JSON array) so old bundles still verify. */
export function jwks(env: Env = process.env): { keys: Jwk[] } {
  const current = evidenceKey(env).jwk;
  let previous: Jwk[] = [];
  try {
    previous = (JSON.parse(env.AFTERSHOCK_EVIDENCE_PREVIOUS_JWKS ?? "[]") as Jwk[]).filter((k) => k && k.kty === "OKP" && k.crv === "Ed25519" && typeof k.x === "string" && k.kid !== current.kid);
  } catch {
    previous = [];
  }
  return { keys: [current, ...previous.map(({ kty, crv, x, kid }) => ({ kty, crv, x, kid, alg: "EdDSA" as const, use: "sig" as const }))] };
}

export function signBundle<T>(payload: T, env: Env = process.env): SignedBundle<T> {
  const k = evidenceKey(env);
  const value = sign(null, Buffer.from(canonicalize(payload)), k.privateKey).toString("base64url");
  return { payload, signature: { alg: "EdDSA", kid: k.kid, canonicalization: "RFC8785", value } };
}

export function verifyBundle(bundle: SignedBundle, set: { keys: Jwk[] }): boolean {
  const jwk = set.keys.find((k) => k.kid === bundle.signature?.kid);
  if (!jwk || bundle.signature.alg !== "EdDSA") return false;
  try {
    const pub = createPublicKey({ key: { kty: jwk.kty, crv: jwk.crv, x: jwk.x }, format: "jwk" });
    return verify(null, Buffer.from(canonicalize(bundle.payload)), pub, Buffer.from(bundle.signature.value, "base64url"));
  } catch {
    return false;
  }
}
