# Changelog

All notable changes to Aftershock are recorded here. Versions follow [Semantic Versioning](https://semver.org/).

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
