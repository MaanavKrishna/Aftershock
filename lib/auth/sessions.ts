import { and, desc, eq, gt, isNull, ne } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import type { Session } from "./token";

const DAY = 86_400_000;
export const SESSION_IDLE_MS = 14 * DAY;
export const SESSION_MAX_MS = 30 * DAY;
const TOUCH_EVERY_MS = 60 * 60_000;

/** Records a new sign-in and returns the session to sign into the cookie. */
export async function startSession(userId: string, workspaceId: string, userAgent: string): Promise<Session> {
  const db = await getDb();
  const [row] = await db.insert(s.sessions).values({ userId, userAgent: userAgent.slice(0, 200), expiresAt: new Date(Date.now() + SESSION_MAX_MS) }).returning();
  return { userId, workspaceId, sid: row.id };
}

/**
 * Is this signed-in session still allowed in? The session row must exist, not be revoked, be used in the
 * last 14 days and be under 30 days old; and the user must still be a member of the workspace.
 */
export async function sessionActive(session: Session): Promise<boolean> {
  if (!session.sid) return false;
  const db = await getDb();
  const now = Date.now();
  const [row] = await db
    .select({ s: s.sessions, member: s.memberships.userId })
    .from(s.sessions)
    .leftJoin(s.memberships, and(eq(s.memberships.userId, s.sessions.userId), eq(s.memberships.workspaceId, session.workspaceId)))
    .where(and(eq(s.sessions.id, session.sid), eq(s.sessions.userId, session.userId)));
  if (!row || !row.member || row.s.revokedAt || row.s.expiresAt.getTime() <= now || row.s.lastSeenAt.getTime() <= now - SESSION_IDLE_MS) return false;
  if (row.s.lastSeenAt.getTime() < now - TOUCH_EVERY_MS) await db.update(s.sessions).set({ lastSeenAt: new Date(now) }).where(eq(s.sessions.id, session.sid));
  return true;
}

/** The user's sessions that can still be used, most recently used first. */
export async function listSessions(userId: string) {
  const db = await getDb();
  const now = new Date();
  const rows = await db.select().from(s.sessions).where(and(eq(s.sessions.userId, userId), isNull(s.sessions.revokedAt), gt(s.sessions.expiresAt, now))).orderBy(desc(s.sessions.lastSeenAt));
  return rows.filter((r) => r.lastSeenAt.getTime() > now.getTime() - SESSION_IDLE_MS);
}

/** Ends one of the user's own sessions; another user's id does nothing. */
export async function revokeSession(userId: string, sid: string): Promise<void> {
  await (await getDb()).update(s.sessions).set({ revokedAt: new Date() }).where(and(eq(s.sessions.id, sid), eq(s.sessions.userId, userId)));
}

/** "Sign out everywhere else": ends every session of the user except the current one. */
export async function revokeOtherSessions(userId: string, keepSid: string): Promise<void> {
  await (await getDb()).update(s.sessions).set({ revokedAt: new Date() }).where(and(eq(s.sessions.userId, userId), ne(s.sessions.id, keepSid), isNull(s.sessions.revokedAt)));
}
