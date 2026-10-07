# API and CLI

## HTTP API

Authenticate with `Authorization: Bearer as_live_…` (Settings → API tokens) or a browser session. Limit: 120 requests per minute per caller.

| Method | Path | |
|---|---|---|
| GET | `/api/v1/incidents` | Incidents and their status |
| POST | `/api/v1/incidents` | Create: `{ title, repository, trigger?, observed?, expected?, fix? }` |
| POST | `/api/v1/incidents/:number/verify` | Start time travel (needs a linked fix) |
| GET | `/api/v1/runs/:id/evidence` | One time-travel attempt with its evidence (`evidence.json`) |
| GET | `/api/v1/memory` | Admitted tests with health and guard counts |
| GET | `/api/v1/lessons` | `LESSONS.md` for coding agents |
| POST | `/api/v1/checks/report` | Results from your own runner (below) |
| GET | `/api/v1/export` | Everything in the workspace as JSON |

Webhooks: `/api/webhooks/github`, `/api/webhooks/sentry?workspace=<login>`, `/api/webhooks/pagerduty?workspace=<login>`.

## Command line

```bash
npm run build:cli
node dist/aftershock.mjs <command>      # or `npx aftershock` inside the repo
```

| Command | |
|---|---|
| `prove --fix <sha> --test <file> [--repo .] [--runs 3]` | Time travel your own test locally in Docker |
| `check [--head HEAD] [--tests tests/aftershock]` | Run every memory test at a commit in Docker |
| `check --in-place --pr <n> --report` | In CI: run in the current checkout and report to Aftershock |
| `verify INC-12` | Start a hosted time travel |

Options: `--framework pytest|vitest|jest`, `--install "<command>"`. Exit codes: `0` safe or proven, `1` recur, `2` inconclusive or unproven. `--report` and `verify` read `AFTERSHOCK_URL` and `AFTERSHOCK_TOKEN`.

## Running checks on your GitHub Actions

Set the repository's runner to **Actions** under Repositories, add `AFTERSHOCK_TOKEN` as a repository secret, then:

```yaml
name: Aftershock
on: [pull_request]
jobs:
  guard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - run: pip install -r requirements.txt pytest   # or: npm ci
      - run: npx aftershock check --in-place --pr ${{ github.event.number }} --report
        env:
          AFTERSHOCK_TOKEN: ${{ secrets.AFTERSHOCK_TOKEN }}
          AFTERSHOCK_URL: https://aftershock-mk.vercel.app
```

Results complete the same GitHub check and comment as sandboxed runs.

## `.aftershock/config.yaml`

Optional. When present on the default branch it overrides the repository's settings for time travel and pull request checks:

```yaml
framework: pytest            # pytest | vitest | jest
runner: sandbox              # sandbox | actions
install: pip install -r requirements.txt
test_dir: tests/aftershock
check:
  mode: blocking             # blocking | advisory
  runs: 3
incidents:
  issue_label: incident
```
