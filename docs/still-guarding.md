# Still guarding

A memory test was proven once: it failed on the commit before the fix and passed on the fix. Code keeps moving, though, and a test can quietly stop catching the bug. For example, a refactor might mock the function the test exercised. A re-proof checks that the test still guards.

Turn on **Weekly still-guarding re-proof** in **Settings → Labs**. Re-proofs run every Sunday (UTC) from the daily job. **Re-prove now** on the Memory page runs one at any time.

## How it works

1. Take the default branch as it is today.
2. Undo the fix there. For every source file the fix changed, the reverse of the fix (fix → the commit before it) is applied to today's version. Later edits elsewhere in the file are kept. Test files are left alone.
3. Run the memory test twice on that code, in the same isolated runner as every other run.

| Result | Status | What it means |
|---|---|---|
| Fails both times | **Still guarding** | Bring the bug back and this test catches it. |
| Passes both times | **Weak** | The bug could come back unnoticed. Re-draft or strengthen the test. |
| The fix can't be undone any more | **Drifted** | The fixed lines were rewritten, moved or deleted since. The test may still be fine; review it against the new code. |
| Mixed or environment errors | unchanged | Nothing is concluded from noise. |

Tests that are failing on main, or quarantined, are skipped until they are healthy again. Status changes to Weak or Drifted are written to the activity feed and sent as the `test.weakened` notification.

Re-proofs on the hosted sandbox count toward sandbox hours, like every other run.
