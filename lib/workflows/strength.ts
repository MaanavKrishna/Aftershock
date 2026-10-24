import type { Strength } from "@/lib/domain/mutation";

/** At most this many mutants per memory test, so a measurement costs a bounded number of runs. */
export const MAX_MUTANTS = 12;
/** Below this score the test is called out as weak. */
export const WEAK_BELOW = 60;

type Plan = {
  memoryTestId: string; workspaceId: string; repoId: string; incidentId: string; key: string;
  run: { repoUrl: string; fullName: string; framework: import("@/lib/runner/frameworks").Framework; install: string; workdir: string; testPath: string; testCode: string };
  fixSha: string;
  mutants: { file: string; line: number; from: string; to: string; content: string }[];
};

async function plan(memoryTestId: string): Promise<Plan | null> {
  "use step";
  const { eq } = await import("drizzle-orm");
  const { getDb } = await import("@/lib/db/client");
  const s = await import("@/lib/db/schema");
  const { flagEnabled } = await import("@/lib/flags");
  const { sourceFor } = await import("@/lib/git/source");
  const { deps } = await import("@/lib/timetravel/deps");
  const { frameworkDef } = await import("@/lib/runner/frameworks");
  const { mutantsFor } = await import("@/lib/domain/mutation");
  const { incidentKey } = await import("@/lib/domain/ids");
  const db = await getDb();
  const [t] = await db.select().from(s.memoryTests).where(eq(s.memoryTests.id, memoryTestId));
  if (!t) return null;
  const [ws] = await db.select().from(s.workspaces).where(eq(s.workspaces.id, t.workspaceId));
  const [inc] = await db.select().from(s.incidents).where(eq(s.incidents.id, t.incidentId));
  const [repo] = await db.select().from(s.repositories).where(eq(s.repositories.id, t.repoId));
  if (!ws || !inc?.fixSha || !repo || !flagEnabled("testStrength", ws.settings)) return null;
  const src = await sourceFor(repo, await (await deps()).tokenFor(repo));
  const resolved = await src.resolveFix(inc.fixSha);
  const parentSha = inc.parentSha ?? resolved.parentSha;
  const def = frameworkDef(t.framework ?? repo.framework);
  const mutants: Plan["mutants"] = [];
  for (const f of resolved.changedFiles.filter((x) => x !== t.path && !def.isTestFile(x))) {
    const fixed = await src.readFileAt(resolved.fixSha, f, 400_000);
    if (fixed === null) continue;
    mutants.push(...mutantsFor(f, (await src.readFileAt(parentSha, f, 400_000)) ?? "", fixed));
    if (mutants.length >= MAX_MUTANTS) break;
  }
  return {
    memoryTestId, workspaceId: t.workspaceId, repoId: t.repoId, incidentId: t.incidentId, key: incidentKey(ws.incidentPrefix, inc.number), fixSha: resolved.fixSha,
    run: { repoUrl: repo.cloneUrl, fullName: repo.fullName, framework: t.framework ?? repo.framework, install: t.installCmd ?? repo.installCmd, workdir: t.workdir, testPath: t.path, testCode: t.code },
    mutants: mutants.slice(0, MAX_MUTANTS),
  };
}

/** One mutant: the fix commit with one small change. Failing means the test caught it. */
async function runMutant(p: Plan, i: number): Promise<"killed" | "survived" | "error"> {
  "use step";
  const { deps } = await import("@/lib/timetravel/deps");
  const { meterSandbox } = await import("@/lib/billing/meter");
  const d = await deps();
  const m = p.mutants[i];
  const token = await d.tokenFor({ workspaceId: p.workspaceId, fullName: p.run.fullName });
  const r = await d.runner().run({ ...p.run, token, sha: p.fixSha, runs: 1, timeoutMs: 120_000, overlay: [{ path: m.file, content: m.content }], cache: { workspaceId: p.workspaceId, repoId: p.repoId, trusted: true } });
  await meterSandbox(p.workspaceId, r.cpuMs, d.runner().kind);
  const o = r.results[0]?.outcome;
  return o === "failed" ? "killed" : o === "passed" ? "survived" : "error";
}

async function save(p: Plan, outcomes: ("killed" | "survived" | "error")[]): Promise<Strength | null> {
  "use step";
  const { eq } = await import("drizzle-orm");
  const { getDb } = await import("@/lib/db/client");
  const s = await import("@/lib/db/schema");
  const { strengthOf } = await import("@/lib/domain/mutation");
  const counted = p.mutants.map((m, i) => ({ ...m, outcome: outcomes[i] })).filter((m) => m.outcome !== "error");
  if (!counted.length) return null;
  const st = { ...strengthOf(counted.map(({ file, line, from, to, outcome }) => ({ file, line, from: from.trim(), to: to, killed: outcome === "killed" }))), checkedAt: new Date().toISOString() };
  await (await getDb()).update(s.memoryTests).set({ strength: st }).where(eq(s.memoryTests.id, p.memoryTestId));
  if (st.score < WEAK_BELOW) {
    const first = st.survivors[0];
    await (await import("@/lib/notify/outbox")).recordActivity({
      workspaceId: p.workspaceId, incidentId: p.incidentId, title: `${p.key}'s test misses small changes to the fix`,
      detail: `Strength ${st.score}% (${st.killed}/${st.total}).${first ? ` It still passes when ${first.file}:${first.line} reads “${first.to.trim()}”.` : ""} Use “Prove another test” to harden it.`.slice(0, 400),
      tone: "neutral",
    });
  }
  return st;
}

/** Measures how precisely a proven test pins down its fix, by mutating the lines the fix added. */
export async function strength(memoryTestId: string): Promise<Strength | null> {
  "use workflow";
  const p = await plan(memoryTestId);
  if (!p || !p.mutants.length) return null;
  const outcomes: ("killed" | "survived" | "error")[] = [];
  for (let i = 0; i < p.mutants.length; i++) outcomes.push(await runMutant(p, i));
  return save(p, outcomes);
}
