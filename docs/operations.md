# Operations

How to run Aftershock in production, and what to do when something goes wrong.

## Logs

Every server event is one JSON line (`lib/obs/log.ts`) with `level`, `msg`, and context such as `requestId`, `workspaceId`, `runId`, `checkId`. Secrets are redacted before writing. Uncaught server errors are logged by `instrumentation.ts` with the route and request id.

In Vercel: **Project → Logs**, filter by `level:error` or search a request id (`x-vercel-id`).

## Kill switch

Set `AFTERSHOCK_RUNS_DISABLED=1` in Vercel and redeploy (or use an environment variable change + instant redeploy). No sandbox or Docker run starts while it is set; time travel and checks finish as *unproven* / *inconclusive* with the reason “Runs are paused by the operator”. Remove it to resume.

## Time budget and the daily job

- Every hosted sandbox run must finish inside one function invocation. `AFTERSHOCK_STEP_BUDGET_MS` (default 270000) caps install and test timeouts for a run, and the sandbox stops itself one minute after the budget if the function is cut off. Each run is its own workflow step, so long jobs (Epicenter, verifying a suggested fix) are many short steps.
- Vercel Cron calls `/api/cron/nightly` once a day. It only starts the durable `daily` workflow, which re-checks every memory test as separate steps. Retention and weekly re-proofs run from the same job.

## Feature flags

New features ship dark. Each flag (`lib/flags.ts`) is off unless:

- the workspace turns it on (`workspaces.settings.flags.<name> = true`), or
- an environment variable forces it for everyone: `AFTERSHOCK_FLAG_<NAME>=on` or `off` (for example `AFTERSHOCK_FLAG_INSTALL_CACHE=on`). The variable wins over workspace settings.

## Database migrations

- Migrations run during **production** builds only (`scripts/vercel-build.mjs`); preview builds never touch the database.
- Every migration is additive and backward-compatible with the previous release: add nullable columns and new tables first, remove old ones in a later release. This keeps instant rollback safe.
- Generate with `npm run db:generate` after changing `lib/db/schema.ts`; commit the SQL file.

## Rollback

1. Vercel → **Deployments** → pick the last good production deployment → **Instant Rollback**.
2. Because migrations are backward-compatible, the old code runs against the new schema.
3. Fix forward on `main`; the next production deployment replaces the rollback.

If a migration itself is wrong, write a new forward migration that corrects it. Never edit a migration that has already run.

## Incidents in Aftershock itself

1. Check Vercel runtime errors and logs for the request id or run id.
2. If runs are misbehaving (cost, abuse, a broken runner), turn on the kill switch first.
3. Report security issues as described in [SECURITY.md](../SECURITY.md).
