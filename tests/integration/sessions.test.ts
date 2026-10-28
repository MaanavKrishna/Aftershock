import { describe, test, expect } from "vitest";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { signSession } from "@/lib/auth/token";
import { startSession, sessionActive, revokeSession, revokeOtherSessions, listSessions } from "@/lib/auth/sessions";
import { GET as listIncidents } from "@/app/api/v1/incidents/route";

async function member() {
  const db = await getDb();
  const login = `ses-${crypto.randomUUID().slice(0, 8)}`;
  const [ws] = await db.insert(s.workspaces).values({ login, name: login }).returning();
  const [u] = await db.insert(s.users).values({ githubId: String(Math.floor(Math.random() * 1e9)), login }).returning();
  await db.insert(s.memberships).values({ userId: u.id, workspaceId: ws.id, role: "owner" });
  return { db, ws, u };
}
const api = async (token: string) => (await listIncidents(new NextRequest("http://x/api/v1/incidents", { headers: { cookie: `as_session=${token}` } }))).status;

describe("server-side sessions", () => {
  test("a session works until it is revoked, then stops at once", async () => {
    const m = await member();
    const session = await startSession(m.u.id, m.ws.id, "Mozilla/5.0 test");
    expect(session.sid).toBeTruthy();
    const token = await signSession(session);
    expect(await api(token)).toBe(200);
    await revokeSession(m.u.id, session.sid!);
    expect(await sessionActive(session)).toBe(false);
    expect(await api(token)).toBe(401);
  });
  test("sessions end after 14 days without use, and after 30 days in any case", async () => {
    const m = await member();
    const idle = await startSession(m.u.id, m.ws.id, "");
    await m.db.update(s.sessions).set({ lastSeenAt: new Date(Date.now() - 15 * 86_400_000) }).where(eq(s.sessions.id, idle.sid!));
    expect(await sessionActive(idle)).toBe(false);
    const old = await startSession(m.u.id, m.ws.id, "");
    await m.db.update(s.sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(s.sessions.id, old.sid!));
    expect(await sessionActive(old)).toBe(false);
  });
  test("tokens from before server-side sessions (no session id) are no longer accepted", async () => {
    const m = await member();
    expect(await api(await signSession({ userId: m.u.id, workspaceId: m.ws.id }))).toBe(401);
  });
  test("one user can't revoke another's session; 'sign out everywhere else' keeps the current one", async () => {
    const m = await member();
    const other = await member();
    const mine = await startSession(m.u.id, m.ws.id, "laptop");
    const phone = await startSession(m.u.id, m.ws.id, "phone");
    const theirs = await startSession(other.u.id, other.ws.id, "x");
    await revokeSession(m.u.id, theirs.sid!);
    expect(await sessionActive(theirs)).toBe(true);
    await revokeOtherSessions(m.u.id, mine.sid!);
    expect(await sessionActive(mine)).toBe(true);
    expect(await sessionActive(phone)).toBe(false);
    expect((await listSessions(m.u.id)).map((x) => x.userAgent)).toEqual(["laptop"]);
  });
  test("a session in a workspace the user left is not active", async () => {
    const m = await member();
    const session = await startSession(m.u.id, m.ws.id, "");
    await m.db.delete(s.memberships).where(eq(s.memberships.userId, m.u.id));
    expect(await sessionActive(session)).toBe(false);
  });
});
