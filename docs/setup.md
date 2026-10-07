# Setup and deployment

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

- **Database**: with no `DATABASE_URL`, Aftershock uses embedded Postgres (PGlite) in `./data/pglite`. Migrations run automatically.
- **Runner**: time travel and pull request checks run in Docker. Run folders live in `~/.cache/aftershock/runs` (override with `AFTERSHOCK_WORK_DIR`) because Docker Desktop and Colima share the home folder with containers.
- **Workflows**: in development they run in-process. On Vercel they run durably with the Workflow SDK.
- **Demo**: `AFTERSHOCK_DEMO=1` shows “Try the demo workspace” on the sign-in page.

## 1. Sign in with GitHub (OAuth app)

GitHub → Settings → Developer settings → OAuth Apps → New.

- Homepage URL: `APP_URL`
- Callback URL: `APP_URL/api/auth/callback`

Set `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET`. Scopes requested: `read:user read:org`.

## 2. GitHub App (repositories)

GitHub → Settings → Developer settings → GitHub Apps → New.

| Setting | Value |
|---|---|
| Webhook URL | `APP_URL/api/webhooks/github` |
| Webhook secret | random string → `GITHUB_WEBHOOK_SECRET` |
| Setup URL | `APP_URL/onboarding` |
| Repository permissions | Contents **read & write**, Issues **read**, Metadata **read**, Checks **read & write**, Pull requests **read & write** |
| Events | Installation, Installation repositories, Issues, Pull request, Check run |

Contents write is used only to open test PRs on `aftershock/*` branches. Runners always clone with a one-hour token scoped **read-only** to a single repository.

Set `GITHUB_APP_ID`, `GITHUB_APP_SLUG` and `GITHUB_APP_PRIVATE_KEY` (the PEM; `\n` escapes are accepted).

## 3. Database (Neon)

Create a Neon Postgres database (for example from the Vercel Marketplace), set `DATABASE_URL`, then:

```bash
npm run db:migrate
```

After changing `lib/db/schema.ts`, generate a migration with `npm run db:generate`.

## 4. Deploy to Vercel

1. Import the repository in Vercel and add every variable from `.env.example` that applies.
2. Set `APP_URL` to the production URL, `ENCRYPTION_KEY` and `AUTH_SECRET` to long random strings, and `CRON_SECRET`.
3. On Vercel, runs use **Vercel Sandbox** (one Firecracker microVM per run) and workflows use the **Workflow SDK** automatically. `vercel.json` schedules the nightly re-check at 03:00 UTC.
4. Recommended: add a Vercel Firewall rate-limit rule on `/api/webhooks/*` and `/api/v1/*`. Aftershock also limits per instance (300 webhook and 120 API requests per minute per caller).

## 5. Model

Under **Integrations → Model provider**:

- **Muse** (default): uses `MODEL_API_KEY`, `MODEL_BASE_URL`, `MODEL_NAME` from the server.
- **Vercel AI Gateway**: a model id such as `provider/model` and a gateway key (or `AI_GATEWAY_API_KEY`).
- **Custom**: any OpenAI-compatible `https://` endpoint. Private, loopback and internal addresses are refused.

Keys are encrypted at rest (AES-256-GCM) and never sent to a runner.

## 6. Sentry and PagerDuty

Under **Integrations**:

1. **Generate signing secret** — shown once; paste it into the provider.
2. Paste the webhook URL shown there (`APP_URL/api/webhooks/sentry?workspace=<login>` or `.../pagerduty?...`).
3. Map projects or services to repositories, e.g. `shop-backend:ecommerce-api`.
4. **Send test delivery** to check the signature end to end.

Alerts open incidents in *Awaiting fix*. When a PR that mentions the incident (for example “Fixes INC-16”) merges, time travel starts.

## Roles

| | Owner | Admin | Member |
|---|:-:|:-:|:-:|
| Record incidents, start time travel, add notes | ✓ | ✓ | ✓ |
| Override a failing check | ✓ | ✓ | |
| Repository runner and check mode | ✓ | ✓ | |
| Integrations, API tokens, workspace settings | ✓ | ✓ | |
