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
