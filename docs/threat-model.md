# Threat model

What Aftershock protects, from whom, and how. Every release is reviewed against the checklist at the end.

## Assets

| Asset | Where it lives | Why it matters |
|---|---|---|
| Customer source code | GitHub; copied into a sandbox for one run | Confidentiality of the customer's product |
| GitHub App private key, webhook secret | Vercel environment | Full access to every installation |
| Installation tokens | Minted per run, one hour, `contents: read`, one repository | Read access to one repository |
| Session secret, encryption key | Vercel environment | Forging sessions, decrypting stored secrets |
| Model keys, integration signing secrets | Postgres, AES-256-GCM encrypted | Spending the customer's model budget; forging alerts |
| API tokens | Postgres, SHA-256 hash only | Workspace-wide API access |
| Incidents, proofs, evidence | Postgres | Integrity of the record auditors rely on |
| Sandbox minutes | Vercel account | Cost and availability |

## Actors

- **Workspace members**: authenticated through GitHub; roles owner, admin, member.
- **Other tenants**: authenticated users of a different workspace.
- **Anonymous internet**: hits public pages, webhooks, badge, MCP and API endpoints.
- **Untrusted content authors**: anyone who can write an issue, alert, postmortem, PR description, code comment or commit message that Aftershock reads. This includes prompt-injection attempts against the model.
- **Untrusted code**: the customer's repository and its dependencies, plus the model's draft. All of it executes during runs.

## Trust boundaries and controls

1. **Internet → webhooks** (`/api/webhooks/*`)
   - HMAC signatures (or, for sources without a signing scheme, a per-workspace token) are verified in constant time before parsing.
   - Per-source rate limits.
   - A payload size cap and a ±5 minute replay window wherever the source sends a timestamp.
   - Incidents are deduplicated by source fingerprint.
2. **Internet → API, MCP and badge**
   - API tokens are compared by hash; sessions are HS256 JWTs.
   - Per-caller rate limits.
   - Tokens carry scopes (`read`, `write`).
   - The badge answers 404 for private or unknown repositories, so it can't be used to find out whether a repository exists.
3. **Tenant ↔ tenant**
   - Every query goes through `scoped(workspaceId)`.
   - Resource ids from the client are always re-checked against the session's workspace.
4. **App → model**
   - Untrusted text is wrapped in random-nonce fences (`lib/model/fence.ts`).
   - Model output is parsed as JSON and validated: one file, inside the allowed path, of the right framework, defining a test, with balanced brackets.
   - A model never decides anything is proven or safe; only test runs do.
   - Custom model endpoints must be public `https://` hosts (no private, loopback or link-local addresses).
5. **App → runner (untrusted code)**
   - One fresh microVM (Vercel Sandbox) or container (Docker) per run.
   - The network is allowed only while dependencies install, then set to deny-all before any test runs. A test fails the build if the network is still open after a snapshot is restored.
   - No secrets enter a run. The clone token is read-only, scoped to one repository, and not left in the working tree.
   - Run time and output size are capped. Paths written into the run are checked by `safeTestPath`.
6. **App → GitHub**
   - Writes go only to `aftershock/*` branches, check runs and comments; nothing is ever pushed to a default branch.
   - Clone tokens are minted with the minimum permission.
7. **App → outbound webhooks and Slack**
   - URLs are resolved before connecting, and private, loopback, link-local and metadata addresses are refused (SSRF guard).
   - Bodies are signed with Standard Webhooks (HMAC-SHA256 over id, timestamp and body).
   - Retries use back-off; a target that keeps failing is disabled automatically.
8. **Operators**
   - Kill switch `AFTERSHOCK_RUNS_DISABLED`.
   - Secrets are redacted from structured logs.
   - Migrations run only on production builds and are backward-compatible, so rollback stays safe.

## Threats and mitigations

| Threat | Mitigation | Status |
|---|---|---|
| Forged webhook creates incidents or starts runs (cost) | Signatures or tokens, rate limits, ±5 minute replay window on signed timestamps, 256 KiB cap, dedupe, one 404 for unknown or disabled sources | Shipped (milestone 8) |
| Leaked intake token (token sources) | Header delivery preferred over `?token=`; rotate from Integrations; tokens are encrypted and shown once | Shipped (milestone 8) |
| Prompt injection in issue or alert text steers the model to exfiltrate data | Fencing, no tools for the model, output validation, sandbox without network or secrets | Shipped |
| Draft test reads environment secrets | No secrets in the sandbox; network denied | Shipped |
| Malicious repository code escapes its run | Firecracker microVM isolation; network denied during tests; no shared state between runs | Shipped; shared dependency caches are per-repository and read-only during tests (milestone 4) |
| Install cache poisoning: a pull request's install scripts tamper with a cached environment that later runs reuse | Snapshots are only saved from trusted default-branch commits; pull requests may restore only an identical-lockfile snapshot and never save; keys are per repository; network denied after every restore | Milestone 4 |
| Cross-tenant data access | `scoped()` everywhere; integration tests for isolation | Shipped |
| Stolen API token | Hash-only storage, revocation, last-used time, scopes | Scopes in milestone 11 |
| SSRF via custom model URL or outbound webhook | Public-https check; connect-time DNS check that refuses private, loopback, link-local and metadata answers; no redirects; Slack targets pinned to hooks.slack.com | Shipped (webhooks in milestone 9) |
| Notification flood or stuck retries | Outbox with claim-once delivery, 5 attempts with back-off, auto-disable after 10 consecutive failures, 30-day retention | Shipped (milestone 9) |
| Badge or showcase leaks private data | Public repositories only, 404 otherwise; showcase reads only the public sample workspace | Milestones 11 and 14 |
| Tampered evidence | Ed25519 signatures over canonical JSON, with a JWKS endpoint that lists rotated keys | Milestone 11 |
| Runaway cost from runs | Plan quotas, kill switch, per-source rate limits, metering of every run | Kill switch shipped; metering in milestone 6 |
| Account deletion leaves data behind | Cascading deletes, snapshot removal, 30-day uninstall purge, audit log | Milestone 5 |
| Supply-chain vulnerability in dependencies | `npm audit` in CI, pinned versions, overrides for patched transitive packages | Shipped |

## Release security checklist

For every milestone:

- [ ] New endpoints: authentication, `scoped()` tenancy, rate limit, size limits, and input validation with zod or explicit checks.
- [ ] New outbound calls: SSRF guard, timeouts, no secrets in URLs or logs.
- [ ] New stored secrets: encrypted with `lib/crypto.ts`, never returned after creation.
- [ ] New untrusted text reaching a model: fenced, with output validated.
- [ ] New run types: network denied during tests, no secrets, metered, covered by the kill switch.
- [ ] Migrations: additive and backward-compatible.
- [ ] `npm audit` reports 0 vulnerabilities; tests cover the abuse case, not only the happy path.
