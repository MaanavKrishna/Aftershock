# Quickstart

From installing the app to your first proven test in about ten minutes. You need a GitHub repository whose tests run with pytest, vitest or jest (Go, JUnit, RSpec and Playwright are in Labs), and one incident that already has a fix.

## 1. Install the GitHub App

Sign in with GitHub and install the app on the repositories Aftershock may read. It asks for:

- **Checks** and **pull requests**: write, for one check run and one comment per pull request.
- **Contents**: write, used only for `aftershock/*` branches. Nothing is ever pushed to your default branch.
- **Issues**: read, to import incidents.

## 2. Bring in an incident

Choose a closed issue labelled `incident`, paste a postmortem, fill in the form, or connect an alert source such as Sentry or PagerDuty. Point it at the fix: a commit or the pull request that fixed it. Alerts wait in *Awaiting fix* until the fix merges.

Have a backlog? **Import all and time travel** brings in up to 25 closed incident issues at once.

## 3. Watch time travel

Aftershock drafts one test and runs it in a fresh sandbox: three times on the commit before the fix, three times on the fix. If it fails every time before and passes every time after, it is **proven**. Otherwise the failure is fed back and the test is redrafted, up to three times.

## 4. Merge the bot pull request

The proven test arrives as a pull request on an `aftershock/` branch, with its proof in the description. Merge it like any other change. From then on, every pull request that touches the same code runs it and gets a check:

| Verdict | Meaning |
|---|---|
| **Recur** | The memory test failed on every run: this change would bring the incident back. |
| **Safe** | Every relevant memory test passed. |
| **Inconclusive** | Mixed results or an environment error. Never green. |
| **Skipped** | No remembered incident is relevant to the files changed. |

## Next

- [Core concepts](concepts.md)
- [Alerts and tickets](integrations.md) and [notifications](notifications.md)
- [Coding agents](agents.md): MCP and `AGENTS.md`
- [Run checks on your own GitHub Actions](api.md)
