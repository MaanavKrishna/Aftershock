# API and CLI

## HTTP API

Authenticate with `Authorization: Bearer as_live_…` (Settings → API tokens) or a browser session. Tokens are **read only** or **read and write**; POST endpoints need write access and answer 403 otherwise. Limit: 120 requests per minute per caller.

| Method | Path | |
|---|---|---|
| GET | `/api/v1/incidents` | Incidents and their status |
| POST | `/api/v1/incidents` | Create: `{ title, repository, trigger?, observed?, expected?, fix? }` |
| POST | `/api/v1/incidents/:number/verify` | Start time travel (needs a linked fix) |
| GET | `/api/v1/incidents/:number/evidence` | Signed evidence bundle for audits ([Audit evidence](evidence.md)) |
| GET | `/api/v1/runs/:id/evidence` | One time-travel attempt with its full log (`evidence.json`) |
| GET | `/api/health` | Service and database status for uptime monitors (no auth) |
| GET | `/.well-known/aftershock-jwks.json` | Public keys for verifying evidence (no auth) |
| GET | `/api/badge/:owner/:repo.svg` | README badge for a public repository (no auth; turn on **Public README badge** in Labs). Private and unknown repositories answer 404 |
| POST | `/api/mcp` | MCP server for coding agents ([Coding agents](agents.md)) |
| GET | `/api/v1/memory` | Admitted tests with health and guard counts |
| GET | `/api/v1/lessons` | `LESSONS.md` for coding agents |
| POST | `/api/v1/checks/report` | Results from your own runner (below) |
| GET | `/api/v1/export` | Everything in the workspace as JSON |

Webhooks: `/api/webhooks/github` (each delivery id is handled once; repeats answer `duplicate delivery`), and `/api/webhooks/<source>?workspace=<login>` for alert sources (see [Integrations](integrations.md)).

## Command line

```bash
npm run build:cli
node dist/aftershock.mjs <command>
```

| Command | |
|---|---|
| `prove --fix <sha> --test <file> [--repo .] [--runs 3]` | Time travel your own test locally in Docker |
| `check [--head HEAD] [--tests tests/aftershock]` | Run every memory test at a commit in Docker |
| `check --in-place --pr <n> --report` | In CI: run in the current checkout and report to Aftershock |
| `verify INC-12` | Start a hosted time travel |

Options: `--framework pytest|vitest|jest|go|junit|rspec|playwright`, `--install "<command>"`. Exit codes: `0` safe or proven, `1` recur, `2` inconclusive or unproven. `--report` and `verify` read `AFTERSHOCK_URL` and `AFTERSHOCK_TOKEN`.

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
      - uses: MaanavKrishna/Aftershock/action@v0.2.1
        with:
          token: ${{ secrets.AFTERSHOCK_TOKEN }}
          install: pip install -r requirements.txt pytest   # or: npm ci
```

The token needs write access. Options are in [action/README.md](../action/README.md).

Results complete the same GitHub check and comment as sandboxed runs.

## `.aftershock/config.yaml`

Optional. When present on the default branch it overrides the repository's settings for time travel and pull request checks:

```yaml
framework: pytest            # pytest | vitest | jest | go | junit | rspec | playwright
runner: sandbox              # sandbox | actions
install: pip install -r requirements.txt
test_dir: tests/aftershock
check:
  mode: blocking             # blocking | advisory
  runs: 3
incidents:
  issue_label: incident
packages:                    # monorepos; see docs/languages.md
  - path: services/api
    framework: go
    install: go mod download
```
