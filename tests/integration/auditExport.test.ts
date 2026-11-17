import { describe, test, expect } from "vitest";
import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { hashToken, newToken } from "@/lib/crypto";
import { signSession } from "@/lib/auth/token";
import { startSession } from "@/lib/auth/sessions";
import { scoped } from "@/lib/db/queries/scope";
import { GET as exportAudit } from "@/app/api/v1/audit/route";

async function auditWorld() {
  const db = await getDb();
  const login = `aud-${crypto.randomUUID().slice(0, 8)}`;
  const [ws] = await db.insert(s.workspaces).values({ login, name: login }).returning();
  const user = async (role: "owner" | "admin" | "member") => {
    const [u] = await db.insert(s.users).values({ githubId: String(Math.floor(Math.random() * 1e12)), login: `${login}-${role}` }).returning();
    await db.insert(s.memberships).values({ userId: u.id, workspaceId: ws.id, role });
    return { cookie: `as_session=${await signSession(await startSession(u.id, ws.id, "test"))}`, user: u };
  };
  const token = async (scope: "read" | "write") => {
    const t = newToken();
    await db.insert(s.apiTokens).values({ workspaceId: ws.id, name: scope, prefix: "x", hash: hashToken(t), scope });
    return `Bearer ${t}`;
  };
  return { db, ws, user, token };
}

const get = (query: string, headers: Record<string, string>) => exportAudit(new NextRequest(`http://x/api/v1/audit${query}`, { headers }));

describe("audit export", () => {
  test("CSV quotes commas, quotes and line breaks, and defuses spreadsheet formulas", async () => {
    const w = await auditWorld();
    const owner = await w.user("owner");
    await w.db.insert(s.auditLog).values([
      { workspaceId: w.ws.id, actorUserId: owner.user.id, action: "token.created", target: 'ci, "nightly"', detail: "line one\nline two", createdAt: new Date("2026-01-02T00:00:00Z") },
      { workspaceId: w.ws.id, action: "incident.edited", target: "=HYPERLINK(\"http://evil\")", detail: "+1", createdAt: new Date("2026-01-03T00:00:00Z") },
      { workspaceId: w.ws.id, action: "member.role", target: "-2", detail: "@SUM(A1)", createdAt: new Date("2026-01-04T00:00:00Z") },
    ]);
    const csv = await scoped(w.ws.id).auditExport("csv");
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("time,actor,action,target,detail,id");
    expect(lines[1]).toMatch(/^2026-01-04T00:00:00.000Z,,member.role,'-2,'@SUM\(A1\),[0-9a-f-]{36}$/);
    expect(lines[2]).toMatch(/^2026-01-03T00:00:00.000Z,,incident.edited,"'=HYPERLINK\(""http:\/\/evil""\)",'\+1,/);
    expect(csv).toContain(`,token.created,"ci, ""nightly""","line one\nline two",`);
    expect(csv.endsWith("\r\n")).toBe(true);

    const json = JSON.parse(await scoped(w.ws.id).auditExport("json"));
    expect(json.map((r: { action: string }) => r.action)).toEqual(["member.role", "incident.edited", "token.created"]);
    expect(json[2]).toMatchObject({ actor: owner.user.login, target: 'ci, "nightly"', createdAt: "2026-01-02T00:00:00.000Z" });
  });

  test("owners, admins and write tokens can download it; members and read tokens cannot", async () => {
    const w = await auditWorld();
    const [owner, admin, member] = [await w.user("owner"), await w.user("admin"), await w.user("member")];
    expect((await get("", {})).status).toBe(401);
    expect((await get("", { cookie: member.cookie })).status).toBe(403);
    expect((await get("", { authorization: await w.token("read") })).status).toBe(403);
    expect((await get("", { cookie: admin.cookie })).status).toBe(200);
    const res = await get("?format=csv", { cookie: owner.cookie });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="aftershock-audit-\d{4}-\d{2}-\d{2}\.csv"$/);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const viaToken = await get("?format=json", { authorization: await w.token("write") });
    expect(viaToken.status).toBe(200);
    expect(viaToken.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(Array.isArray(await viaToken.json())).toBe(true);
    expect((await get("?format=xml", { cookie: owner.cookie })).status).toBe(400);
    // Each download is itself recorded, with who asked.
    const logged = await w.db.select().from(s.auditLog).where(and(eq(s.auditLog.workspaceId, w.ws.id), eq(s.auditLog.action, "audit.exported")));
    expect(logged.map((l) => [l.actorUserId, l.target]).sort()).toEqual([[admin.user.id, "csv"], [owner.user.id, "csv"], [null, "json"]].sort());
  });

  test("a workspace only ever exports its own log", async () => {
    const [a, b] = [await auditWorld(), await auditWorld()];
    await a.db.insert(s.auditLog).values({ workspaceId: b.ws.id, action: "token.created", target: "only-in-b" });
    const res = await get("?format=csv", { authorization: await a.token("write") });
    expect(await res.text()).not.toContain("only-in-b");
  });
});
