import type { GuardStatus } from "@/lib/db/schema";

export type ReproofOutcome = "guarding" | "weak" | "drifted" | "inconclusive" | "skipped";

/**
 * Still guarding? Undoes the incident's fix on today's default branch (keeping later edits) and runs
 * the memory test there twice. Failing both times means it still catches the bug; passing both times
 * means it no longer would (weak); a fix that can't be undone any more is drifted.
 */
export async function runReproof(memoryTestId: string): Promise<ReproofOutcome> {
  "use step";
  const { eq } = await import("drizzle-orm");
  const { getDb } = await import("@/lib/db/client");
  const s = await import("@/lib/db/schema");
  const { flagEnabled } = await import("@/lib/flags");
  const { sourceFor } = await import("@/lib/git/source");
  const { deps } = await import("@/lib/timetravel/deps");
  const { frameworkDef } = await import("@/lib/runner/frameworks");
  const { revertFix } = await import("@/lib/domain/revert");
  const { incidentKey } = await import("@/lib/domain/ids");
  const { meterSandbox } = await import("@/lib/billing/meter");
  const db = await getDb();
  const [t] = await db.select().from(s.memoryTests).where(eq(s.memoryTests.id, memoryTestId));
  if (!t) return "skipped";
  const [ws] = await db.select().from(s.workspaces).where(eq(s.workspaces.id, t.workspaceId));
  const [inc] = await db.select().from(s.incidents).where(eq(s.incidents.id, t.incidentId));
  const [repo] = await db.select().from(s.repositories).where(eq(s.repositories.id, t.repoId));
  if (!ws || !inc || !repo || repo.archivedAt || !flagEnabled("reproof", ws.settings)) return "skipped";
  if (t.health === "failing" || t.quarantined || !inc.fixSha) return "skipped"; // nothing to learn until it passes on main again

  const d = await deps();
  const token = await d.tokenFor(repo);
  const src = await sourceFor(repo, token);
  const head = await src.revParse(repo.defaultBranch);
  if (!head) return "skipped";
  const resolved = await src.resolveFix(inc.fixSha);
  const parentSha = inc.parentSha ?? resolved.parentSha;
  const def = frameworkDef(t.framework ?? repo.framework);
  const sources = resolved.changedFiles.filter((f) => f !== t.path && !def.isTestFile(f));
  const files = await Promise.all(
    sources.map(async (path) => ({ path, parent: await src.readFileAt(parentSha, path, 400_000), fix: await src.readFileAt(resolved.fixSha, path, 400_000), head: await src.readFileAt(head, path, 400_000) })),
  );
  const reverted = revertFix(files);
  const key = incidentKey(ws.incidentPrefix, inc.number);

  const save = async (status: GuardStatus, detail: string) => {
    await db.update(s.memoryTests).set({ guardStatus: status, guardCheckedAt: new Date(), guardSha: head, guardDetail: detail.slice(0, 500) }).where(eq(s.memoryTests.id, t.id));
    if (status !== "guarding" && t.guardStatus !== status) {
      const { recordActivity } = await import("@/lib/notify/outbox");
      await recordActivity({ workspaceId: t.workspaceId, incidentId: t.incidentId, title: `Memory test no longer guards ${key}`, detail: `${status === "weak" ? "Weak" : "Drifted"}: ${detail}`.slice(0, 300), tone: "fail", event: "test.weakened" });
    }
  };

  if (!reverted.ok) {
    await save("drifted", reverted.reason);
    return "drifted";
  }
  const report = await d.runner().run({
    repoUrl: repo.cloneUrl, token, sha: head, framework: t.framework ?? repo.framework, install: t.installCmd ?? repo.installCmd, workdir: t.workdir,
    testPath: t.path, testCode: t.code, runs: 2, timeoutMs: 120_000, overlay: reverted.overlay, cache: { workspaceId: t.workspaceId, repoId: t.repoId, trusted: true },
  });
  await meterSandbox(t.workspaceId, report.cpuMs, d.runner().kind);
  const outcomes = report.results.map((r) => r.outcome);
  if (outcomes.length && outcomes.every((o) => o === "failed")) {
    await save("guarding", `Fails ${outcomes.length}/${outcomes.length} with the fix undone at ${head.slice(0, 7)}`);
    return "guarding";
  }
  if (outcomes.length && outcomes.every((o) => o === "passed")) {
    await save("weak", `Passes ${outcomes.length}/${outcomes.length} even with the fix undone at ${head.slice(0, 7)}. Re-draft or harden the test.`);
    return "weak";
  }
  return "inconclusive";
}

export async function reproof(memoryTestId: string): Promise<void> {
  "use workflow";
  await runReproof(memoryTestId);
}
