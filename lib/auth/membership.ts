import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import type { Session } from "./token";

/**
 * A session names a workspace, but access is decided now: removed members, deleted accounts and deleted
 * workspaces lose access on their next request, not when the 30-day cookie expires.
 */
export async function isMember(session: Session): Promise<boolean> {
  const db = await getDb();
  const [m] = await db.select({ id: s.memberships.userId }).from(s.memberships).where(and(eq(s.memberships.userId, session.userId), eq(s.memberships.workspaceId, session.workspaceId)));
  return Boolean(m);
}
