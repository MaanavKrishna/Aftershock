import type { Epicenter } from "@/lib/db/schema";
import { findEpicenter, type Probe } from "@/lib/domain/epicenter";

type Plan = {
  memoryTestId: string;
  repoId: string;
  incidentId: string;
  workspaceId: string;
  key: string;
  chain: { sha: string; subject: string }[];
  reachedRoot: boolean;
  provenAsMissing: boolean;
  run: { repoUrl: string; fullName: string; framework: import("@/lib/runner/frameworks").Framework; install: string; testPath: string; testCode: string };
};

const DEPTH = 64;

async function plan(memoryTestId: string): Promise<Plan | null> {
  "use step";
  const { eq } = await import("drizzle-orm");
  const { getDb } = await import("@/lib/db/client");
  const s = await import("@/lib/db/schema");
  const { sourceFor } = await import("@/lib/git/source");
  const { deps } = await import("@/lib/timetravel/deps");
  const { MISSING_CODE } = await import("@/lib/runner/junit");
  const { incidentKey } = await import("@/lib/domain/ids");
  const db = await getDb();
  const [t] = await db.select().from(s.memoryTests).where(eq(s.memoryTests.id, memoryTestId));
  if (!t) return null;
  const [inc] = await db.select().from(s.incidents).where(eq(s.incidents.id, t.incidentId));
  if (!inc?.parentSha) return null;
  const [repo] = await db.select().from(s.repositories).where(eq(s.repositories.id, t.repoId));
  const [ws] = await db.select().from(s.workspaces).where(eq(s.workspaces.id, t.workspaceId));
  const token = await (await deps()).tokenFor(repo);
  const [proof] = t.runId ? await db.select({ before: s.timeTravelRuns.beforeResults }).from(s.timeTravelRuns).where(eq(s.timeTravelRuns.id, t.runId)) : [];
  const chain = await (await sourceFor(repo, token)).firstParentChain(inc.parentSha, DEPTH);
  return {
    memoryTestId, repoId: repo.id, incidentId: inc.id, workspaceId: ws.id, key: incidentKey(ws.incidentPrefix, inc.number), chain, reachedRoot: chain.length < DEPTH,
    provenAsMissing: (proof?.before ?? []).some((x) => MISSING_CODE.test(x.message ?? "")),
    run: { repoUrl: repo.cloneUrl, fullName: repo.fullName, framework: repo.framework, install: repo.installCmd, testPath: t.path, testCode: t.code },
  };
}

/** One sandbox run per step, so a long search never exceeds a single function's time limit. */
async function probe(p: Plan, sha: string): Promise<Probe> {
  "use step";
  const { deps } = await import("@/lib/timetravel/deps");
  const { codeAbsent } = await import("@/lib/runner/junit");
  const d = await deps();
  const token = await d.tokenFor({ workspaceId: p.workspaceId, fullName: p.run.fullName });
  const r = await d.runner().run({ ...p.run, token, sha, runs: 1, timeoutMs: 120_000, cache: { workspaceId: p.workspaceId, repoId: p.repoId, trusted: true } });
  const first = r.results[0];
  // A missing name only marks absent code when the proven failure itself was not that kind of error.
  if (r.installOk && first && codeAbsent(first) && !p.provenAsMissing) return "absent";
  return first?.outcome === "passed" ? "pass" : first?.outcome === "failed" ? "fail" : "error";
}

async function save(p: Plan, result: import("@/lib/domain/epicenter").EpicenterResult): Promise<void> {
  "use step";
  const { eq } = await import("drizzle-orm");
  const { getDb } = await import("@/lib/db/client");
  const s = await import("@/lib/db/schema");
  const { prFromSubject } = await import("@/lib/domain/epicenter");
  const db = await getDb();
  const epicenter: Epicenter = "sha" in result ? { sha: result.sha.slice(0, 7), prNumber: prFromSubject(result.subject), title: result.subject.slice(0, 160), testedCommits: result.testedCommits, ...(result.arrivedWithCode ? { arrivedWithCode: true } : {}) } : result;
  await db.update(s.incidents).set({ epicenter }).where(eq(s.incidents.id, p.incidentId));
  await db.insert(s.activity).values({
    workspaceId: p.workspaceId, incidentId: p.incidentId,
    title: "sha" in epicenter ? `Epicenter found for ${p.key}` : `Epicenter not found for ${p.key}`,
    detail: "sha" in epicenter ? `Introduced in ${epicenter.sha}${epicenter.prNumber ? ` · PR #${epicenter.prNumber}` : ""}${epicenter.arrivedWithCode ? " · arrived with the code it tests" : ""}` : epicenter.unavailable,
    tone: "neutral",
  });
}

/** Bisects history with a proven test to find the commit (and PR) that introduced the bug. */
export async function epicenter(memoryTestId: string): Promise<void> {
  "use workflow";
  const p = await plan(memoryTestId);
  if (!p) return;
  const result = await findEpicenter(p.chain, (sha) => probe(p, sha), 12, { reachedRoot: p.reachedRoot });
  await save(p, result);
}
