import type { RunResult } from "@/lib/domain/verdict";
import type { TraceStep } from "@/lib/db/schema";

export const PR_RUNS = 3;

type Selected = { memoryTestId: string; incidentId: string; key: string; title: string; path: string; code: string; selectedBy: "files" | "triage"; why: string };
type Plan =
  | { ok: false }
  | {
      ok: true;
      checkId: string;
      workspaceId: string;
      repo: { id: string; url: string; fullName: string; framework: "pytest" | "vitest" | "jest"; install: string; mode: "blocking" | "advisory" };
      headSha: string;
      testedSha: string;
      mode: "run" | "actions" | "unavailable";
      selected: Selected[];
      skips: { incidentId: string; reason: string }[];
    };

async function plan(checkId: string): Promise<Plan> {
  "use step";
  const { eq, and } = await import("drizzle-orm");
  const { getDb } = await import("@/lib/db/client");
  const s = await import("@/lib/db/schema");
  const { relevantTests } = await import("@/lib/domain/relevance");
  const { incidentKey } = await import("@/lib/domain/ids");
  const { pickRunner } = await import("@/lib/runner/select");
  const { triageIncidents } = await import("@/lib/model/triage");
  const { scoped, SANDBOX_ALLOWANCE_MS } = await import("@/lib/db/queries/scope");
  const db = await getDb();
  const [check] = await db.select().from(s.prChecks).where(eq(s.prChecks.id, checkId));
  if (!check) return { ok: false };
  const [repo] = await db.select().from(s.repositories).where(eq(s.repositories.id, check.repoId));
  const [ws] = await db.select().from(s.workspaces).where(eq(s.workspaces.id, check.workspaceId));
  await db.delete(s.prCheckResults).where(eq(s.prCheckResults.checkId, checkId));
  await db.delete(s.prCheckSkips).where(eq(s.prCheckSkips.checkId, checkId));
  const tests = await db
    .select({ t: s.memoryTests, i: s.incidents })
    .from(s.memoryTests)
    .innerJoin(s.incidents, eq(s.incidents.id, s.memoryTests.incidentId))
    .where(eq(s.memoryTests.repoId, repo.id));
  const fileSelected = relevantTests(check.changedFiles, tests.map((x) => ({ id: x.t.id, watchedFiles: x.i.watchedFiles })), []);
  const candidates = tests.filter((x) => !fileSelected.run.some((r) => r.id === x.t.id)).map((x) => ({ id: x.t.id, key: incidentKey(ws.incidentPrefix, x.i.number), title: x.i.title, expected: x.i.expected, files: x.i.watchedFiles }));
  const adds = candidates.length && fileSelected.run.length < tests.length ? await triageIncidents(ws.id, { title: check.title, diff: check.diff }, candidates) : [];
  const sel = relevantTests(check.changedFiles, tests.map((x) => ({ id: x.t.id, watchedFiles: x.i.watchedFiles })), adds);
  const byId = Object.fromEntries(tests.map((x) => [x.t.id, x]));
  const selected: Selected[] = sel.run.map((r) => {
    const x = byId[r.id];
    const touched = check.changedFiles.find((f) => x.i.watchedFiles.includes(f));
    return { memoryTestId: x.t.id, incidentId: x.i.id, key: incidentKey(ws.incidentPrefix, x.i.number), title: x.i.title, path: x.t.path, code: x.t.code, selectedBy: r.selectedBy, why: r.selectedBy === "files" ? `Touches ${touched}` : "Added by triage: related behaviour" };
  });
  const skips = sel.skipped.map((k) => ({ incidentId: byId[k.id].i.id, reason: k.reason }));
  const awaiting = await db.select().from(s.incidents).where(and(eq(s.incidents.repoId, repo.id), eq(s.incidents.status, "awaiting_fix")));
  for (const a of awaiting) skips.push({ incidentId: a.id, reason: "Awaiting fix — no proven test yet" });
  const usage = await scoped(ws.id).usage();
  const { sourceFor } = await import("@/lib/git/source");
  const { deps } = await import("@/lib/timetravel/deps");
  const { applyRepoConfig, loadRepoConfig } = await import("@/lib/config/repoConfig");
  const src = await sourceFor(repo, await (await deps()).tokenFor(repo)).catch(() => null);
  const cfg = src ? applyRepoConfig(repo, await loadRepoConfig(src, repo.defaultBranch).catch(() => ({}))) : repo;
  // Test what would land: the PR merged into its base (as CI does), not a head that may predate later fixes.
  const { testMergeCommit } = await import("@/lib/github/pulls");
  const { octokitFor } = await import("@/lib/github/app");
  const merged = selected.length > 0 ? await testMergeCommit((await octokitFor(ws.id)) as Parameters<typeof testMergeCommit>[0], repo.fullName, check.prNumber) : null;
  const testedSha = merged ?? check.headSha;
  await db.update(s.prChecks).set({ testedSha }).where(eq(s.prChecks.id, checkId));
  const choice = pickRunner(cfg, { remainingCpuMs: SANDBOX_ALLOWANCE_MS - usage.sandboxCpuMs }, false);
  const mode = choice === "actions" ? "actions" : choice === "unavailable" ? "unavailable" : "run";
  await db.update(s.prChecks).set({ status: "running", runner: mode === "actions" ? "actions" : mode === "run" ? "sandbox" : null }).where(eq(s.prChecks.id, checkId));
  return {
    ok: true, checkId, workspaceId: ws.id, headSha: check.headSha, testedSha, mode, selected, skips,
    repo: { id: repo.id, url: repo.cloneUrl, fullName: repo.fullName, framework: cfg.framework, install: cfg.installCmd, mode: cfg.checkMode },
  };
}

async function runSelected(p: Extract<Plan, { ok: true }>, t: Selected): Promise<{ runs: RunResult[]; cpuMs: number; kind: string }> {
  "use step";
  const { deps } = await import("@/lib/timetravel/deps");
  const d = await deps();
  const token = await d.tokenFor({ workspaceId: p.workspaceId, fullName: p.repo.fullName });
  const report = await d.runner().run({ repoUrl: p.repo.url, token, sha: p.testedSha, framework: p.repo.framework, install: p.repo.install, testPath: t.path, testCode: t.code, runs: PR_RUNS, timeoutMs: 120_000 });
  return { runs: report.results, cpuMs: report.cpuMs, kind: d.runner().kind };
}

/** Saves results, sets the verdict, updates the GitHub check run and the one PR comment. Also used by the Actions report endpoint. */
export async function finalizeCheck(checkId: string, results: { selected: Selected; runs: RunResult[] }[], skips: { incidentId: string; reason: string }[], runner: string, cpuMs: number, mode?: "blocking" | "advisory"): Promise<void> {
  "use step";
  const { eq, sql } = await import("drizzle-orm");
  const { getDb } = await import("@/lib/db/client");
  const s = await import("@/lib/db/schema");
  const { prVerdict, aggregatePr } = await import("@/lib/domain/verdict");
  const { github } = await import("@/lib/github/api");
  const { renderComment } = await import("@/lib/github/comment");
  const db = await getDb();
  const [check] = await db.select().from(s.prChecks).where(eq(s.prChecks.id, checkId));
  const [repo] = await db.select().from(s.repositories).where(eq(s.repositories.id, check.repoId));
  const rows = results.map(({ selected, runs }) => {
    const verdict = prVerdict(runs);
    const failure = runs.find((r) => r.outcome !== "passed")?.message;
    const trace: TraceStep[] = [
      { head: `checkout ${(check.testedSha ?? check.headSha).slice(0, 7)}${check.testedSha && check.testedSha !== check.headSha ? ` (PR merged into ${check.baseSha.slice(0, 7)})` : ""}`, sub: `${selected.path}` },
      { head: `run ×${runs.length}`, sub: runs.map((r) => r.outcome).join(", "), bad: verdict === "recur" },
      ...(failure ? [{ head: "first failure", sub: failure.slice(0, 300), bad: true }] : []),
    ];
    return { checkId, memoryTestId: selected.memoryTestId, selectedBy: selected.selectedBy, why: selected.why, runs, verdict, failureExcerpt: failure ?? null, trace };
  });
  if (rows.length) await db.insert(s.prCheckResults).values(rows);
  if (skips.length) await db.insert(s.prCheckSkips).values(skips.map((k) => ({ checkId, ...k })));
  const verdict = aggregatePr(rows.map((r) => r.verdict));
  const durationMs = Date.now() - new Date(check.createdAt).getTime();
  await db.update(s.prChecks).set({ status: "done", verdict, runner, durationMs }).where(eq(s.prChecks.id, checkId));
  if (runner === "sandbox" && cpuMs > 0) {
    const month = new Date().toISOString().slice(0, 7);
    await db.insert(s.usage).values({ workspaceId: check.workspaceId, month, sandboxCpuMs: cpuMs }).onConflictDoUpdate({ target: [s.usage.workspaceId, s.usage.month], set: { sandboxCpuMs: sql`${s.usage.sandboxCpuMs} + ${cpuMs}` } });
  }
  const url = `${process.env.APP_URL ?? ""}/pulls/${check.prNumber}?repo=${repo.name}`;
  const body = renderComment({
    verdict, skipped: skips.length, url, runner,
    results: results.map(({ selected, runs }, i) => ({ key: selected.key, title: selected.title, testPath: selected.path, verdict: rows[i].verdict, passed: runs.filter((r) => r.outcome === "passed").length, runs: runs.length, failure: rows[i].failureExcerpt ?? undefined })),
  });
  const conclusion = verdict === "recur" ? ((mode ?? repo.checkMode) === "blocking" ? "failure" : "neutral") : verdict === "inconclusive" ? "neutral" : "success";
  await github.completeCheckRun(check.workspaceId, repo.fullName, check.checkRunId, conclusion, body, url);
  if (verdict !== "skipped" || check.commentId) {
    const commentId = await github.upsertComment(check.workspaceId, repo.fullName, check.prNumber, body, check.commentId);
    if (commentId) await db.update(s.prChecks).set({ commentId }).where(eq(s.prChecks.id, checkId));
  }
  if (verdict === "recur") {
    const first = results.find((_, i) => rows[i].verdict === "recur")!;
    await db.insert(s.activity).values({ workspaceId: check.workspaceId, incidentId: first.selected.incidentId, title: `PR #${check.prNumber} blocked: ${first.selected.key} would recur`, detail: check.title, tone: "fail" });
  }
}

export async function prCheck(checkId: string): Promise<void> {
  "use workflow";
  const p = await plan(checkId);
  if (!p.ok) return;
  if (p.mode === "actions") return; // results arrive from the team's runner via /api/v1/checks/report
  const results: { selected: Selected; runs: RunResult[] }[] = [];
  let cpuMs = 0;
  let kind = "sandbox";
  for (const t of p.selected) {
    if (p.mode === "unavailable") {
      results.push({ selected: t, runs: [{ outcome: "error", durationMs: 0, message: "Sandbox hours are used up and this repository has no Actions workflow" }] });
      continue;
    }
    const r = await runSelected(p, t);
    cpuMs += r.cpuMs;
    kind = r.kind;
    results.push({ selected: t, runs: r.runs });
  }
  await finalizeCheck(checkId, results, p.skips, p.mode === "unavailable" ? "none" : kind, cpuMs, p.repo.mode);
}
