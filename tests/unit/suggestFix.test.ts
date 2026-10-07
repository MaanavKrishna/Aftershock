import { test, expect } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { suggestFix } from "@/lib/workflows/suggestFix";
import { setDeps } from "@/lib/timetravel/deps";
import { setModelClient } from "@/lib/model/provider";
import { ledgerWorld } from "../support/world";
import { LEDGER_TEST } from "../support/fixtureRepo";
import type { Runner } from "@/lib/runner/types";

async function recurCheck() {
  const w = await ledgerWorld();
  const db = await getDb();
  await db.update(s.incidents).set({ status: "proven", watchedFiles: ["ledger.py"] }).where(eq(s.incidents.id, w.incident.id));
  const [mem] = await db.insert(s.memoryTests).values({ workspaceId: w.ws.id, incidentId: w.incident.id, repoId: w.repo.id, path: "tests/aftershock/test_inc_1.py", fn: "test_retry_is_rejected", code: LEDGER_TEST }).returning();
  const [check] = await db.insert(s.prChecks).values({ workspaceId: w.ws.id, repoId: w.repo.id, prNumber: 9, title: "refactor ledger", headSha: w.git.parent, baseSha: w.git.fix, changedFiles: ["ledger.py"], status: "done", verdict: "recur" }).returning();
  await db.insert(s.prCheckResults).values({ checkId: check.id, memoryTestId: mem.id, selectedBy: "files", verdict: "recur", runs: [], failureExcerpt: "assert 201 == 400" });
  return { w, check, db };
}

const overlayRunner: Runner = { kind: "docker", run: async (spec) => ({ installOk: true, results: Array.from({ length: spec.runs }, () => ({ outcome: spec.overlay?.length ? ("passed" as const) : ("failed" as const), durationMs: 1 })), log: "", cpuMs: 1, wallMs: 1 }) };

test("a suggested fix that passes every memory test is stored as passed", async () => {
  const { check, db } = await recurCheck();
  let prompt = "";
  setModelClient(async (_c, m) => ((prompt = m.map((x) => x.content).join("\n")), { text: JSON.stringify({ path: "ledger.py", content: "PAYMENTS = []\ndef pay(o):\n    if o in PAYMENTS:\n        return 400\n    PAYMENTS.append(o)\n    return 201\n", explanation: "Restore the duplicate check." }), tokens: 1, model: "m" }));
  setDeps({ runner: () => overlayRunner, drafter: () => ({ draft: async () => { throw new Error("unused"); } }), openBotPr: async () => null });
  await suggestFix(check.id);
  const [fix] = await db.select().from(s.suggestedFixes).where(eq(s.suggestedFixes.checkId, check.id));
  expect(fix.status).toBe("passed");
  expect(fix.explanation).toBe("Restore the duplicate check.");
  expect(fix.results).toHaveLength(1);
  expect(prompt).toContain("assert 201 == 400");
  setModelClient(null);
});

test("a suggested fix for a file the PR did not change is refused", async () => {
  const { check, db } = await recurCheck();
  setModelClient(async () => ({ text: JSON.stringify({ path: "app/other.py", content: "x = 1\n", explanation: "?" }), tokens: 1, model: "m" }));
  setDeps({ runner: () => overlayRunner, drafter: () => ({ draft: async () => { throw new Error("unused"); } }), openBotPr: async () => null });
  await suggestFix(check.id);
  const [fix] = await db.select().from(s.suggestedFixes).where(eq(s.suggestedFixes.checkId, check.id));
  expect(fix.status).toBe("failed");
  expect(fix.explanation).toMatch(/changed/);
  setModelClient(null);
});
