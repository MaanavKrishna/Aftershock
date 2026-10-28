import { test, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { prCheck } from "@/lib/workflows/prCheck";
import { setDeps } from "@/lib/timetravel/deps";
import { setGithubApi } from "@/lib/github/api";
import { setModelClient } from "@/lib/model/provider";
import { ledgerWorld } from "../support/world";
import { LEDGER_TEST } from "../support/fixtureRepo";
import type { Runner } from "@/lib/runner/types";

let completed: { conclusion: string }[] = [];
let comments: string[] = [];
beforeEach(() => {
  completed = [];
  comments = [];
  setGithubApi({ completeCheckRun: async (_w, _r, _id, conclusion) => void completed.push({ conclusion }), upsertComment: async (_w, _r, _pr, body) => (comments.push(body), 1) });
  setModelClient(async () => ({ text: '{"add": []}', tokens: 1, model: "m" }));
});

async function world(runner: "sandbox" | "actions" = "sandbox") {
  const w = await ledgerWorld();
  const db = await getDb();
  await db.update(s.repositories).set({ runner }).where(eq(s.repositories.id, w.repo.id));
  await db.update(s.incidents).set({ status: "proven", watchedFiles: ["ledger.py"] }).where(eq(s.incidents.id, w.incident.id));
  const [other] = await db.insert(s.incidents).values({ workspaceId: w.ws.id, repoId: w.repo.id, number: 2, title: "Invoice twice", source: "form", status: "proven", watchedFiles: ["invoice.py"] }).returning();
  await db.insert(s.memoryTests).values([
    { workspaceId: w.ws.id, incidentId: w.incident.id, repoId: w.repo.id, path: "tests/aftershock/test_inc_1.py", fn: "test_retry_is_rejected", code: LEDGER_TEST },
    { workspaceId: w.ws.id, incidentId: other.id, repoId: w.repo.id, path: "tests/aftershock/test_inc_2.py", fn: "test_invoice_once", code: "def test_invoice_once():\n    assert True\n" },
  ]);
  const [check] = await db.insert(s.prChecks).values({ workspaceId: w.ws.id, repoId: w.repo.id, prNumber: 214, title: "refactor ledger", headSha: w.git.parent, baseSha: w.git.fix, changedFiles: ["ledger.py"], status: "queued", checkRunId: 9 }).returning();
  return { w, db, check };
}

const runnerReturning = (o: "passed" | "failed"): Runner => ({ kind: "docker", run: async (spec) => ({ installOk: true, results: Array.from({ length: spec.runs }, () => ({ outcome: o, durationMs: 3, message: o === "failed" ? "assert 201 == 400" : undefined })), log: "", cpuMs: 5, wallMs: 9 }) });

test("a change to a watched file runs that incident's test; all failing runs mean Recur", async () => {
  const { db, check } = await world();
  setDeps({ runner: () => runnerReturning("failed"), drafter: () => ({ draft: async () => { throw new Error("unused"); } }), openBotPr: async () => null });
  await prCheck(check.id);
  const [after] = await db.select().from(s.prChecks).where(eq(s.prChecks.id, check.id));
  expect(after).toMatchObject({ status: "done", verdict: "recur" });
  const results = await db.select().from(s.prCheckResults).where(eq(s.prCheckResults.checkId, check.id));
  expect(results).toHaveLength(1);
  expect(results[0]).toMatchObject({ selectedBy: "files", verdict: "recur", failureExcerpt: "assert 201 == 400" });
  const skips = await db.select().from(s.prCheckSkips).where(eq(s.prCheckSkips.checkId, check.id));
  expect(skips).toHaveLength(1);
  expect(completed).toEqual([{ conclusion: "failure" }]);
  expect(comments[0]).toContain("would recur");
});

test("all passing is Safe and the check succeeds", async () => {
  const { db, check } = await world();
  setDeps({ runner: () => runnerReturning("passed"), drafter: () => ({ draft: async () => { throw new Error("unused"); } }), openBotPr: async () => null });
  await prCheck(check.id);
  expect((await db.select().from(s.prChecks).where(eq(s.prChecks.id, check.id)))[0].verdict).toBe("safe");
  expect(completed).toEqual([{ conclusion: "success" }]);
});

test("advisory repositories report a recurrence as neutral, not failure", async () => {
  const { db, check, w } = await world();
  await db.update(s.repositories).set({ checkMode: "advisory" }).where(eq(s.repositories.id, w.repo.id));
  setDeps({ runner: () => runnerReturning("failed"), drafter: () => ({ draft: async () => { throw new Error("unused"); } }), openBotPr: async () => null });
  await prCheck(check.id);
  expect(completed).toEqual([{ conclusion: "neutral" }]);
});

test("repositories on Actions wait for the runner's report instead of running here", async () => {
  const { db, check } = await world("actions");
  let ran = false;
  setDeps({ runner: () => ({ kind: "docker", run: async () => { ran = true; throw new Error("should not run"); } }), drafter: () => ({ draft: async () => { throw new Error("unused"); } }), openBotPr: async () => null });
  await prCheck(check.id);
  const [after] = await db.select().from(s.prChecks).where(eq(s.prChecks.id, check.id));
  expect(ran).toBe(false);
  expect(after).toMatchObject({ status: "running", runner: "actions" });
});

test("triage may add a test, which then runs too", async () => {
  const { db, check } = await world();
  const tests = await db.select().from(s.memoryTests).where(eq(s.memoryTests.path, "tests/aftershock/test_inc_2.py"));
  const second = tests.at(-1)!;
  setModelClient(async () => ({ text: JSON.stringify({ add: [second.id] }), tokens: 1, model: "m" }));
  setDeps({ runner: () => runnerReturning("passed"), drafter: () => ({ draft: async () => { throw new Error("unused"); } }), openBotPr: async () => null });
  await prCheck(check.id);
  const results = await db.select().from(s.prCheckResults).where(eq(s.prCheckResults.checkId, check.id));
  expect(results.map((r) => r.selectedBy).sort()).toEqual(["files", "triage"]);
});

test("a runner that cannot start makes the check inconclusive with the reason, never stuck in progress", async () => {
  const { db, check } = await world();
  const broken: Runner = { kind: "sandbox", run: async () => { throw Object.assign(new Error("Status code 402 is not ok: Hobby plan usage limit exceeded for Snapshots Storage."), { status: 402 }); } };
  setDeps({ runner: () => broken, drafter: () => ({ draft: async () => { throw new Error("unused"); } }), openBotPr: async () => null });
  await prCheck(check.id);
  const [after] = await db.select().from(s.prChecks).where(eq(s.prChecks.id, check.id));
  expect(after).toMatchObject({ status: "done", verdict: "inconclusive" });
  const [r] = await db.select().from(s.prCheckResults).where(eq(s.prCheckResults.checkId, check.id));
  expect(r.failureExcerpt).toMatch(/sandbox capacity/i);
  expect(completed).toEqual([{ conclusion: "neutral" }]);
});

test("an unexpected failure still finishes the GitHub check", async () => {
  const { db, check } = await world();
  setGithubApi({ completeCheckRun: async (_w, _r, _id, conclusion) => void completed.push({ conclusion }), upsertComment: async () => { throw new Error("GitHub is down"); } });
  setDeps({ runner: () => runnerReturning("passed"), drafter: () => ({ draft: async () => { throw new Error("unused"); } }), openBotPr: async () => null });
  await prCheck(check.id).catch(() => undefined);
  const [after] = await db.select().from(s.prChecks).where(eq(s.prChecks.id, check.id));
  expect(after.status).toBe("done");
  expect(completed.length).toBeGreaterThan(0);
});

test("a failure caused by code missing from the branch is inconclusive with a rebase hint, never Recur", async () => {
  const { db, check } = await world();
  const missing: Runner = { kind: "docker", run: async (spec) => ({ installOk: true, results: Array.from({ length: spec.runs }, () => ({ outcome: "failed" as const, durationMs: 3, message: "AttributeError: 'Cart' object has no attribute 'item_count'" })), log: "", cpuMs: 5, wallMs: 9 }) };
  setDeps({ runner: () => missing, drafter: () => ({ draft: async () => { throw new Error("unused"); } }), openBotPr: async () => null });
  await prCheck(check.id);
  const [after] = await db.select().from(s.prChecks).where(eq(s.prChecks.id, check.id));
  expect(after.verdict).toBe("inconclusive");
  const [r] = await db.select().from(s.prCheckResults).where(eq(s.prCheckResults.checkId, check.id));
  expect(r.failureExcerpt).toMatch(/not on this branch/i);
  expect(comments[0]).toMatch(/Why: .*rebase/i);
});

test("a quarantined test is skipped with its reason when enforcement is on, and still runs when it is off", async () => {
  const { db, check, w } = await world();
  const { scoped } = await import("@/lib/db/queries/scope");
  await db.update(s.memoryTests).set({ quarantined: true, quarantineReason: "Flaky on main: failed 2 of the last 7 nights" }).where(eq(s.memoryTests.incidentId, w.incident.id));
  setDeps({ runner: () => runnerReturning("failed"), drafter: () => ({ draft: async () => { throw new Error("unused"); } }), openBotPr: async () => null });
  await prCheck(check.id);
  expect((await db.select().from(s.prChecks).where(eq(s.prChecks.id, check.id)))[0].verdict).toBe("recur");

  await db.update(s.workspaces).set({ settings: { flags: { quarantineEnforce: true } } }).where(eq(s.workspaces.id, w.ws.id));
  await db.update(s.prChecks).set({ status: "queued" }).where(eq(s.prChecks.id, check.id));
  await prCheck(check.id);
  const after = (await db.select().from(s.prChecks).where(eq(s.prChecks.id, check.id)))[0];
  expect(after.verdict).toBe("skipped");
  const skips = await db.select().from(s.prCheckSkips).where(eq(s.prCheckSkips.checkId, check.id));
  expect(skips.map((k) => k.reason)).toContain("Quarantined — Flaky on main: failed 2 of the last 7 nights");
  void scoped;
});

test("when sandbox hours run out, a repository that already reports from GitHub Actions moves there instead of pausing", async () => {
  const { db, check, w } = await world();
  const month = new Date().toISOString().slice(0, 7);
  await db.insert(s.usage).values({ workspaceId: w.ws.id, month, sandboxCpuMs: 10 * 3_600_000 }).onConflictDoUpdate({ target: [s.usage.workspaceId, s.usage.month], set: { sandboxCpuMs: 10 * 3_600_000 } });
  await db.insert(s.prChecks).values({ workspaceId: w.ws.id, repoId: w.repo.id, prNumber: 1, title: "earlier", headSha: "h", baseSha: "b", status: "done", verdict: "safe", runner: "actions" });
  setDeps({ runner: () => runnerReturning("passed"), drafter: () => ({ draft: async () => { throw new Error("unused"); } }), openBotPr: async () => null });
  await prCheck(check.id);
  expect((await db.select().from(s.prChecks).where(eq(s.prChecks.id, check.id)))[0].runner).toBe("actions");
});

test("merge queue checks run on the queue's own commit, report on the check run, and post no comment", async () => {
  const { db, check } = await world();
  await db.update(s.prChecks).set({ mergeGroupRef: "refs/heads/gh-readonly-queue/main/pr-214-abc", testedSha: check.headSha }).where(eq(s.prChecks.id, check.id));
  const shas: string[] = [];
  setDeps({ runner: () => ({ kind: "docker", run: async (spec) => (shas.push(spec.sha), { installOk: true, results: Array.from({ length: spec.runs }, () => ({ outcome: "failed" as const, durationMs: 1 })), log: "", cpuMs: 1, wallMs: 1 }) }), drafter: () => ({ draft: async () => { throw new Error("unused"); } }), openBotPr: async () => null });
  await prCheck(check.id);
  const [after] = await db.select().from(s.prChecks).where(eq(s.prChecks.id, check.id));
  expect(after).toMatchObject({ status: "done", verdict: "recur", testedSha: check.headSha });
  expect(new Set(shas)).toEqual(new Set([check.headSha]));
  expect(completed).toEqual([{ conclusion: "failure" }]);
  expect(comments).toEqual([]);
});

test("every check records its recurrence risk from the files it touches", async () => {
  const { db, check } = await world();
  setDeps({ runner: () => runnerReturning("passed"), drafter: () => ({ draft: async () => { throw new Error("unused"); } }), openBotPr: async () => null });
  await prCheck(check.id);
  const [after] = await db.select().from(s.prChecks).where(eq(s.prChecks.id, check.id));
  expect(after.risk).toMatchObject({ level: "medium", incidents: ["INC-1"], reasons: ["Touches ledger.py, the code behind INC-1"] });
});

test("a check superseded by a newer push to the same pull request stops before running tests", async () => {
  const { db, check, w } = await world();
  await db.insert(s.prChecks).values({ workspaceId: w.ws.id, repoId: w.repo.id, prNumber: 214, title: "refactor ledger v2", headSha: w.git.fix, baseSha: w.git.fix, changedFiles: ["ledger.py"], status: "queued", checkRunId: 10, createdAt: new Date(Date.now() + 1000) });
  let runs = 0;
  setDeps({ runner: () => ({ kind: "docker", run: async (spec) => (runs++, { installOk: true, results: Array.from({ length: spec.runs }, () => ({ outcome: "passed" as const, durationMs: 1 })), log: "", cpuMs: 1, wallMs: 1 }) }), drafter: () => ({ draft: async () => { throw new Error("unused"); } }), openBotPr: async () => null });
  await prCheck(check.id);
  expect(runs).toBe(0);
  const [after] = await db.select().from(s.prChecks).where(eq(s.prChecks.id, check.id));
  expect(after).toMatchObject({ status: "done", verdict: "skipped" });
  expect(completed).toEqual([{ conclusion: "neutral" }]);
});
