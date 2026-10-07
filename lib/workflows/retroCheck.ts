/** A newly proven test runs at once against every pull request that is still open in its repository. */
async function requeue(memoryTestId: string): Promise<string[]> {
  "use step";
  const { and, desc, eq, gte } = await import("drizzle-orm");
  const { getDb } = await import("@/lib/db/client");
  const s = await import("@/lib/db/schema");
  const { github } = await import("@/lib/github/api");
  const db = await getDb();
  const [t] = await db.select().from(s.memoryTests).where(eq(s.memoryTests.id, memoryTestId));
  if (!t) return [];
  const [repo] = await db.select().from(s.repositories).where(eq(s.repositories.id, t.repoId));
  const open = await github.openPullRequests(repo.workspaceId, repo.fullName);
  const since = new Date(Date.now() - 14 * 86_400_000);
  const recent = await db.select().from(s.prChecks).where(and(eq(s.prChecks.repoId, repo.id), gte(s.prChecks.createdAt, since))).orderBy(desc(s.prChecks.createdAt));
  const latest = new Map<number, (typeof recent)[number]>();
  for (const c of recent) if (!latest.has(c.prNumber)) latest.set(c.prNumber, c);
  const ids: string[] = [];
  for (const [pr, c] of latest) {
    if (open && !open.includes(pr)) continue;
    if (c.status !== "done") continue;
    const [copy] = await db
      .insert(s.prChecks)
      .values({ workspaceId: c.workspaceId, repoId: c.repoId, prNumber: c.prNumber, title: c.title, headSha: c.headSha, baseSha: c.baseSha, filesChanged: c.filesChanged, changedFiles: c.changedFiles, diff: c.diff, status: "queued", checkRunId: await github.createCheckRun(c.workspaceId, repo.fullName, c.headSha), commentId: c.commentId })
      .returning();
    ids.push(copy.id);
  }
  return ids;
}

async function launch(checkId: string): Promise<void> {
  "use step";
  const { startPrCheck } = await import("./start");
  await startPrCheck(checkId);
}

export async function retroCheck(memoryTestId: string): Promise<void> {
  "use workflow";
  const ids = await requeue(memoryTestId);
  for (const id of ids) await launch(id);
}
