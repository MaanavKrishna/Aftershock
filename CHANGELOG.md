# Changelog

All notable changes to Aftershock are recorded here. Versions follow [Semantic Versioning](https://semver.org/).

## [0.2.2] — 2026-11-17

A new design system, Fault Line, and a rebuilt website and app on top of it. Plus faster lists, an audit log export and a stricter CI.

### Design
- **Fault Line:** quiet surfaces in three levels, Geist type, one interactive accent (signal blue) and colour kept for verdicts (proven, recur, safe, inconclusive, flaky). Every verdict has an icon, a word and a tint, and every text colour meets WCAG AA on every surface in light and dark. Spec in [docs/design-system.md](docs/design-system.md); every token and component on [/styleguide](https://aftershock-mk.vercel.app/styleguide).
- **Website:** a seismic hero (a trace that spikes at the incident and settles green once the test is proven), a proof grid, a replayed real proof, and rebuilt product, agents, evidence, integrations, pricing, security, compare, changelog and docs pages. Effects are marketing-only and switch off for reduced motion.
- **App:** a translucent sidebar that becomes an icon rail on tablets, a ⌘K palette across actions, pages, repositories and incidents, a proof timeline on every incident (the incident, the commit where the test fails, the fix where it passes), a pull request check card, a memory table, chart frames on Insights with data tables for screen readers, and settings split into tabs. Loading skeletons per page and a not-found page for unknown incidents and pull requests.
- One set of components in `components/ui` replaces two older ones; no page uses raw colours, pixel font sizes or one-off radii.
- **README** rebuilt around generated graphics (`.github/readme/build.py`) and real screenshots.

### Performance
- Incident, pull request, memory and audit lists are paged with stable cursors, and pick the latest attempt or check per item in SQL instead of loading everything.
- Overview loads in one parallel batch; Insights and the sidebar counts run their queries in parallel, and the sidebar no longer holds up the page.

### Product
- **Audit log export** as CSV (safe to open in a spreadsheet) or JSON, at `GET /api/v1/audit` and from Settings → Audit log, for owners and admins.

### Reliability and security
- Every write from the app goes through the workspace scope, and a check override is recorded in one transaction.
- Production builds start workflows through the Workflow SDK, which fixes backfill and other workflows on self-hosted `next start`.
- Next.js 16.4.6 and the rest of the minor and patch updates; `diff` 9; the unused `lucide-react` is removed; Node is pinned to 22.

### CI
- End-to-end tests run against the production build, so the strict Content Security Policy is tested as shipped. Superseded runs on branches are cancelled, Playwright browsers are cached, traces are uploaded when a test fails, and dependencies are audited.
- Dependabot groups production and development updates, keeps `@types/node` on the runtime's major and holds TypeScript below 7 until Next.js supports it.
- Tests: 450 unit and integration tests (up from 405), including GitHub OAuth, retro-check, the safe runner, paging and the audit export.

## [0.2.1] — 2026-10-28

A hardening release: sign-in, webhooks and data integrity, after a full architecture and security review. Everyone is asked to sign in once more after upgrading.

### Security
- **Server-side sessions:** each sign-in is a session that can be listed and revoked (Settings → Sessions), with a 14-day idle and 30-day absolute expiry. Signing out ends the session, and "Sign out everywhere else" ends the others.
- **Membership is re-checked** on every request, so someone removed from a workspace loses access at once.
- **Content Security Policy** with a per-request nonce on signed-in pages, and a strict static policy on public pages.
- **GitHub deliveries are handled once**, by delivery id, so a replayed or retried delivery can't start work twice. Deliveries over 25 MB are refused.
- **Rate limits** count failed webhook attempts per address and valid alerts per workspace separately, so a noisy source can't lock out a real one.
- **Custom model endpoints** are resolved and checked for private, loopback and metadata addresses before every call.
- Ask Aftershock questions are capped in length.

### Reliability
- **Race-safe incident numbers:** alerts arriving at the same moment no longer collide or get lost, and a repeated alert is de-duplicated by its fingerprint.
- **Sandbox quota** is enforced for every run type; when capacity is used up, runs end as *Inconclusive* with the reason, and a failed install-snapshot save falls back to an uncached run.
- Archived repositories and superseded incidents are skipped by nightly checks.
- **Health endpoint** `GET /api/health` for uptime monitoring.
- Database indexes for every frequent lookup.

### Product
- **Edit details** on an incident: title, trigger, observed, expected and fix can be corrected after recording.
- The MCP `list_lessons` tool returns the lessons themselves, not only a count.
- "Try the sample" pre-fills the public sample repository, MaanavKrishna/aftershock-sample.
- Final privacy policy and terms.

### Maintenance
- Dependabot for npm and GitHub Actions.
- Migrations `0012_integrity_indexes` and `0013_sessions_deliveries` run automatically on deploy.

## [0.2.0] — 2026-10-25

Incident memory goes beyond Python and TypeScript, reaches the tools teams already use, and proves it is still working. The website and app are redesigned.

### Proof
- **Still guarding:** weekly, each fix is undone on today's default branch and its test must fail again; tests are marked *Weak* or *Drifted* when they no longer would (Labs).
- **Test strength:** mutation testing of the fixed lines measures how precisely a test pins down its fix (Labs).
- **Several proven tests per incident**, each proven on its own, for example a unit test and an API test.
- **Languages:** Go, Java and Kotlin (JUnit with Maven or Gradle), Ruby (RSpec) and Playwright browser tests, each proven in Docker (Labs). Monorepo packages via `packages:` in `.aftershock/config.yaml`.
- **Install cache:** trusted runs snapshot installed dependencies so later runs skip the install (Labs).

### Guard
- **Recurrence risk** on every pull request check, even when no test runs.
- **Merge queue** checks on the merge-group commit (Labs).
- **Seen it before:** new incidents are linked to past ones they resemble; merged pull requests that change the files an open alert points at are suggested as its fix.
- Flaky tests are quarantined after repeated failures and released after seven green nights.

### Integrations
- incident.io, Linear, Rootly, Opsgenie, Datadog, Jira and a generic Standard Webhooks endpoint, alongside Sentry and PagerDuty (Labs). Replay window, size caps and constant-time verification for every source.
- **Notifications** to Slack and signed outbound webhooks, with retries, auto-disable and a weekly digest (Labs).
- **GitHub Action** `MaanavKrishna/Aftershock/action` runs checks on your own runners.
- **MCP server** for Claude Code, Cursor and Copilot (`check_change`, `ask`, lessons and incidents), and lessons synced into `AGENTS.md` by pull request (Labs).
- **README badge** for public repositories (Labs).

### Insight and evidence
- **Insights:** proof rate, time to proof, recurrences blocked, test health and strength, fault lines and an 8-week trend, with a shareable read-only reliability report.
- **Ask Aftershock:** questions answered only from your incidents, always with citations.
- **Signed audit evidence:** Ed25519 over RFC 8785 JSON, with a public JWKS, for SOC 2 and DORA.
- Backfill: import up to 25 closed incident issues at once.

### Platform and trust
- Read and write API token scopes; audit log; deletion of incidents, repositories, workspaces and accounts; 30-day retention; uninstall purge.
- Plans and active-committer metering; every run type counts toward sandbox hours; automatic fallback to GitHub Actions at the limit.
- Structured logs, feature flags, an operator kill switch, a public threat model and operations runbook.
- **Self-hosting** with Docker Compose.

### Design
- New design system (DS 2) with light and dark themes, and a rebuilt website: proof replay, product tour, agents, evidence, integrations, compare, pricing, security, changelog, and multi-page docs with search. Accessibility checked with axe in both themes.
- App redesign: dark mode, ⌘K command palette, activity inbox, mobile navigation, animated proof cells and a searchable log viewer.

## [0.1.0] — 2026-10-24

First public release. Live at https://aftershock-mk.vercel.app.

### Incidents
- Capture from labelled GitHub issues (Trigger / Observed / Expected sections are split out), pasted postmortems (the model extracts the fields and the repository), a form, or signed Sentry and PagerDuty webhooks.
- Incidents without a fix wait in *Awaiting fix*; merging a pull request that mentions `INC-n`, or closing the issue with a pull request, starts time travel.

### Time travel
- A model drafts one test in the repository's framework (pytest, vitest or jest) and style.
- The test is admitted only if it fails 3/3 on the commit before the fix and passes 3/3 on the fix, in an isolated Vercel Sandbox microVM (Docker locally). Rejected drafts are redrafted with the failure as feedback.
- Proven tests are proposed to the repository in a bot pull request with a `.aftershock/incidents/INC-n.yaml` record.

### Guard
- Every pull request runs the relevant memory tests on GitHub's test merge commit and gets one check run and one comment: *Recur*, *Safe*, *Inconclusive* or *Skipped*.
- Suggested fixes are posted only after passing every memory test for the repository.
- Retro-check runs a newly proven test against every open pull request.
- Epicenter bisects history to find the commit and pull request that introduced the bug.
- Nightly re-checks track test health (Healthy, Flaky, Failing on main) and export `LESSONS.md` for coding agents.

### Platform
- One GitHub App for sign-in and repository access; organisation members join installed workspaces on sign-in.
- HTTP API, `aftershock` CLI, and a GitHub Actions runner mode.
- Pluggable model: Muse by default, Vercel AI Gateway, or any public OpenAI-compatible endpoint.
- Next.js 16, Neon Postgres, Vercel Workflow and Vercel Sandbox; runs on Vercel's free tier.

[0.1.0]: https://github.com/MaanavKrishna/Aftershock/releases/tag/v0.1.0
