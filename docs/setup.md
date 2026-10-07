# Self-hosting and setup

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

- **Database**: with no `DATABASE_URL`, Aftershock uses embedded Postgres (PGlite) in `./data/pglite`. Migrations run automatically.
- **Runner**: time travel and pull request checks run in Docker. Run folders live in `~/.cache/aftershock/runs` (override with `AFTERSHOCK_WORK_DIR`) because Docker Desktop and Colima share the home folder with containers.
- **Workflows**: in development they run in-process. On Vercel they run durably with the Workflow SDK.
- **Demo (local only)**: `AFTERSHOCK_DEMO=1` shows “Try the demo workspace” on the sign-in page. Vercel builds without it delete any demo workspace from the database (`scripts/remove-demo-data.mts`).

## 1. GitHub App (sign-in and repositories)

One GitHub App handles both “Sign in with GitHub” and repository access.

1. Deploy first (step 3) so the app has a public URL, and set `APP_URL` to it.
2. On GitHub, open **Settings → Developer settings → GitHub Apps → New GitHub App** (or the organisation's settings) and fill in:

| Setting | Value |
|---|---|
| Homepage URL | `APP_URL` |
| Callback URL (sign-in) | `APP_URL/api/auth/callback` |
| Setup URL | `APP_URL/onboarding` |
| Webhook URL | `APP_URL/api/webhooks/github`, with a long random **Webhook secret** |
| Repository permissions | Contents **read & write**, Issues **read**, Metadata **read**, Checks **read & write**, Pull requests **read & write** |
| Events | Issues, Pull request, Check run (installation events are always sent) |

3. After creating it, generate a **private key** and a **client secret**, then add these to Vercel (Production) and redeploy:

| Variable | From |
|---|---|
| `GITHUB_APP_ID` | App ID |
| `GITHUB_APP_SLUG` | the app's URL name (`github.com/apps/<slug>`) |
| `GITHUB_APP_PRIVATE_KEY` | the downloaded `.pem` file (newlines may be written as `\n`) |
| `GITHUB_WEBHOOK_SECRET` | the webhook secret you chose |
| `AUTH_GITHUB_ID` | Client ID |
| `AUTH_GITHUB_SECRET` | the client secret |

4. Install the app on your repositories from `https://github.com/apps/<slug>/installations/new`. Each installation becomes a workspace; on sign-in, people who can access an installation join it (the first as owner, later ones as members).

Changing the production domain later: update `APP_URL` in Vercel, redeploy, and change the Homepage, Callback, Setup and Webhook URLs in the GitHub App's settings to the new domain.

Contents write is used only to open test PRs on `aftershock/*` branches. Runners always clone with a one-hour token scoped **read-only** to a single repository. Make the app public in its GitHub settings (**Advanced → Make public**) so other accounts and organisations can install it.

## 2. Database (Neon)

Create a Neon Postgres database from the Vercel project's **Storage** tab; it sets `DATABASE_URL`. Migrations run automatically on every Vercel build (`npm run vercel-build`). To run them by hand: `npm run db:migrate`.

After changing `lib/db/schema.ts`, generate a migration with `npm run db:generate`.

## 3. Deploy to Vercel

1. Import the repository in Vercel and add every variable from `.env.example` that applies.
2. Set `APP_URL` to the production URL, `ENCRYPTION_KEY` and `AUTH_SECRET` to long random strings, and `CRON_SECRET`.
3. On Vercel, runs use **Vercel Sandbox** (one Firecracker microVM per run) and workflows use the **Workflow SDK** automatically. `vercel.json` schedules the nightly re-check at 03:00 UTC.
4. Recommended: add a Vercel Firewall rate-limit rule on `/api/webhooks/*` and `/api/v1/*`. Aftershock also limits per instance (300 webhook and 120 API requests per minute per caller).

## 4. Model

Under **Integrations → Model provider**:

- **Muse** (default): uses `MODEL_API_KEY`, `MODEL_BASE_URL`, `MODEL_NAME` from the server.
- **Vercel AI Gateway**: a model id such as `provider/model` and a gateway key (or `AI_GATEWAY_API_KEY`).
- **Custom**: any OpenAI-compatible `https://` endpoint. Private, loopback and internal addresses are refused.

Keys are encrypted at rest (AES-256-GCM) and never sent to a runner.

## 5. Sentry and PagerDuty

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
