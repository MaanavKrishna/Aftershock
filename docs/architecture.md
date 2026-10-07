# Architecture

One Next.js 16 (App Router) application. Pure decision logic is separated from I/O so the rules that matter — what counts as proven, what counts as a recurrence — are small, readable and unit-tested.

```
                ┌──────────── Next.js app (Vercel) ────────────┐
 GitHub ──────► │ /api/webhooks/github   ─┐                    │
 Sentry ──────► │ /api/webhooks/sentry    ├─► lib/workflows ───┼──► Runner (Vercel Sandbox / Docker)
 PagerDuty ───► │ /api/webhooks/pagerduty ┘     │              │        one VM per run, no secrets
 CLI / CI ────► │ /api/v1/*                     ▼              │
 Browser ─────► │ app/(app) pages ──► lib/db ──► Postgres      │──► Model (Muse / AI Gateway / custom)
                └──────────────────────────────────────────────┘
```

## Flows

**Time travel** (`lib/workflows/timeTravel.ts`)
1. Resolve the fix commit and its parent (`lib/git/source.ts`: the GitHub REST API for GitHub repositories, the git CLI for local paths). A root commit or unknown SHA leaves the incident in *Awaiting fix* with a reason.
2. Read context: the fix diff, the changed files at the parent, test setup files, the nearest tests.
3. Draft a test (`lib/model/draft.ts`). Output is validated: one file, under the test folder, the right framework, a real test, balanced code.
4. Run it three times on the parent. Anything but three failures stops here: passing means *rejected* and feeds back into the next draft; errors mean *unproven* and end the run.
5. Run it three times on the fix. `lib/domain/admission.ts` decides.
6. On *proven*: store the memory test, open a bot PR, then start Epicenter and the retro-check.

**Pull request check** (`lib/workflows/prCheck.ts`)
1. Select memory tests: every test whose watched files the PR changes, plus any the model triage adds (`lib/domain/relevance.ts`).
2. Pick the runner (`lib/runner/select.ts`): sandbox, the team's GitHub Actions, or *unavailable* when the sandbox allowance is spent.
3. Run each test three times on the head commit; `lib/domain/verdict.ts` decides per test and overall.
4. Update the GitHub check run and the single PR comment.

**Epicenter** (`lib/workflows/epicenter.ts`) gallops back through first-parent history until the test passes, then binary-searches the boundary (`lib/domain/epicenter.ts`, capped at 12 runs).

**Nightly** (`lib/workflows/nightly.ts`) runs each memory test once on the default branch and keeps 14 nights of health.

Each workflow is a deterministic `"use workflow"` function calling `"use step"` functions. On Vercel the Workflow SDK makes them durable; locally and in tests the same code runs in-process (`lib/workflows/start.ts`).

## Code layout

```
app/(site)/            public site: home, pricing, security, docs, sign in
app/(app)/             product: overview, incidents, time travel, memory, pull requests,
                       repositories, integrations, settings, onboarding; server actions
app/api/auth/          GitHub OAuth, demo sign-in, workspace switch, sign out
app/api/webhooks/      GitHub, Sentry, PagerDuty (signature-verified, rate-limited)
app/api/v1/            HTTP API (token or session)
app/api/cron/          nightly re-check
components/ui/         Pill, Card, Button, Field, Strip, Logo
components/app/        sidebar, top bar, shared rows
components/site/       marketing header/footer, hero, pricing
lib/domain/            verdicts, admission, relevance, fault lines, epicenter, lessons, ids
lib/db/                Drizzle schema, client (Neon or PGlite), workspace-scoped queries, demo seed
lib/auth/              sessions (jose), GitHub OAuth, roles, API tokens
lib/runner/            Runner interface; Docker and Vercel Sandbox; JUnit parsing; framework adapters
lib/git/               commit resolution, file reads and history via the GitHub API or git CLI
lib/model/             provider config, fencing of untrusted text, prompts, validation, drafting, triage
lib/github/            App client, REST calls, webhook routing, comments, bot PRs, suggestions
lib/integrations/      Sentry / PagerDuty signatures and intake
lib/workflows/         time travel, PR check, suggested fix, epicenter, retro-check, nightly
lib/http/              absolute URLs, rate limiting
cli/                   aftershock CLI (bundled with esbuild)
drizzle/               SQL migrations
tests/unit, tests/integration, e2e/
```

## Security model

- **Isolation**: every run is a fresh microVM (or container locally). Dependencies install with network; the network is cut before tests run. No secrets enter a run.
- **Least privilege**: runners clone with read-only, single-repository tokens. The app writes only `aftershock/*` branches.
- **Untrusted input**: incident text, postmortems, code and diffs reach the model inside random-nonce fences; model output is validated and only ever written to the test path.
- **Tenancy**: every query goes through `scoped(workspaceId)`; API tokens are stored as SHA-256 hashes; model keys and webhook secrets are encrypted with AES-256-GCM.
- **Webhooks**: HMAC signatures are verified in constant time before anything is parsed or stored.
- **Abuse**: per-caller rate limits on webhook and API routes; custom model endpoints must be public `https://` hosts.
