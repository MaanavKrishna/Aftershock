# Aftershock

**Every incident becomes a test. Git history proves it.**

[![CI](https://github.com/MaanavKrishna/Aftershock/actions/workflows/ci.yml/badge.svg)](https://github.com/MaanavKrishna/Aftershock/actions/workflows/ci.yml)

**[aftershock-mk.vercel.app](https://aftershock-mk.vercel.app)** · [Security](https://aftershock-mk.vercel.app/security) · [Pricing](https://aftershock-mk.vercel.app/pricing) · [Docs](https://aftershock-mk.vercel.app/docs)

Aftershock turns a production incident into a regression test that must **fail on the commit before the fix and pass on the fix**, three runs each in an isolated sandbox. Then it guards every pull request against that incident coming back.

```
incident ──► model drafts a test ──► time travel: before fix ✕✕✕ · on fix ✓✓✓ ──► memory ──► every PR checked
```

## Getting started

1. **Sign in with GitHub** at [aftershock-mk.vercel.app](https://aftershock-mk.vercel.app/signin).
2. **Install the GitHub App** on the repositories you want guarded. Each installation becomes a workspace, and teammates who can access it join automatically when they sign in.
3. **Record an incident.** Label a GitHub issue `incident`, paste a postmortem, fill in the form, or connect Sentry or PagerDuty.
4. **Link the fix.** Give the fix commit or pull request, or mention the incident in the PR (`Fixes INC-12`). Time travel starts when it merges.
5. **Merge the test.** When the test is proven, Aftershock opens a pull request that adds it under `tests/aftershock/`. From then on, every pull request that could bring the bug back is checked.

Supported today: Python (pytest) and TypeScript or JavaScript (vitest, jest) repositories on GitHub.

## What it does

| | |
|---|---|
| **Capture** | Incidents come from labelled GitHub issues, pasted postmortems, a form, or Sentry and PagerDuty alerts. Alerts wait in *Awaiting fix* until a pull request that mentions the incident merges. |
| **Time travel** | A model drafts one test. It is admitted only if it fails before the fix and passes on it. Rejected drafts are redrafted with the failure as feedback, up to 3 times. |
| **Memory** | Proven tests land in your repository through a pull request. They re-run nightly on the default branch, marked Healthy, Flaky or Failing on main, and export as `LESSONS.md` for coding agents. |
| **Guard** | Each pull request runs only the relevant memory tests: those whose files it changes, plus any the model's triage adds. It gets one check and one comment: *Recur*, *Safe*, *Inconclusive* or *Skipped*. |
| **Epicenter** | Bisects history with the proven test to find the commit and pull request that introduced the bug. |
| **Retro-check** | A newly proven test runs at once against every open pull request. |
| **Suggested fix** | On a *Recur* check, a fix is posted only if it passes every memory test for the repository. A person applies it. |

Rules that never bend:
- A model never marks anything proven or safe; only test runs do.
- A test that passes before the fix is rejected.
- Mixed results are never green.
- Nothing is pushed to a default branch.
- Sandboxed runs get no secrets and no network while tests run.

## Integrations

- **GitHub**: sign-in, issues, check runs, pull request comments and test pull requests, all through one GitHub App.
- **Sentry and PagerDuty**: signed webhooks open incidents from alerts.
- **Model**: Muse by default, Vercel AI Gateway, or any OpenAI-compatible endpoint. Keys are encrypted at rest.
- **CI**: run checks on your own GitHub Actions instead of the hosted sandbox. See [API and CLI](docs/api.md).

## Documentation

- [Self-hosting and setup](docs/setup.md): GitHub App, Neon, Vercel, model, Sentry, PagerDuty, roles
- [API and CLI](docs/api.md): HTTP API, `aftershock` command line, GitHub Actions runner, `.aftershock/config.yaml`
- [Architecture](docs/architecture.md): flows, code layout, security model

## Development

Requirements: Node 22+. Docker Desktop or Colima is needed for real time-travel runs.

```bash
npm install
cp .env.example .env.local      # set AUTH_SECRET to 32+ random characters
npm run dev                     # http://127.0.0.1:3000
```

With `AFTERSHOCK_DEMO=1`, the sign-in page offers a seeded demo workspace stored in embedded Postgres under `./data`. No accounts are needed.

```bash
npm run typecheck
npm test               # unit + integration (Docker tests skip when Docker is absent)
npm run test:e2e       # Playwright on port 3000
npm run build
```

Stack: Next.js 16 · React 19 · TypeScript · Tailwind v4 · Drizzle (Neon / PGlite) · Vercel Workflow · Vercel Sandbox · Octokit · Vitest · Playwright.
