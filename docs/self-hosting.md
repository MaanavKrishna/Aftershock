# Self-hosting with Docker Compose

Run all of Aftershock on one machine you control: the app, its database, and test runs in Docker containers. Nothing is sent to Aftershock's hosted service.

## What runs where

| Service | What it does |
|---|---|
| `app` | The Next.js app. Workflows (time travel, checks, Epicenter, nightly) run in-process. |
| Embedded Postgres | PGlite, stored in the `aftershock-data` volume. Migrations run on start. |
| Runs | Each proof and check is a fresh container on the host's Docker, with `--network none` while tests run. |
| `cron` | Calls the protected daily endpoint once a day: nightly re-checks, retention, re-proofs, digests. |

## Start

1. Create a GitHub App as in [Setup](setup.md), pointing its URLs at your `APP_URL`.
2. Copy and fill in the environment:

   ```bash
   cp .env.example .env
   ```

   Set at least `AUTH_SECRET` (32+ random characters), `APP_URL`, `CRON_SECRET`, the `GITHUB_*` and `AUTH_GITHUB_*` values, and a model (`MODEL_API_KEY`, or a custom endpoint configured later under Integrations).
3. Create the run folder and start:

   ```bash
   sudo mkdir -p /var/lib/aftershock/runs
   docker compose up -d --build
   ```

4. Open `APP_URL` and sign in with GitHub.

## Things to know

- **The Docker socket is root on the host.** The app container can start containers, so treat the machine as dedicated to Aftershock. Test runs themselves get no secrets and no network while tests run.
- **Back up the `aftershock-data` volume.** It holds the database, including encrypted secrets; keep `AUTH_SECRET` (or `ENCRYPTION_KEY`) with it, or the secrets can't be read back.
- **Evidence keys.** Bundles are signed with a key derived from `AUTH_SECRET`; set `AFTERSHOCK_EVIDENCE_KEY` to manage it separately (see [Audit evidence](evidence.md)).
- **Scale.** This is a single-node setup. For more load, deploy to Vercel with Neon and the hosted sandbox as in [Setup](setup.md).
- **Updates.** `git pull && docker compose up -d --build`. Migrations are additive, so you can roll back to the previous image.
