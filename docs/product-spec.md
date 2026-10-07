# Aftershock — product and system design

Visual design: `docs/design/*.dc.html` (18 screens).

## 1. Product

Aftershock turns a production incident into a regression test that git history proves, then guards every pull request against that incident recurring.

Users: engineering teams on GitHub with Python (pytest) or TypeScript (vitest/jest) repositories. Multi-tenant SaaS; a workspace is a GitHub organisation (or personal account).

Core loop:
1. **Capture** an incident from a labelled GitHub issue, a pasted postmortem, a manual form, or a Sentry/PagerDuty webhook. Incidents without a fix commit wait in **Awaiting fix**; a merged PR that references the incident ID starts step 2 automatically.
2. **Draft**: the model reads the incident, the fix diff and nearby tests, and writes one test file in the repo's framework and style.
3. **Time travel**: in an isolated sandbox, the draft runs 3× on the fix's parent commit (must fail every time) and 3× on the fix commit (must pass every time). Otherwise it is rejected and redrafted with the failure as feedback, up to 3 drafts. Result: **Proven**, **Rejected** (passed before the fix) or **Unproven** (mixed results or out of drafts).
4. **Guard**: a proven test is admitted to **Memory** and proposed to the repo in a bot PR (`tests/aftershock/…` plus `.aftershock/incidents/INC-n.yaml`). On every PR, Aftershock selects relevant memory tests, runs each 3× on the head commit and posts one check run and one comment: **Recur** (all fail), **Safe** (all pass), **Inconclusive** (mixed or environment failure), **Skipped**.

Additional features in scope (all appear in the design):
- **Fault lines**: per-file incident counts; PRs touching those files always run the linked tests.
- **Nightly re-check**: memory tests run on each default branch nightly; health is Healthy / Flaky / Failing on main.
- **Suggested fix**: on a Recur check, the model proposes a patch that must pass all memory tests for the repo before it is posted as a PR suggestion. It is never applied automatically.
- **LESSONS.md export**: memory rendered as guidance for AI coding agents.
- **Overrides**: a reviewer may override a Recur check with a reason; it is recorded on the incident trail.
- **Epicenter**: after a test is proven, Aftershock bisects history with it (between the last known passing ancestor and the fix parent, capped at 12 sandbox runs) to find the commit — and its PR — that introduced the bug. Shown on the incident as "introduced in PR #n". Best-effort: if bisect cannot run (install failure on old commits), the incident says so.
- **Retro-check**: when a test is admitted, it runs immediately against every open PR in that repository, so a change already in review that would reopen the incident is caught before merge.

Rules that never bend (enforced in code, tested):
- A model never marks anything proven, safe or applied. Only test runs do.
- A test that passes before the fix is rejected.
- Mixed results are never green.
- Aftershock never pushes to a default branch; tests arrive as PRs.
- Sandboxed runs never receive secrets; network is cut after dependency install.
- Untrusted text (incidents, postmortems, code, alerts) is passed to the model as fenced data.

## 2. Architecture (all on Vercel)

| Concern | Choice |
|---|---|
| App, API, webhooks | Next.js 16 App Router on Vercel (Fluid compute), TypeScript |
| Database | Neon Postgres (Vercel Marketplace) via Drizzle ORM |
| Auth | Auth.js with GitHub OAuth; workspace = GitHub org |
| GitHub integration | GitHub App (Octokit): installation tokens, webhooks, checks, PRs, comments |
| Code execution | Vercel Sandbox (`@vercel/sandbox`), one microVM per run |
| Orchestration | Vercel Workflow (durable, resumable steps) for time travel, PR checks, suggested fixes |
| Model | Provider interface over OpenAI-compatible APIs: Muse (default, existing `MODEL_API_KEY`), Vercel AI Gateway, or a custom endpoint |
| Artifacts | Vercel Blob for trimmed logs and `evidence.json` |
| Schedules | Vercel Cron: nightly re-check, usage reset |
| Styling | Tailwind v4 with the design's tokens; Geist + Geist Mono |

Execution backends behind one `Runner` interface: `sandbox` (default), `actions` (the team's GitHub Actions run `npx aftershock check` and post results back with a workspace token) and `local` (Docker, for development and the CLI). When the sandbox monthly allowance is exhausted, PR checks for repos with the workflow installed move to `actions`; others report Inconclusive.

Repository layout (single Next.js app, replacing the Python backend):
```
app/(site)/…            marketing: /, /pricing, /security, /docs, /signin
app/(app)/…             product: /onboarding, /overview, /incidents, /incidents/new,
                        /incidents/[id], /incidents/[id]/runs/[run], /memory,
                        /pulls, /pulls/[id], /repositories, /integrations, /settings
app/api/v1/…            HTTP API (token auth)
app/api/webhooks/{github,sentry,pagerduty}/route.ts
lib/db/                 Drizzle schema + queries
lib/github/             App auth, checks, comments, PRs, issue/fix discovery
lib/runner/             Runner interface; sandbox, actions, local implementations;
                        framework adapters (pytest, vitest, jest): install, run, parse JUnit XML
lib/model/              provider interface, prompts, output validation
lib/workflows/          timeTravel, prCheck, suggestFix, nightly
lib/relevance/          fault lines + triage
packages/cli/           `aftershock` CLI (verify, check, --local) sharing lib/runner
samples/ecommerce-api/  pinned demo repository (kept)
```


## 3. Data model (Postgres)

- `workspaces` (id, github_account_id, login, name, plan, incident_prefix, settings jsonb)
- `users`, `memberships` (role: owner | admin | member)
- `repositories` (workspace, github_repo_id, full_name, default_branch, framework, install_cmd, runner, check_mode, config jsonb)
- `incidents` (workspace, repo, number, title, trigger, observed, expected, severity, source: issue|postmortem|form|sentry|pagerduty, source_ref, fix_sha, parent_sha, fix_pr, status: awaiting_fix|traveling|proven|rejected|unproven, watched_files text[])
- `time_travel_runs` (incident, attempt, status, test_path, test_code, before_results jsonb, fix_results jsonb, model, tokens, sandbox_cpu_ms, log_blob_url, feedback, workflow_run_id)
- `memory_tests` (incident, repo, path, function, proven_run, bot_pr, health: healthy|flaky|failing, last_nightly)
- `pr_checks` (repo, pr_number, head_sha, base_sha, status, verdict, runner, check_run_id, comment_id, duration_ms)
- `pr_check_results` (check, memory_test, selected_by: files|triage, runs jsonb, verdict, failure_excerpt) and `pr_check_skips` (check, incident, reason)
- `suggested_fixes` (check, patch, results jsonb, status)
- `overrides` (check, user, reason)
- `integrations` (workspace, kind: sentry|pagerduty|model, config jsonb, secret_ciphertext)
- `api_tokens` (workspace, name, hash, last_used_at)
- `deliveries` (integration, event, signature_ok, result) for the Integrations page log
- `activity` (workspace, kind, refs jsonb) for the overview feed and incident trail
- `usage` (workspace, month, sandbox_cpu_ms, drafts)

Secrets are encrypted with an app key (AES-GCM); plaintext is never returned by the API.

## 4. Key flows

**Time travel workflow** (`lib/workflows/timeTravel`), one durable step each: load incident and resolve fix/parent → read context through the GitHub API (fix diff, conftest/setup files, two nearest test files) → draft via model (validated: single file under `test_dir`, parses, imports allowed) → sandbox run on parent ×3 → sandbox run on fix ×3 → decide → on Proven: store memory test, open bot PR, record activity. Failures feed the next draft. Each sandbox run: create VM → shallow fetch one commit with an installation token → install → cut network → write test → run framework with JUnit output → parse → stop VM.

**PR check workflow**: on `pull_request` opened/synchronize → create check run (in progress) → changed files → select tests (watched-file overlap is mandatory; model triage may only add) → run on head ×3 via the repo's runner → verdicts → update check run (conclusion `failure` only when mode is blocking and any Recur) → upsert one PR comment.

**Incident intake**: GitHub `issues.closed` with the configured label → find closing PR/commit via timeline events → incident with fix → start time travel. Postmortem paste → model extracts fields (shown as an editable draft; fix SHA must resolve in git). Sentry/PagerDuty → verify signature → map project/service to repo → incident `awaiting_fix`, de-duplicated by fingerprint. GitHub `pull_request.closed` merged, body or title mentioning `INC-n` → set fix → start time travel.

## 5. Security

Least-privilege GitHub App permissions (contents read, issues read, checks write, pull requests write, metadata read). Webhook signatures verified for GitHub (HMAC-SHA256), Sentry and PagerDuty before parsing. Sandbox: no env secrets, network blocked after install, wall-clock cap, VM destroyed. The model sees fenced untrusted data; its output is schema-validated and only ever written to the test path. Authorization: every query is scoped by workspace membership; API tokens are hashed. Per-caller rate limits on webhook (300/min) and API (120/min) routes, plus Vercel Firewall rules for a global limit. Roles: only owners and admins can override checks, change repository settings, integrations, API tokens and workspace settings. Custom model endpoints must be public https hosts.

## 6. Error handling

Every failure is persisted with a readable cause and shown with the next action (the States screen). Model timeouts, invalid output, install failures, sandbox quota and GitHub API errors leave the incident in its previous state; nothing becomes proven or safe because of an error. Workflow steps retry transient failures with backoff; non-retryable errors end the run as Unproven/Inconclusive with the reason.

## 7. Testing

- Unit (Vitest): verdict logic (all fail / all pass / mixed / errors), admission rules, relevance selection, JUnit parsing, model-output validation, signature verification, workspace scoping.
- Integration: time travel against the pinned ecommerce-api sample using the `local` runner. The guard-removal mutation must yield Proven; an always-passing draft must be Rejected; a flaky draft must be Unproven. Webhook routes with recorded fixture payloads.
- End-to-end (Playwright): sign-in stubbed in test mode, onboarding, incident creation from all four sources, time-travel page states, PR check page, responsive layouts at 390px, keyboard navigation.
- CI: typecheck, lint, unit, integration, build on every push.

## 8. Delivery phases

1. **Foundation**: rebrand, Next.js routes for all 18 screens built from the design, Drizzle schema and migrations, Auth.js GitHub sign-in, seeded demo workspace so every screen renders real rows.
2. **Execution**: Runner interface with local and sandbox backends, pytest/vitest/jest adapters, the time-travel workflow, CLI.
3. **AI layer**: provider interface (Muse default, AI Gateway, custom), drafting with feedback, triage, postmortem extraction, suggested fixes.
4. **GitHub App**: install flow, issue/fix discovery, PR checks and comments, bot PRs, Actions runner and the published workflow.
5. **Alerts and scale**: Epicenter bisect, retro-check of open PRs, Sentry and PagerDuty intake, Awaiting fix automation, nightly cron and health, usage metering and fallback, LESSONS.md export, API tokens.

Each phase ends with passing tests and a working deploy. Phase 1 can be demoed without any external credentials.

## 9. Required configuration

`DATABASE_URL`, `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`, `MODEL_API_KEY` (existing), `MODEL_BASE_URL`, `MODEL_NAME`, optional `AI_GATEWAY_API_KEY`, `ENCRYPTION_KEY`, `BLOB_READ_WRITE_TOKEN`, Vercel Sandbox via project OIDC. The user creates the GitHub App and OAuth app; Aftershock never handles their GitHub password.

## 10. Out of scope

GitLab/Bitbucket; languages beyond Python and TypeScript; reproducing incidents that need live third-party services; load or multi-service failures; automatic merging of anything.
