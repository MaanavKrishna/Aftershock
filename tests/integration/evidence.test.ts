import { test, expect } from "vitest";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { hashToken, newToken } from "@/lib/crypto";
import { verifyBundle } from "@/lib/evidence/sign";
import { ledgerWorld } from "../support/world";
import { LEDGER_TEST } from "../support/fixtureRepo";

async function provenWorld() {
  const w = await ledgerWorld();
  const db = await getDb();
  await db.update(s.incidents).set({ status: "proven", parentSha: w.git.parent, fixPr: 7 }).where(eq(s.incidents.id, w.incident.id));
  const fail = { outcome: "failed" as const, durationMs: 12, message: "assert 201 == 400" };
  const pass = { outcome: "passed" as const, durationMs: 10 };
  const [run] = await db.insert(s.timeTravelRuns).values({ incidentId: w.incident.id, attempt: 1, status: "proven", testPath: "tests/aftershock/test_inc_1.py", testCode: LEDGER_TEST, beforeResults: [fail, fail, fail], fixResults: [pass, pass, pass], log: "pytest output", model: "m", runner: "sandbox", finishedAt: new Date() }).returning();
  const [mem] = await db.insert(s.memoryTests).values({ workspaceId: w.ws.id, incidentId: w.incident.id, repoId: w.repo.id, runId: run.id, path: "tests/aftershock/test_inc_1.py", fn: "test_retry_is_rejected", code: LEDGER_TEST, guardStatus: "guarding" }).returning();
  const [check] = await db.insert(s.prChecks).values({ workspaceId: w.ws.id, repoId: w.repo.id, prNumber: 41, title: "refactor", headSha: "a".repeat(40), baseSha: "b".repeat(40), testedSha: "c".repeat(40), status: "done", verdict: "recur", overridden: true }).returning();
  await db.insert(s.prCheckResults).values({ checkId: check.id, memoryTestId: mem.id, selectedBy: "files", runs: [fail, fail, fail], verdict: "recur" });
  await db.insert(s.overrides).values({ checkId: check.id, reason: "hotfix, reviewed by two people" });
  const token = newToken();
  await db.insert(s.apiTokens).values({ workspaceId: w.ws.id, name: "audit", prefix: "x", hash: hashToken(token), scope: "read" });
  return { ...w, run, auth: { authorization: `Bearer ${token}` } };
}

const get = async (n: string, headers: Record<string, string>) => {
  const { GET } = await import("@/app/api/v1/incidents/[number]/evidence/route");
  return GET(new NextRequest(`http://x/api/v1/incidents/${n}/evidence`, { headers }), { params: Promise.resolve({ number: n }) });
};

test("the evidence bundle records the proof, the guard history and overrides, signed with a published key", async () => {
  const w = await provenWorld();
  const res = await get("1", w.auth);
  expect(res.status).toBe(200);
  expect(res.headers.get("content-disposition")).toContain("aftershock-evidence-INC-1.json");
  const bundle = await res.json();
  const p = bundle.payload;
  expect(p).toMatchObject({ schema: "aftershock.evidence/v1", workspace: w.ws.login, repository: w.repo.fullName, incident: { key: "INC-1", status: "proven" }, fix: { sha: w.git.fix, parentSha: w.git.parent, pr: 7 } });
  expect(p.proof[0]).toMatchObject({ attempt: 1, status: "proven", beforeTheFix: { sha: w.git.parent, outcomes: ["failed", "failed", "failed"] }, onTheFix: { sha: w.git.fix, outcomes: ["passed", "passed", "passed"] }, testSha256: createHash("sha256").update(LEDGER_TEST).digest("hex"), logSha256: createHash("sha256").update("pytest output").digest("hex") });
  expect(p.memoryTest).toMatchObject({ path: "tests/aftershock/test_inc_1.py", guardStatus: "guarding" });
  expect(p.guard).toEqual([expect.objectContaining({ prNumber: 41, testedSha: "c".repeat(40), verdict: "recur", overridden: true, overrideReason: "hotfix, reviewed by two people" })]);

  const { GET: keys } = await import("@/app/.well-known/aftershock-jwks.json/route");
  const jwks = await (await keys()).json();
  expect(verifyBundle(bundle, jwks)).toBe(true);
  expect(verifyBundle({ ...bundle, payload: { ...p, incident: { ...p.incident, status: "unproven" } } }, jwks)).toBe(false);
});

test("evidence is only served to the incident's own workspace", async () => {
  const a = await provenWorld();
  const b = await provenWorld();
  expect((await get("1", {})).status).toBe(401);
  expect((await get("1", b.auth)).status).toBe(200);
  const own = await (await get("1", a.auth)).json();
  expect(own.payload.workspace).toBe(a.ws.login);
  expect((await get("999", a.auth)).status).toBe(404);
  expect((await get("abc", a.auth)).status).toBe(404);
});
