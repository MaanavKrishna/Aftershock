# Operations

How to run Aftershock in production, and what to do when something goes wrong.

## Logs

Every server event is one JSON line (`lib/obs/log.ts`) with `level`, `msg`, and context such as `requestId`, `workspaceId`, `runId`, `checkId`. Secrets are redacted before writing. Uncaught server errors are logged by `instrumentation.ts` with the route and request id.

In Vercel: **Project → Logs**, filter by `level:error` or search a request id (`x-vercel-id`).

## Kill switch

Set `AFTERSHOCK_RUNS_DISABLED=1` in Vercel and redeploy (or use an environment variable change + instant redeploy). No sandbox or Docker run starts while it is set; time travel and checks finish as *unproven* / *inconclusive* with the reason “Runs are paused by the operator”. Remove it to resume.

## Time budget and the daily job

- Every hosted sandbox run must finish inside one function invocation. `AFTERSHOCK_STEP_BUDGET_MS` (default 270000) caps install and test timeouts for a run, and the sandbox stops itself one minute after the budget if the function is cut off. Each run is its own workflow step, so long jobs (Epicenter, verifying a suggested fix) are many short steps.
- Vercel Cron calls `/api/cron/nightly` once a day. It only starts the durable `daily` workflow, which re-checks every memory test as separate steps. Retention, the notification sweep and weekly re-proofs run from the same job.

## Sandbox quota

On Vercel's Hobby plan, snapshot storage and sandbox time are capped per month. When a cap is hit, runs end as *Inconclusive* with the reason ("Sandbox capacity is used up"); nothing crashes or hangs. A failed install-snapshot save falls back to an uncached run. To keep checks running at the cap, switch repositories to GitHub Actions, turn the install cache off in Labs, or move to Vercel Pro.

## Install cache

With the `installCache` flag on, the first trusted run for a repository (time travel, nightly, Epicenter) snapshots the installed environment; later runs with the same framework, image, install command and lockfiles restore it and skip the install. At most two snapshots are kept per repository and each expires after 7 days. `node scripts/sandbox-snapshots.mjs` lists all snapshots in the project (and deletes them with `--yes`).

## Data lifecycle

- **Deleting**: admins delete incidents and repositories; owners delete the workspace; anyone can delete their own account (Settings → Danger zone). Each needs the name typed to confirm, and is written to the audit log (Settings → Audit log), which is kept even after a workspace is deleted.
- **Repositories removed from the GitHub App** are archived (no longer checked or listed) and purged after 30 days unless access returns.
- **Uninstalled workspaces** are kept for 30 days so a reinstall continues where it left off, then purged.
- **Retention**: run logs, webhook delivery records and finished notifications older than 30 days are cleared by the daily job. Verdicts, proofs and evidence stay until deleted.
- Deleting a repository or workspace also deletes its cached environments at the sandbox provider.

## Notifications

Activity with an event goes to the `notifications` outbox and the `notify` workflow delivers it (5 attempts over about 73 minutes). To see what is stuck: `select status, count(*) from notifications group by 1`. Rows left in `sending` for over 5 minutes are picked up again. A target switched off after repeated failures shows its reason in Settings → Notifications. See [Notifications](notifications.md).

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
