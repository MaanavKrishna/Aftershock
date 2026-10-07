# Aftershock

Aftershock turns a production incident into a regression test that **git history proves** — the test must fail on the commit before the fix and pass on the fix, three times each — then guards every pull request against that incident coming back.

```
incident ──► model drafts a test ──► time travel: fails before fix ✕✕✕ / passes on fix ✓✓✓ ──► memory ──► every PR checked
```

- **Capture** from a labelled GitHub issue, a pasted postmortem, a form, or a Sentry / PagerDuty alert (alerts wait in *Awaiting fix* until a PR that mentions the incident merges).
- **Time travel** runs the draft in an isolated runner on the parent and fix commits. Rejected drafts are redrafted with the failure as feedback (up to 3).
- **Memory**: proven tests land in your repo via a bot PR, re-run nightly on the default branch (Healthy / Flaky / Failing on main), and export as `LESSONS.md` for coding agents.
- **Guard**: each PR runs only the relevant memory tests (file overlap + model triage that can only add), posts one check and one comment: *Recur*, *Safe*, *Inconclusive* or *Skipped*.
- **Epicenter** bisects history with the proven test to find the commit and PR that introduced the bug. **Retro-check** runs a newly proven test against every open PR.
- **Suggested fix** on a Recur check, posted only if it passes every memory test for the repository.

Rules that never bend: a model never marks anything proven or safe; a test that passes before the fix is rejected; mixed results are never green; nothing is pushed to a default branch; sandboxed runs get no secrets.

Spec: `docs/superpowers/specs/2026-10-07-aftershock-design.md` · Plan: `docs/superpowers/plans/2026-10-08-aftershock.md` · Design: `design/*.dc.html`

## Run it locally (no accounts needed)

Requirements: Node 22+, Docker (Docker Desktop or Colima) for real time travel.

```bash
npm install
cp .env.example .env.local   # set AUTH_SECRET to any 32+ characters
npm run dev
```

Open http://127.0.0.1:3000, choose **Sign in → Try the demo workspace**. The demo workspace is seeded with incidents, proven tests and PR checks. Data lives in embedded Postgres (PGlite) under `./data`.

Time travel runs locally in Docker (`~/.cache/aftershock/runs`). To draft tests you need a model: set `MODEL_API_KEY` (Muse, default) or configure Vercel AI Gateway / any OpenAI-compatible endpoint in **Integrations**.

## Connect real repositories

1. **GitHub OAuth app** (sign-in): callback URL `APP_URL/api/auth/callback`. Set `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`.
2. **GitHub App** (repositories):
   - Permissions: Contents *read*, Issues *read*, Metadata *read*, Checks *read & write*, Pull requests *read & write*. For bot PRs that add tests, Contents must be *read & write* (Aftershock only writes to `aftershock/*` branches).
   - Events: Installation, Installation repositories, Issues, Pull request, Check run.
   - Webhook URL `APP_URL/api/webhooks/github`, secret → `GITHUB_WEBHOOK_SECRET`. Setup URL `APP_URL/onboarding`.
   - Set `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY`.
3. **Database**: create a Neon database (Vercel Marketplace), set `DATABASE_URL`, run `npm run db:migrate`.
4. **Deploy to Vercel**: link the project, add the env vars. On Vercel, time travel runs in **Vercel Sandbox** and workflows run durably with the **Workflow SDK**. `vercel.json` schedules the nightly re-check (set `CRON_SECRET`).
5. **Alerts**: in Integrations, generate a signing secret for Sentry or PagerDuty, paste the webhook URL into the provider, map projects/services to repositories, and send a test delivery.

## Command line

```bash
npm run build:cli
npx aftershock prove --fix <sha> --test tests/aftershock/test_x.py   # prove your own test locally in Docker
npx aftershock check                                                 # run every memory test at HEAD
npx aftershock check --in-place --pr 214 --report                    # in your CI; reports to Aftershock
npx aftershock verify INC-12                                         # start a hosted time travel
```

Exit codes: `0` safe/proven, `1` recur, `2` inconclusive/unproven. `--report` and `verify` need `AFTERSHOCK_URL` and `AFTERSHOCK_TOKEN` (Settings → API tokens).

## Tests

```bash
npm run typecheck
npm test               # unit + integration (Docker tests are skipped when Docker is absent)
npm run test:e2e       # Playwright, demo mode, port 3157
AFTERSHOCK_LIVE=1 npx vitest run tests/live   # opt-in: real model + Docker end to end
```

## Layout

```
app/(site)            marketing: home, pricing, security, docs, sign in
app/(app)             product: overview, incidents, time travel, memory, pull requests, repositories, integrations, settings, onboarding
app/api               auth, webhooks (GitHub, Sentry, PagerDuty), v1 HTTP API, cron
lib/domain            verdicts, admission rule, relevance, epicenter search, lessons — pure and unit-tested
lib/db                Drizzle schema, scoped queries, demo seed
lib/runner            Docker and Vercel Sandbox runners, JUnit parsing, framework adapters
lib/workflows         time travel, PR check, suggested fix, epicenter, retro-check, nightly
lib/model             provider (Muse / AI Gateway / custom), fencing of untrusted text, validation, prompts
lib/github            GitHub App client, webhooks, comments, bot PRs
cli                   aftershock CLI
legacy                the previous RecurGate implementation (reference only, not built)
```
