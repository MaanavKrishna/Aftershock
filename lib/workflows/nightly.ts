/** Runs one memory test once on the default branch and updates its 14-night health. */
async function runNightly(memoryTestId: string): Promise<void> {
  "use step";
  const { eq } = await import("drizzle-orm");
  const { getDb } = await import("@/lib/db/client");
  const s = await import("@/lib/db/schema");
  const git = await import("@/lib/git/local");
  const { deps } = await import("@/lib/timetravel/deps");
  const { healthFrom } = await import("@/lib/domain/epicenter");
  const db = await getDb();
  const [t] = await db.select().from(s.memoryTests).where(eq(s.memoryTests.id, memoryTestId));
  if (!t) return;
  const [repo] = await db.select().from(s.repositories).where(eq(s.repositories.id, t.repoId));
  const d = await deps();
  const token = await d.tokenFor(repo);
  const dir = await git.gitDirFor(repo.cloneUrl, token);
  const head = await git.revParse(dir, repo.defaultBranch);
  if (!head) return;
  const report = await d.runner().run({ repoUrl: repo.cloneUrl, token, sha: head, framework: repo.framework, install: repo.installCmd, testPath: t.path, testCode: t.code, runs: 1, timeoutMs: 120_000 });
  const outcome = report.results[0]?.outcome;
  if (outcome === "error" || !outcome) return; // environment failures say nothing about the code
  const nights = [...t.nights, outcome === "passed"].slice(-14);
  const health = healthFrom(nights);
  await db.update(s.memoryTests).set({ nights, health }).where(eq(s.memoryTests.id, t.id));
  if (health === "failing" && t.health !== "failing") {
    await db.insert(s.activity).values({ workspaceId: t.workspaceId, incidentId: t.incidentId, title: "Memory test failing on main", detail: `${t.path} at ${head.slice(0, 7)}`, tone: "fail" });
  }
}

export async function nightly(memoryTestId: string): Promise<void> {
  "use workflow";
  await runNightly(memoryTestId);
}
