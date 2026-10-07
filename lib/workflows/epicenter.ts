import type { Epicenter } from "@/lib/db/schema";
/** Bisects history with a proven test to find the commit (and PR) that introduced the bug. */
async function search(memoryTestId: string): Promise<void> {
  "use step";
  const { eq } = await import("drizzle-orm");
  const { getDb } = await import("@/lib/db/client");
  const s = await import("@/lib/db/schema");
  const { sourceFor } = await import("@/lib/git/source");
  const { deps } = await import("@/lib/timetravel/deps");
  const { findEpicenter, prFromSubject } = await import("@/lib/domain/epicenter");
  const { incidentKey } = await import("@/lib/domain/ids");
  const db = await getDb();
  const [t] = await db.select().from(s.memoryTests).where(eq(s.memoryTests.id, memoryTestId));
  if (!t) return;
  const [inc] = await db.select().from(s.incidents).where(eq(s.incidents.id, t.incidentId));
  const [repo] = await db.select().from(s.repositories).where(eq(s.repositories.id, t.repoId));
  const [ws] = await db.select().from(s.workspaces).where(eq(s.workspaces.id, t.workspaceId));
  if (!inc.parentSha) return;
  const d = await deps();
  const token = await d.tokenFor(repo);
  const chain = await (await sourceFor(repo, token)).firstParentChain(inc.parentSha, 64);
  const result = await findEpicenter(chain, async (sha) => {
    const r = await d.runner().run({ repoUrl: repo.cloneUrl, token, sha, framework: repo.framework, install: repo.installCmd, testPath: t.path, testCode: t.code, runs: 1, timeoutMs: 120_000 });
    const o = r.results[0]?.outcome;
    return o === "passed" ? "pass" : o === "failed" ? "fail" : "error";
  });
  const epicenter: Epicenter = "sha" in result ? { sha: result.sha.slice(0, 7), prNumber: prFromSubject(result.subject), title: result.subject.slice(0, 160), testedCommits: result.testedCommits } : result;
  await db.update(s.incidents).set({ epicenter }).where(eq(s.incidents.id, inc.id));
  await db.insert(s.activity).values({
    workspaceId: ws.id, incidentId: inc.id,
    title: "sha" in epicenter ? `Epicenter found for ${incidentKey(ws.incidentPrefix, inc.number)}` : `Epicenter not found for ${incidentKey(ws.incidentPrefix, inc.number)}`,
    detail: "sha" in epicenter ? `Introduced in ${epicenter.sha}${epicenter.prNumber ? ` · PR #${epicenter.prNumber}` : ""}` : epicenter.unavailable,
    tone: "neutral",
  });
}

export async function epicenter(memoryTestId: string): Promise<void> {
  "use workflow";
  await search(memoryTestId);
}
