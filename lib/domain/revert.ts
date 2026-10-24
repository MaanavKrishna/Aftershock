import { applyPatch, structuredPatch } from "diff";

export type FixFile = { path: string; parent: string | null; fix: string | null; head: string | null };
export type Reverted = { ok: true; overlay: { path: string; content: string }[] } | { ok: false; reason: string };

/**
 * Builds "today's code with the fix undone": for each file the fix changed, the reverse of the fix
 * (fix → parent) is applied to the current version. Later edits elsewhere in a file are kept; if the
 * fixed lines themselves were rewritten, the revert no longer applies and the test is reported as drifted.
 */
export function revertFix(files: FixFile[]): Reverted {
  const overlay: { path: string; content: string }[] = [];
  for (const f of files) {
    if (f.parent === f.fix) continue;
    if (f.fix === null) {
      overlay.push({ path: f.path, content: f.parent ?? "" });
      continue;
    }
    if (f.head === null) return { ok: false, reason: `${f.path} no longer exists, so the fix can't be undone on the current code` };
    if (f.head === f.fix) {
      overlay.push({ path: f.path, content: f.parent ?? "" });
      continue;
    }
    if (f.parent === null) return { ok: false, reason: `${f.path} was added by the fix and has changed since the fix` };
    const reverse = structuredPatch(f.path, f.path, f.fix, f.parent, undefined, undefined, { context: 3 });
    const out = applyPatch(f.head, reverse, { fuzzFactor: 0 });
    if (out === false) return { ok: false, reason: `The lines the fix changed in ${f.path} have changed since the fix` };
    overlay.push({ path: f.path, content: out });
  }
  return overlay.length ? { ok: true, overlay } : { ok: false, reason: "The fix changed no source files to undo" };
}
