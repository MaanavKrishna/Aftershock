import { decideAdmission } from "@/lib/domain/admission";
import type { RunResult } from "@/lib/domain/verdict";
import type { RunStep } from "@/lib/db/schema";
import type { Framework } from "@/lib/runner/types";

export const RUNS_PER_COMMIT = 3;
export const DRAFTS_PER_TRAVEL = 3;

export type TravelContext = {
  incidentId: string;
  workspaceId: string;
  repoId: string;
  repoUrl: string;
  fullName: string;
  key: string;
  incident: { title: string; trigger: string; observed: string; expected: string };
  framework: Framework;
  install: string;
  testDir: string;
  fixSha: string;
  parentSha: string;
  fixTitle: string;
  changedFiles: string[];
  diff: string;
  context: { name: string; note: string; content: string }[];
  firstAttempt: number;
};

const STEP_KEYS: [string, string][] = [
  ["load", "Load incident and fix"],
  ["context", "Read context"],
  ["draft", "Draft test"],
  ["before", `Run before the fix ×${RUNS_PER_COMMIT}`],
  ["fix", `Run on the fix ×${RUNS_PER_COMMIT}`],
  ["admit", "Admit to memory"],
  ["pr", "Open bot pull request"],
];

// ---------------------------------------------------------------------------------------------
// Steps: full Node.js access, retried by the Workflow runtime, inline when called outside it.
// ---------------------------------------------------------------------------------------------

async function prepare(incidentId: string): Promise<{ ok: true; ctx: TravelContext } | { ok: false }> {
  "use step";
  const { eq } = await import("drizzle-orm");
  const { getDb } = await import("@/lib/db/client");
  const s = await import("@/lib/db/schema");
  const { incidentKey } = await import("@/lib/domain/ids");
  const git = await import("@/lib/git/local");
  const { deps } = await import("@/lib/timetravel/deps");
  const db = await getDb();
  const [inc] = await db.select().from(s.incidents).where(eq(s.incidents.id, incidentId));
  if (!inc) return { ok: false };
  const [ws] = await db.select().from(s.workspaces).where(eq(s.workspaces.id, inc.workspaceId));
  const [repo] = inc.repoId ? await db.select().from(s.repositories).where(eq(s.repositories.id, inc.repoId)) : [];
  const key = incidentKey(ws.incidentPrefix, inc.number);
  const fail = async (reason: string) => {
    await db.update(s.incidents).set({ status: "awaiting_fix", statusReason: reason, updatedAt: new Date() }).where(eq(s.incidents.id, inc.id));
    await db.insert(s.activity).values({ workspaceId: inc.workspaceId, incidentId: inc.id, title: `${key} cannot time travel yet`, detail: reason, tone: "neutral" });
    return { ok: false as const };
  };
  if (!repo) return fail("Choose the repository this incident happened in.");
  if (!inc.fixSha && !inc.fixPr) return fail("No fix linked yet. Link the fix commit or PR to start time travel.");
  try {
    const token = await (await deps()).tokenFor(repo);
    const dir = await git.gitDirFor(repo.cloneUrl, token);
    let fixRef = inc.fixSha;
    if (!fixRef && inc.fixPr) {
      const { mergeCommitForPr } = await import("@/lib/github/pulls");
      fixRef = await mergeCommitForPr(repo.fullName, inc.fixPr, token);
      if (!fixRef) return fail(`Pull request #${inc.fixPr} is not merged yet. Time travel starts when it merges.`);
    }
    const resolved = await git.resolveFix(dir, fixRef!, token);
    const context = await git.draftContext(dir, resolved.parentSha, resolved.changedFiles, repo.framework);
    const { sql } = await import("drizzle-orm");
    const [{ max }] = await db.select({ max: sql<number>`coalesce(max(${s.timeTravelRuns.attempt}), 0)` }).from(s.timeTravelRuns).where(eq(s.timeTravelRuns.incidentId, inc.id));
    await db
      .update(s.incidents)
      .set({ status: "traveling", statusReason: null, fixSha: resolved.fixSha, parentSha: resolved.parentSha, fixTitle: inc.fixTitle ?? resolved.title, updatedAt: new Date() })
      .where(eq(s.incidents.id, inc.id));
    await db.insert(s.activity).values({ workspaceId: inc.workspaceId, incidentId: inc.id, title: `${key} time travel started`, detail: `${resolved.parentSha.slice(0, 7)} → ${resolved.fixSha.slice(0, 7)}`, tone: "pending" });
    return {
      ok: true,
      ctx: {
        incidentId: inc.id, workspaceId: inc.workspaceId, repoId: repo.id, repoUrl: repo.cloneUrl, fullName: repo.fullName, key,
        incident: { title: inc.title, trigger: inc.trigger, observed: inc.observed, expected: inc.expected },
        framework: repo.framework, install: repo.installCmd, testDir: repo.testDir,
        fixSha: resolved.fixSha, parentSha: resolved.parentSha, fixTitle: resolved.title,
        changedFiles: resolved.changedFiles, diff: resolved.diff, context, firstAttempt: Number(max) + 1,
      },
    };
  } catch (err) {
    if (err instanceof git.NotReproducible) return fail(err.message);
    throw err;
  }
}

async function startAttempt(ctx: TravelContext, attempt: number): Promise<string> {
  "use step";
  const { getDb } = await import("@/lib/db/client");
  const s = await import("@/lib/db/schema");
  const db = await getDb();
  const steps: RunStep[] = STEP_KEYS.map(([key, label]) => ({ key, label, detail: "Waiting", state: "pending" }));
  steps[0] = { ...steps[0], state: "ok", detail: `${ctx.fixTitle ? `“${ctx.fixTitle}” · ` : ""}${ctx.fixSha.slice(0, 7)}, parent ${ctx.parentSha.slice(0, 7)}` };
  steps[1] = { ...steps[1], state: "ok", detail: `Fix diff and ${ctx.context.length} file${ctx.context.length === 1 ? "" : "s"}` };
  steps[2] = { ...steps[2], state: "running", detail: "Drafting" };
  const inputs = [
    { name: `incident ${ctx.key}`, note: "title + 3 fields" },
    { name: `fix diff ${ctx.fixSha.slice(0, 7)}`, note: `${ctx.changedFiles.length} file${ctx.changedFiles.length === 1 ? "" : "s"}` },
    ...ctx.context.map((c) => ({ name: c.name, note: c.note })),
  ];
  const [run] = await db.insert(s.timeTravelRuns).values({ incidentId: ctx.incidentId, attempt, status: "running", steps, inputs }).returning();
  return run.id;
}

async function patchStep(runId: string, key: string, patch: Partial<RunStep>, extra: Record<string, unknown> = {}) {
  const { eq } = await import("drizzle-orm");
  const { getDb } = await import("@/lib/db/client");
  const s = await import("@/lib/db/schema");
  const db = await getDb();
  const [run] = await db.select().from(s.timeTravelRuns).where(eq(s.timeTravelRuns.id, runId));
  const steps = run.steps.map((st) => (st.key === key ? { ...st, ...patch } : st));
  await db.update(s.timeTravelRuns).set({ steps, ...extra }).where(eq(s.timeTravelRuns.id, runId));
}

type DraftOutcome = { ok: true; path: string; code: string; model: string } | { ok: false; reason: string; fatal: boolean };

async function draftTest(runId: string, ctx: TravelContext, feedback?: string, hint?: string, previous?: string): Promise<DraftOutcome> {
  "use step";
  const { deps } = await import("@/lib/timetravel/deps");
  const { safeTestPath } = await import("@/lib/runner/paths");
  const started = Date.now();
  try {
    const d = await (await deps()).drafter().draft({ key: ctx.key, incident: ctx.incident, framework: ctx.framework, testDir: ctx.testDir, fixTitle: ctx.fixTitle, diff: ctx.diff, changedFiles: ctx.changedFiles, context: ctx.context, feedback, hint, previous });
    const path = safeTestPath(d.path);
    if (!path.startsWith(ctx.testDir.replace(/\/$/, "") + "/")) throw Object.assign(new Error(`The draft must live under ${ctx.testDir}/`), { name: "InvalidModelOutput" });
    await patchStep(runId, "draft", { state: "ok", detail: `${d.model}${feedback ? " · with the previous failure as feedback" : ""}`, ms: Date.now() - started }, { testPath: path, testCode: d.code, model: d.model, tokens: d.tokens ?? null });
    await patchStep(runId, "before", { state: "running", detail: "Running" });
    return { ok: true, path, code: d.code, model: d.model };
  } catch (err) {
    const message = err instanceof Error ? err.message : "The model did not return a draft.";
    const invalid = err instanceof Error && (err.name === "InvalidModelOutput" || /Unsafe test path/.test(message));
    await patchStep(runId, "draft", { state: "bad", detail: message, ms: Date.now() - started });
    return { ok: false, reason: invalid ? `The model’s draft was rejected: ${message}` : message, fatal: !invalid };
  }
}

async function runOn(runId: string, ctx: TravelContext, which: "before" | "fix", draft: { path: string; code: string }): Promise<{ results: RunResult[]; log: string }> {
  "use step";
  const { deps } = await import("@/lib/timetravel/deps");
  const { getDb } = await import("@/lib/db/client");
  const s = await import("@/lib/db/schema");
  const { sql } = await import("drizzle-orm");
  const d = await deps();
  const token = await d.tokenFor({ workspaceId: ctx.workspaceId, fullName: ctx.fullName });
  const sha = which === "before" ? ctx.parentSha : ctx.fixSha;
  const report = await d.runner().run({ repoUrl: ctx.repoUrl, token, sha, framework: ctx.framework, install: ctx.install, testPath: draft.path, testCode: draft.code, runs: RUNS_PER_COMMIT, timeoutMs: 120_000 });
  const outcomes = report.results.map((r) => r.outcome);
  const failed = outcomes.filter((o) => o === "failed").length;
  const passed = outcomes.filter((o) => o === "passed").length;
  const errored = outcomes.length - failed - passed;
  const detail = errored ? `Environment error: ${report.results.find((r) => r.outcome === "error")?.message ?? "the test did not run"}` : which === "before" ? (failed === outcomes.length ? `Failed ${failed}/${outcomes.length} — the incident reproduces` : `Passed ${passed}/${outcomes.length} — expected failures`) : `Passed ${passed}/${outcomes.length}`;
  const good = !errored && (which === "before" ? failed === outcomes.length : passed === outcomes.length);
  await patchStep(runId, which, { state: good ? "ok" : "bad", detail, ms: report.wallMs }, which === "before" ? { beforeResults: report.results, runner: d.runner().kind } : { fixResults: report.results });
  const db = await getDb();
  const month = new Date().toISOString().slice(0, 7);
  if (d.runner().kind === "sandbox") {
    await db.insert(s.usage).values({ workspaceId: ctx.workspaceId, month, sandboxCpuMs: report.cpuMs }).onConflictDoUpdate({ target: [s.usage.workspaceId, s.usage.month], set: { sandboxCpuMs: sql`${s.usage.sandboxCpuMs} + ${report.cpuMs}` } });
  }
  await db.update(s.timeTravelRuns).set({ cpuMs: sql`${s.timeTravelRuns.cpuMs} + ${report.cpuMs}`, wallMs: sql`${s.timeTravelRuns.wallMs} + ${report.wallMs}` }).where(sql`${s.timeTravelRuns.id} = ${runId}`);
  return { results: report.results, log: `# ${which === "before" ? "before the fix" : "on the fix"} · ${sha.slice(0, 7)}\n${report.log}` };
}

async function finishAttempt(runId: string, status: "proven" | "rejected" | "unproven", reason: string, feedback: string | undefined, log: string): Promise<void> {
  "use step";
  const { eq } = await import("drizzle-orm");
  const { getDb } = await import("@/lib/db/client");
  const s = await import("@/lib/db/schema");
  const db = await getDb();
  const [run] = await db.select().from(s.timeTravelRuns).where(eq(s.timeTravelRuns.id, runId));
  const steps = run.steps.map((st) => (st.state === "pending" || st.state === "running" ? { ...st, state: "skip" as const, detail: status === "proven" ? st.detail : "Skipped" } : st));
  await db.update(s.timeTravelRuns).set({ status, reason, feedback: feedback ?? null, log: log.slice(-20_000), steps, finishedAt: new Date() }).where(eq(s.timeTravelRuns.id, runId));
}

async function admit(runId: string, ctx: TravelContext, draft: { path: string; code: string }): Promise<string> {
  "use step";
  const { eq } = await import("drizzle-orm");
  const { getDb } = await import("@/lib/db/client");
  const s = await import("@/lib/db/schema");
  const db = await getDb();
  const fn = draft.code.match(/def (test_\w+)/)?.[1] ?? draft.code.match(/\b(?:test|it)\(\s*["'`]([^"'`]+)/)?.[1] ?? draft.path.split("/").pop()!;
  const watched = ctx.changedFiles.filter((f) => !f.startsWith(ctx.testDir) && !/(^|\/)(tests?|__tests__)\//.test(f));
  const [mem] = await db
    .insert(s.memoryTests)
    .values({ workspaceId: ctx.workspaceId, incidentId: ctx.incidentId, repoId: ctx.repoId, runId, path: draft.path, fn, code: draft.code, health: "healthy", nights: [] })
    .returning();
  await db.update(s.incidents).set({ status: "proven", statusReason: null, watchedFiles: watched.length ? watched : ctx.changedFiles, updatedAt: new Date() }).where(eq(s.incidents.id, ctx.incidentId));
  await db.insert(s.activity).values({ workspaceId: ctx.workspaceId, incidentId: ctx.incidentId, title: `${ctx.key} proven · ${RUNS_PER_COMMIT}/${RUNS_PER_COMMIT} fail, ${RUNS_PER_COMMIT}/${RUNS_PER_COMMIT} pass`, detail: draft.path, tone: "pass" });
  await patchStep(runId, "admit", { state: "ok", detail: "Stored with evidence and both commit SHAs" });
  return mem.id;
}

async function proposeTest(runId: string, memoryTestId: string, ctx: TravelContext, draft: { path: string; code: string }): Promise<void> {
  "use step";
  const { eq } = await import("drizzle-orm");
  const { getDb } = await import("@/lib/db/client");
  const s = await import("@/lib/db/schema");
  const { deps } = await import("@/lib/timetravel/deps");
  const db = await getDb();
  const pr = await (await deps()).openBotPr({ workspaceId: ctx.workspaceId, repoId: ctx.repoId, incidentId: ctx.incidentId, key: ctx.key, title: ctx.incident.title, path: draft.path, code: draft.code, parentSha: ctx.parentSha, fixSha: ctx.fixSha });
  if (pr) {
    await db.update(s.memoryTests).set({ botPr: pr, botPrState: "open" }).where(eq(s.memoryTests.id, memoryTestId));
    await db.insert(s.activity).values({ workspaceId: ctx.workspaceId, incidentId: ctx.incidentId, title: `Bot opened PR #${pr} with the test`, detail: draft.path, tone: "neutral" });
  }
  await patchStep(runId, "pr", { state: pr ? "ok" : "skip", detail: pr ? `PR #${pr} adds the test file` : "GitHub App not installed — download the test from this page" });
}

async function afterProven(memoryTestId: string): Promise<void> {
  "use step";
  const { startRetroCheck, startEpicenter } = await import("./start");
  await startEpicenter(memoryTestId);
  await startRetroCheck(memoryTestId);
}

async function markUnproven(ctx: TravelContext, reason: string): Promise<void> {
  "use step";
  const { eq } = await import("drizzle-orm");
  const { getDb } = await import("@/lib/db/client");
  const s = await import("@/lib/db/schema");
  const db = await getDb();
  await db.update(s.incidents).set({ status: "unproven", statusReason: reason, updatedAt: new Date() }).where(eq(s.incidents.id, ctx.incidentId));
  await db.insert(s.activity).values({ workspaceId: ctx.workspaceId, incidentId: ctx.incidentId, title: `${ctx.key} unproven`, detail: reason, tone: "neutral" });
}

// ---------------------------------------------------------------------------------------------
// Workflow: deterministic orchestration. Every side effect happens in a step above.
// ---------------------------------------------------------------------------------------------

export async function timeTravel(incidentId: string, opts: { hint?: string }): Promise<{ status: string }> {
  "use workflow";
  const prepared = await prepare(incidentId);
  if (!prepared.ok) return { status: "not_reproducible" };
  const ctx = prepared.ctx;
  let feedback: string | undefined;
  let previous: string | undefined;
  let lastReason = "Every draft passed before the fix.";
  for (let i = 0; i < DRAFTS_PER_TRAVEL; i++) {
    const attempt = ctx.firstAttempt + i;
    const runId = await startAttempt(ctx, attempt);
    const draft = await draftTest(runId, ctx, feedback, i === 0 ? opts.hint : undefined, previous);
    if (!draft.ok) {
      await finishAttempt(runId, "unproven", draft.reason, undefined, "");
      lastReason = draft.reason;
      if (draft.fatal) break;
      continue;
    }
    const before = await runOn(runId, ctx, "before", draft);
    const quick = decideAdmission(before.results, before.results.map(() => ({ outcome: "passed" as const, durationMs: 0 })), RUNS_PER_COMMIT);
    if (quick.status !== "proven") {
      await finishAttempt(runId, quick.status, quick.reason, quick.feedback, before.log);
      lastReason = quick.reason;
      if (!quick.feedback) break; // environment errors: redrafting cannot help
      feedback = quick.feedback;
      previous = draft.code;
      continue;
    }
    const fix = await runOn(runId, ctx, "fix", draft);
    const decision = decideAdmission(before.results, fix.results, RUNS_PER_COMMIT);
    await finishAttempt(runId, decision.status, decision.reason, decision.feedback, `${before.log}\n\n${fix.log}`);
    if (decision.status === "proven") {
      const memoryTestId = await admit(runId, ctx, draft);
      await proposeTest(runId, memoryTestId, ctx, draft);
      await afterProven(memoryTestId);
      return { status: "proven" };
    }
    lastReason = decision.reason;
    if (!decision.feedback) break;
    feedback = decision.feedback;
    previous = draft.code;
  }
  await markUnproven(ctx, lastReason);
  return { status: "unproven" };
}
