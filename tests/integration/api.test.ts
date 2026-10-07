import { describe, test, expect } from "vitest";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { hashToken, newToken } from "@/lib/crypto";
import { GET as listIncidents, POST as createIncident } from "@/app/api/v1/incidents/route";
import { POST as report } from "@/app/api/v1/checks/report/route";
import { GET as lessons } from "@/app/api/v1/lessons/route";
import { LEDGER_TEST } from "../support/fixtureRepo";

async function tokenWorld() {
  const db = await getDb();
  const login = `api-${crypto.randomUUID().slice(0, 8)}`;
  const [ws] = await db.insert(s.workspaces).values({ login, name: login }).returning();
  const [repo] = await db.insert(s.repositories).values({ workspaceId: ws.id, fullName: `${login}/ledger`, name: "ledger", cloneUrl: "https://github.com/x/ledger.git", framework: "pytest", installCmd: "pip install -r requirements.txt", runner: "actions" }).returning();
  const token = newToken();
  await db.insert(s.apiTokens).values({ workspaceId: ws.id, name: "ci", prefix: "x", hash: hashToken(token) });
  const auth = { authorization: `Bearer ${token}` };
  return { db, ws, repo, auth };
}

describe("HTTP API", () => {
  test("requests without a valid token are refused", async () => {
    expect((await listIncidents(new NextRequest("http://x/api/v1/incidents"))).status).toBe(401);
    expect((await listIncidents(new NextRequest("http://x/api/v1/incidents", { headers: { authorization: "Bearer as_live_nope" } }))).status).toBe(401);
  });

  test("a token lists only its workspace's incidents and can create one", async () => {
    const w = await tokenWorld();
    const created = await createIncident(new NextRequest("http://x/api/v1/incidents", { method: "POST", headers: { ...w.auth, "content-type": "application/json" }, body: JSON.stringify({ title: "Retry charged twice", repository: "ledger", observed: "two payments", expected: "one payment" }) }));
    expect(created.status).toBe(201);
    const list = await (await listIncidents(new NextRequest("http://x/api/v1/incidents", { headers: w.auth }))).json();
    expect(list.incidents.map((i: { title: string }) => i.title)).toEqual(["Retry charged twice"]);
    const [tok] = await w.db.select().from(s.apiTokens).where(eq(s.apiTokens.workspaceId, w.ws.id));
    expect(tok.lastUsedAt).not.toBeNull();
  });

  test("an Actions runner report completes the waiting check with real verdicts", async () => {
    const w = await tokenWorld();
    const [inc] = await w.db.insert(s.incidents).values({ workspaceId: w.ws.id, repoId: w.repo.id, number: 1, title: "Retry charged twice", source: "form", status: "proven", watchedFiles: ["ledger.py"] }).returning();
    await w.db.insert(s.memoryTests).values({ workspaceId: w.ws.id, incidentId: inc.id, repoId: w.repo.id, path: "tests/aftershock/test_inc_1.py", fn: "test_retry", code: LEDGER_TEST });
    const [check] = await w.db.insert(s.prChecks).values({ workspaceId: w.ws.id, repoId: w.repo.id, prNumber: 5, title: "refactor", headSha: "abc1234", baseSha: "def5678", changedFiles: ["ledger.py"], status: "running", runner: "actions" }).returning();
    const body = { repository: w.repo.fullName, pr: 5, head: "abc1234", results: [{ path: "tests/aftershock/test_inc_1.py", runs: [{ outcome: "failed", durationMs: 4, message: "assert 201 == 400" }, { outcome: "failed", durationMs: 4 }, { outcome: "failed", durationMs: 4 }] }] };
    const res = await report(new NextRequest("http://x/api/v1/checks/report", { method: "POST", headers: { ...w.auth, "content-type": "application/json" }, body: JSON.stringify(body) }));
    expect(res.status).toBe(200);
    const [after] = await w.db.select().from(s.prChecks).where(eq(s.prChecks.id, check.id));
    expect(after).toMatchObject({ status: "done", verdict: "recur", runner: "actions" });
  });

  test("a report about another workspace's repository is refused", async () => {
    const w = await tokenWorld();
    const res = await report(new NextRequest("http://x/api/v1/checks/report", { method: "POST", headers: { ...w.auth, "content-type": "application/json" }, body: JSON.stringify({ repository: "someone/else", pr: 1, head: "abc1234", results: [] }) }));
    expect(res.status).toBe(404);
  });

  test("LESSONS.md is markdown", async () => {
    const w = await tokenWorld();
    const res = await lessons(new NextRequest("http://x/api/v1/lessons", { headers: w.auth }));
    expect(res.headers.get("content-type")).toMatch(/text\/markdown/);
    expect(await res.text()).toMatch(/^# Lessons from production/);
  });
});
