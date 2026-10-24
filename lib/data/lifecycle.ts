import { and, eq, inArray, isNotNull, lt } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";

/** Deletes one provider snapshot; injected so tests and self-hosted setups can stub it. */
export type DeleteSnapshot = (snapshotId: string) => Promise<void>;

export const RETENTION_DAYS = 30;
const DAY = 86_400_000;

export async function audit(workspaceId: string, actorUserId: string | null, action: string, target = "", detail = ""): Promise<void> {
  const db = await getDb();
  await db.insert(s.auditLog).values({ workspaceId, actorUserId, action, target: target.slice(0, 200), detail: detail.slice(0, 500) });
}

async function dropSnapshots(rows: { snapshotId: string }[], del: DeleteSnapshot) {
  for (const r of rows) await del(r.snapshotId).catch(() => undefined);
}

/** Deletes an incident with its runs, memory test, notes and trail. Scoped: another workspace's number does nothing. */
export async function deleteIncident(workspaceId: string, number: number, actorUserId: string): Promise<boolean> {
  const db = await getDb();
  const [gone] = await db.delete(s.incidents).where(and(eq(s.incidents.workspaceId, workspaceId), eq(s.incidents.number, number))).returning();
  if (!gone) return false;
  await audit(workspaceId, actorUserId, "incident.deleted", `#${number}`, gone.title);
  return true;
}

/** Deletes a repository, its checks and memory tests, and its cached environments at the provider. Incidents stay. */
export async function deleteRepository(workspaceId: string, repoId: string, actorUserId: string | null, reason: string, del: DeleteSnapshot): Promise<void> {
  const db = await getDb();
  const [repo] = await db.select().from(s.repositories).where(and(eq(s.repositories.id, repoId), eq(s.repositories.workspaceId, workspaceId)));
  if (!repo) return;
  await dropSnapshots(await db.select({ snapshotId: s.envSnapshots.snapshotId }).from(s.envSnapshots).where(eq(s.envSnapshots.repoId, repoId)), del);
  await db.delete(s.repositories).where(eq(s.repositories.id, repoId));
  await audit(workspaceId, actorUserId, "repository.deleted", repo.fullName, reason);
}

/** Deletes a workspace and everything in it. The audit record of the deletion is kept. */
export async function deleteWorkspace(workspaceId: string, actorUserId: string | null, del: DeleteSnapshot): Promise<void> {
  const db = await getDb();
  const [ws] = await db.select().from(s.workspaces).where(eq(s.workspaces.id, workspaceId));
  if (!ws) return;
  await dropSnapshots(await db.select({ snapshotId: s.envSnapshots.snapshotId }).from(s.envSnapshots).where(eq(s.envSnapshots.workspaceId, workspaceId)), del);
  await db.delete(s.workspaces).where(eq(s.workspaces.id, workspaceId));
  await audit(workspaceId, actorUserId, "workspace.deleted", ws.login);
}

/** Deletes a user. Workspaces where they are the only member go too; shared workspaces need another owner first. */
export async function deleteAccount(userId: string, del: DeleteSnapshot): Promise<void> {
  const db = await getDb();
  const mine = await db.select().from(s.memberships).where(eq(s.memberships.userId, userId));
  const solo: string[] = [];
  for (const m of mine) {
    const all = await db.select().from(s.memberships).where(eq(s.memberships.workspaceId, m.workspaceId));
    if (all.length === 1) solo.push(m.workspaceId);
    else if (m.role === "owner" && all.filter((x) => x.role === "owner").length === 1) {
      throw new Error("You are the last owner of a shared workspace. Make someone else an owner first.");
    }
  }
  for (const ws of solo) await deleteWorkspace(ws, userId, del);
  for (const m of mine.filter((x) => !solo.includes(x.workspaceId))) await audit(m.workspaceId, userId, "member.left", userId, "account deleted");
  await db.delete(s.users).where(eq(s.users.id, userId));
}

/** Repositories the GitHub App lost access to stop being checked and are purged after the retention period. */
export async function archiveRepositories(workspaceId: string, fullNames: string[], now = new Date()): Promise<void> {
  if (!fullNames.length) return;
  const db = await getDb();
  await db.update(s.repositories).set({ archivedAt: now }).where(and(eq(s.repositories.workspaceId, workspaceId), inArray(s.repositories.fullName, fullNames)));
  for (const n of fullNames) await audit(workspaceId, null, "repository.archived", n, "GitHub App access removed");
}

/** Removes archived repositories and uninstalled workspaces older than the retention period. */
export async function purgeExpired(now: Date, del: DeleteSnapshot): Promise<{ repositories: number; workspaces: number }> {
  const db = await getDb();
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * DAY);
  const repos = await db.select().from(s.repositories).where(and(isNotNull(s.repositories.archivedAt), lt(s.repositories.archivedAt, cutoff)));
  for (const r of repos) await deleteRepository(r.workspaceId, r.id, null, "purged after GitHub App access was removed", del);
  const spaces = await db.select().from(s.workspaces).where(and(isNotNull(s.workspaces.uninstalledAt), lt(s.workspaces.uninstalledAt, cutoff)));
  for (const w of spaces) await deleteWorkspace(w.id, null, del);
  return { repositories: repos.length, workspaces: spaces.length };
}

/** Run logs, webhook deliveries and finished notifications are kept for the retention period; verdicts and evidence stay. */
export async function trimRetention(now: Date): Promise<{ logs: number; deliveries: number; notifications: number }> {
  const db = await getDb();
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * DAY);
  const logs = await db.update(s.timeTravelRuns).set({ log: "" }).where(and(lt(s.timeTravelRuns.createdAt, cutoff), isNotNull(s.timeTravelRuns.finishedAt))).returning({ id: s.timeTravelRuns.id });
  const deliveries = await db.delete(s.deliveries).where(lt(s.deliveries.createdAt, cutoff)).returning({ id: s.deliveries.id });
  const notifications = await db.delete(s.notifications).where(and(lt(s.notifications.createdAt, cutoff), inArray(s.notifications.status, ["sent", "failed"]))).returning({ id: s.notifications.id });
  return { logs: logs.length, deliveries: deliveries.length, notifications: notifications.length };
}
