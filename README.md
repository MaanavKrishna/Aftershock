# Aftershock

**Every incident becomes a test. Git history proves it.**

Aftershock turns a production incident into a regression test that must **fail on the commit before the fix and pass on the fix** — three runs each, in an isolated runner — and then guards every pull request against that incident coming back.

```
incident ──► model drafts a test ──► time travel: before fix ✕✕✕ · on fix ✓✓✓ ──► memory ──► every PR checked
```

## What it does

| | |
|---|---|
| **Capture** | Labelled GitHub issues, pasted postmortems, a form, or Sentry / PagerDuty alerts. Alerts wait in *Awaiting fix* until a PR that mentions the incident merges. |
| **Time travel** | A model drafts one test; it is admitted only if it fails before the fix and passes on it. Rejected drafts are redrafted with the failure as feedback (up to 3). |
| **Memory** | Proven tests land in your repo through a bot PR, re-run nightly on the default branch (Healthy / Flaky / Failing on main) and export as `LESSONS.md` for coding agents. |
| **Guard** | Each PR runs only the relevant memory tests (file overlap, plus model triage that can only add) and gets one check and one comment: *Recur*, *Safe*, *Inconclusive* or *Skipped*. |
| **Epicenter** | Bisects history with the proven test to find the commit and PR that introduced the bug. |
| **Retro-check** | A newly proven test runs at once against every open PR. |
| **Suggested fix** | On a Recur check, a fix is posted only if it passes every memory test for the repository. |

Rules that never bend: a model never marks anything proven or safe · a test that passes before the fix is rejected · mixed results are never green · nothing is pushed to a default branch · sandboxed runs get no secrets.

## Quick start (no accounts needed)

Requirements: Node 22+, and Docker (Docker Desktop or Colima) for real time travel.

```bash
npm install
cp .env.example .env.local      # set AUTH_SECRET to 32+ random characters
npm run dev                     # http://127.0.0.1:3000
```

Choose **Sign in → Try the demo workspace**. It is seeded with incidents, proven tests and pull request checks, stored in embedded Postgres under `./data`.

To draft tests, configure a model: set `MODEL_API_KEY` (Muse, the default) or pick Vercel AI Gateway / any OpenAI-compatible endpoint under **Integrations**.

## Documentation

- [Setup and deployment](docs/setup.md) — GitHub App, OAuth, Neon, Vercel, Sentry, PagerDuty
- [Architecture](docs/architecture.md) — how the pieces fit, code layout
- [API and CLI](docs/api.md) — HTTP API, `aftershock` command line, GitHub Actions runner
- [Product spec](docs/product-spec.md) — the full design
- [Design](docs/design/) — the 18 screen designs the UI is built from

## Development

```bash
npm run typecheck
npm test               # unit + integration (Docker tests skip when Docker is absent)
npm run test:e2e       # Playwright on port 3000, demo mode
npm run build
npm run build:cli      # dist/aftershock.mjs
AFTERSHOCK_LIVE=1 npx vitest run tests/live    # opt-in: real model + Docker end to end
```

Stack: Next.js 16 · React 19 · TypeScript · Tailwind v4 · Drizzle (Neon / PGlite) · Vercel Workflow · Vercel Sandbox · Octokit · Vitest · Playwright.
