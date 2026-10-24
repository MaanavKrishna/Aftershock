# Core concepts

| Term | Meaning |
|---|---|
| **Incident** | A failure you never want back: what triggered it, what happened, and what should have happened. |
| **Fix** | The commit (or merged pull request) that resolved it. Its parent is "before the fix". |
| **Draft** | A test a model wrote. It proves nothing until time travel runs it. |
| **Time travel** | Running the draft on the commit before the fix and on the fix, three times each, in a fresh sandbox. |
| **Proven** | Failed 3 of 3 before the fix and passed 3 of 3 on it. The test is admitted to memory. |
| **Memory** | Your proven tests, each tied to its incident and its proof. An incident can have several. |
| **Guard** | The pull request check that runs the relevant memory tests on every change. |
| **Risk** | How close a change comes to code behind past incidents, shown on every check. |
| **Epicenter** | The commit, and pull request, that first introduced the bug, found by bisecting history with the proven test. |
| **Still guarding** | A weekly re-proof: the fix is undone on today's code and the test must fail again. |
| **Strength** | The share of small changes to the fixed lines that a test catches (mutation testing). |

## Rules that never bend

- A model never marks anything proven or safe. Only test runs do.
- A test that passes before the fix is rejected, however good it looks.
- Mixed results are inconclusive, never green.
- Nothing is pushed to your default branch. Tests arrive as pull requests.
- Sandboxed runs never receive your secrets, and have no network while tests run.

## Two kinds of verdict

Time travel decides whether a test is admitted: **proven**, **rejected** (it passed before the fix, so it doesn't reproduce the incident) or **unproven** (mixed results, environment errors, or every redraft failed).

Pull request checks decide whether a change reopens an incident: **Recur**, **Safe**, **Inconclusive** or **Skipped**. A Recur check fails the pull request in blocking mode and is a warning in advisory mode; an admin can override it with a reason, which is kept in the audit evidence.

## Current limits

- GitHub only. GitLab and Bitbucket are not supported yet.
- Tests that need live third-party services can't be proven in the sandbox. Run those on your own runners with fixtures.
- Incidents without a fix stay in *Awaiting fix*; nothing is proven by guesswork.
