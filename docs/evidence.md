# Audit evidence

Frameworks such as SOC 2 (CC7.4, CC8.1) and the EU's DORA (Article 13) ask for evidence that incidents lead to lasting controls. Aftershock produces that evidence as a by-product: every incident has a signed record of how it was proven and what it has guarded since.

## Getting a bundle

- **In the app:** open an incident → **Evidence**. The page is printable; **Download signed JSON** gives the verifiable copy.
- **API:** `GET /api/v1/incidents/<number>/evidence` with any API token (read-only is enough).

```bash
curl -H "Authorization: Bearer $AFTERSHOCK_TOKEN" https://aftershock-mk.vercel.app/api/v1/incidents/3/evidence -o INC-3.json
```

## What's in it

`payload` (schema `aftershock.evidence/v1`):

| Field | Contents |
|---|---|
| `incident` | Key, title, severity, source, status, what was observed and expected, when it opened |
| `fix` | Fix commit, the commit before it, the pull request |
| `proof[]` | Each time-travel attempt: outcomes on the commit before the fix and on the fix, the runner, SHA-256 of the test code and of the run log |
| `memoryTest` | The admitted test (path and SHA-256), nightly health, quarantine state, the last still-guarding re-proof |
| `guard[]` | Every pull request and merge-queue entry the test ran on: the commit tested, the verdict, overrides with their reasons |
| `epicenter` | The commit that introduced the bug, if found |

Run logs are kept for 30 days. Older bundles still carry the log's hash (`logSha256` is null once the log is gone, and `logRetained` says so). Hashes from an earlier download stay comparable.

## Verifying

`signature` holds an Ed25519 signature (`alg: EdDSA`) over the [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) canonical form of `payload`, and the `kid` of the key used. Public keys are at `/.well-known/aftershock-jwks.json`; retired keys stay listed so old bundles keep verifying.

```js
// node verify.mjs INC-3.json
import { readFileSync } from "node:fs";
import { createPublicKey, verify } from "node:crypto";
import canonicalize from "canonicalize"; // any RFC 8785 implementation

const bundle = JSON.parse(readFileSync(process.argv[2], "utf8"));
const { keys } = await (await fetch("https://aftershock-mk.vercel.app/.well-known/aftershock-jwks.json")).json();
const jwk = keys.find((k) => k.kid === bundle.signature.kid);
const ok = verify(null, Buffer.from(canonicalize(bundle.payload)), createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(bundle.signature.value, "base64url"));
console.log(ok ? "valid" : "INVALID");
```

## Keys (self-hosting)

By default the signing key is derived from `AUTH_SECRET`, so signing works with no extra setup. To manage the key separately, set `AFTERSHOCK_EVIDENCE_KEY` to a base64 32-byte seed (`openssl rand -base64 32`) or an Ed25519 PKCS8 PEM. When you rotate it, put the old public key (from the JWKS before the change) in `AFTERSHOCK_EVIDENCE_PREVIOUS_JWKS` as a JSON array, so bundles signed earlier still verify.
