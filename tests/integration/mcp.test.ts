import { describe, test, expect } from "vitest";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { hashToken, newToken } from "@/lib/crypto";
import { setStartOverride } from "@/lib/workflows/start";
import { ledgerWorld } from "../support/world";
import { LEDGER_TEST } from "../support/fixtureRepo";

async function mcpWorld(scope: "read" | "write" = "read", flag = true) {
  const w = await ledgerWorld();
  const db = await getDb();
  await db.update(s.workspaces).set({ settings: { flags: { mcp: flag } } }).where(eq(s.workspaces.id, w.ws.id));
  await db.update(s.incidents).set({ status: "proven", watchedFiles: ["ledger.py"], expected: "a retried payment is rejected with 400" }).where(eq(s.incidents.id, w.incident.id));
  await db.insert(s.memoryTests).values({ workspaceId: w.ws.id, incidentId: w.incident.id, repoId: w.repo.id, path: "tests/aftershock/test_inc_1.py", fn: "test_retry_is_rejected", code: LEDGER_TEST });
  const token = newToken();
  await db.insert(s.apiTokens).values({ workspaceId: w.ws.id, name: "agent", prefix: "x", hash: hashToken(token), scope });
  return { ...w, db, token };
}

let id = 0;
async function rpc(token: string | null, method: string, params?: unknown, raw?: string) {
  const { POST } = await import("@/app/api/mcp/route");
  const res = await POST(new NextRequest("http://x/api/mcp", { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: raw ?? JSON.stringify({ jsonrpc: "2.0", id: ++id, method, ...(params ? { params } : {}) }) }));
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}
const call = async (token: string, name: string, args: unknown) => (await rpc(token, "tools/call", { name, arguments: args })).body.result;

describe("MCP server", () => {
  test("initialize negotiates the protocol and advertises tools", async () => {
    const w = await mcpWorld();
    const r = await rpc(w.token, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } });
    expect(r.status).toBe(200);
    expect(r.body.result).toMatchObject({ protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "aftershock" } });
    expect((await rpc(w.token, "initialize", { protocolVersion: "1999-01-01" })).body.result.protocolVersion).toBe("2025-06-18");
    const n = await rpc(w.token, "notifications/initialized", undefined, JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }));
    expect(n.status).toBe(202);
    const tools = (await rpc(w.token, "tools/list")).body.result.tools.map((t: { name: string }) => t.name);
    expect(tools).toEqual(["check_change", "list_lessons", "get_incident", "list_incidents", "ask"]);
  });
  test("check_change tells an agent which incidents a change touches, before it commits", async () => {
    const w = await mcpWorld();
    const r = await call(w.token, "check_change", { files: ["ledger.py", "README.md"] });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent.atRisk).toEqual([expect.objectContaining({ incident: "INC-1", test: "tests/aftershock/test_inc_1.py", expected: "a retried payment is rejected with 400", because: "touches ledger.py" })]);
    expect(r.content[0].text).toContain("INC-1");
    expect((await call(w.token, "check_change", { files: ["docs/x.md"] })).structuredContent.atRisk).toEqual([]);
  });
  test("lessons, incidents and one incident are readable", async () => {
    const w = await mcpWorld();
    expect((await call(w.token, "list_lessons", { path: "ledger" })).content[0].text).toContain("INC-1");
    // Clients that read only structuredContent (Claude Code does) must get the lessons too.
    expect((await call(w.token, "list_lessons", { path: "ledger" })).structuredContent).toMatchObject({ count: 1, markdown: expect.stringContaining("INC-1") });
    expect((await call(w.token, "list_lessons", { path: "billing/" })).content[0].text).not.toContain("INC-1");
    expect((await call(w.token, "list_incidents", {})).structuredContent.incidents[0]).toMatchObject({ key: "INC-1", status: "proven" });
    expect((await call(w.token, "get_incident", { key: "INC-1" })).structuredContent).toMatchObject({ key: "INC-1", memoryTest: { path: "tests/aftershock/test_inc_1.py" } });
    expect((await call(w.token, "get_incident", { key: "INC-404" })).isError).toBe(true);
  });
  test("write tokens also get run_check, which re-runs a pull request's check", async () => {
    const w = await mcpWorld("write");
    expect((await rpc(w.token, "tools/list")).body.result.tools.map((t: { name: string }) => t.name)).toContain("run_check");
    const [check] = await w.db.insert(s.prChecks).values({ workspaceId: w.ws.id, repoId: w.repo.id, prNumber: 41, title: "t", headSha: "a".repeat(40), baseSha: "b".repeat(40), status: "done", verdict: "safe" }).returning();
    const started: string[] = [];
    setStartOverride((k, x) => started.push(`${k}:${x}`));
    const r = await call(w.token, "run_check", { repository: "ledger", pr: 41 });
    setStartOverride(null);
    expect(r.isError).toBeFalsy();
    expect(started).toEqual([`prCheck:${check.id}`]);
    const ro = await mcpWorld("read");
    expect((await call(ro.token, "run_check", { repository: "ledger", pr: 41 })).isError).toBe(true);
  });
  test("refuses without a token, with the flag off, and on malformed requests", async () => {
    const w = await mcpWorld();
    expect((await rpc(null, "tools/list")).status).toBe(401);
    const off = await mcpWorld("read", false);
    expect((await rpc(off.token, "tools/list")).status).toBe(403);
    expect((await rpc(w.token, "x", undefined, "{not json")).body.error.code).toBe(-32700);
    expect((await rpc(w.token, "x", undefined, "[]")).body.error.code).toBe(-32600);
    expect((await rpc(w.token, "nope")).body.error.code).toBe(-32601);
    expect((await rpc(w.token, "tools/call", { name: "check_change", arguments: { files: "ledger.py" } })).body.error.code).toBe(-32602);
    expect((await rpc(w.token, "tools/call", { name: "drop_tables", arguments: {} })).body.error.code).toBe(-32602);
  });
});
