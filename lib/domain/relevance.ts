export type Selected = { id: string; selectedBy: "files" | "triage" };

/** File overlap always selects a test; model triage may only add tests, never remove them. */
export function relevantTests(
  changed: string[],
  tests: { id: string; watchedFiles: string[] }[],
  triageAdds: string[],
): { run: Selected[]; skipped: { id: string; reason: string }[] } {
  const changedSet = new Set(changed);
  const run: Selected[] = [];
  const chosen = new Set<string>();
  for (const t of tests) {
    if (t.watchedFiles.some((f) => changedSet.has(f))) {
      run.push({ id: t.id, selectedBy: "files" });
      chosen.add(t.id);
    }
  }
  const known = new Set(tests.map((t) => t.id));
  for (const id of triageAdds) {
    if (known.has(id) && !chosen.has(id)) {
      run.push({ id, selectedBy: "triage" });
      chosen.add(id);
    }
  }
  const skipped = tests.filter((t) => !chosen.has(t.id)).map((t) => ({ id: t.id, reason: "No overlap with changed files" }));
  return { run, skipped };
}
