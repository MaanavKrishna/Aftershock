/** Runs one memory test once on the default branch and updates its 14-night health. */
export async function runNightly(memoryTestId: string): Promise<void> {
  "use step";
  const { eq } = await import("drizzle-orm");
  const { getDb } = await import("@/lib/db/client");
  const s = await import("@/lib/db/schema");
  const { sourceFor } = await import("@/lib/git/source");
  const { deps } = await import("@/lib/timetravel/deps");
  const { healthFrom } = await import("@/lib/domain/epicenter");
  const db = await getDb();
  const [t] = await db.select().from(s.memoryTests).where(eq(s.memoryTests.id, memoryTestId));
  if (!t) return;
  const [repo] = await db.select().from(s.repositories).where(eq(s.repositories.id, t.repoId));
  const d = await deps();
  const token = await d.tokenFor(repo);
  const head = await (await sourceFor(repo, token)).revParse(repo.defaultBranch);
  if (!head) return;
  const report = await d.runner().run({ repoUrl: repo.cloneUrl, token, sha: head, framework: t.framework ?? repo.framework, install: t.installCmd ?? repo.installCmd, workdir: t.workdir, testPath: t.path, testCode: t.code, runs: 1, timeoutMs: 120_000, cache: { workspaceId: t.workspaceId, repoId: t.repoId, trusted: true } });
  const outcome = report.results[0]?.outcome;
  if (outcome === "error" || !outcome) return; // environment failures say nothing about the code
  const nights = [...t.nights, outcome === "passed"].slice(-14);
  const health = healthFrom(nights);
  const { quarantineDecision } = await import("@/lib/domain/quarantine");
  const q = quarantineDecision(nights, t.quarantined);
  await db
    .update(s.memoryTests)
    .set({ nights, health, quarantined: q.quarantined, quarantineReason: q.reason, quarantinedAt: q.quarantined ? (t.quarantinedAt ?? new Date()) : null })
    .where(eq(s.memoryTests.id, t.id));
  if (q.quarantined !== t.quarantined) {
    await (await import("@/lib/notify/outbox")).recordActivity({
      workspaceId: t.workspaceId, incidentId: t.incidentId,
      title: q.quarantined ? "Memory test quarantined" : "Memory test released from quarantine",
      detail: q.quarantined ? `${q.reason}. It no longer blocks pull requests until it is stable.` : "Seven green nights in a row.",
      tone: q.quarantined ? "neutral" : "pass", event: q.quarantined ? ("test.quarantined" as const) : undefined });
  }
  if (health === "failing" && t.health !== "failing") {
    await (await import("@/lib/notify/outbox")).recordActivity({ workspaceId: t.workspaceId, incidentId: t.incidentId, title: "Memory test failing on main", detail: `${t.path} at ${head.slice(0, 7)}`, tone: "fail", event: "nightly.failing" as const });
  }
}

export async function nightly(memoryTestId: string): Promise<void> {
  "use workflow";
  await runNightly(memoryTestId);
}
