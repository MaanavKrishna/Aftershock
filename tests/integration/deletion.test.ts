import { test, expect } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { deleteIncident, deleteRepository, deleteWorkspace, deleteAccount, archiveRepositories, purgeExpired, trimRetention } from "@/lib/data/lifecycle";
import { ledgerWorld } from "../support/world";

const DAY = 86_400_000;
const user = async (login: string) => (await (await getDb()).insert(s.users).values({ githubId: String(Math.random()), login }).returning())[0];

test("deleting an incident removes its runs and memory test, only inside its own workspace, and is audited", async () => {
  const w = await ledgerWorld();
  const other = await ledgerWorld();
  const db = await getDb();
  const actor = await user("owner1");
  // Another workspace deleting "the same number" only ever touches its own incident.
  await deleteIncident(other.ws.id, w.incident.number, actor.id);
  expect((await db.select().from(s.incidents).where(eq(s.incidents.id, w.incident.id))).length).toBe(1);
  expect(await deleteIncident(w.ws.id, 9999, actor.id)).toBe(false);
  expect(await deleteIncident(w.ws.id, w.incident.number, actor.id)).toBe(true);
  expect(await db.select().from(s.incidents).where(eq(s.incidents.id, w.incident.id))).toEqual([]);
  const audit = await db.select().from(s.auditLog).where(eq(s.auditLog.workspaceId, w.ws.id));
  expect(audit.map((a) => a.action)).toContain("incident.deleted");
});

test("deleting a repository deletes its cached environments at the provider and keeps incidents", async () => {
  const w = await ledgerWorld();
  const db = await getDb();
  await db.insert(s.envSnapshots).values({ workspaceId: w.ws.id, repoId: w.repo.id, key: "k", snapshotId: "snap_x" });
  const deleted: string[] = [];
  await deleteRepository(w.ws.id, w.repo.id, null, "removed", async (id) => void deleted.push(id));
  expect(deleted).toEqual(["snap_x"]);
  const [inc] = await db.select().from(s.incidents).where(eq(s.incidents.id, w.incident.id));
  expect(inc.repoId).toBeNull();
});

test("deleting a workspace removes everything but keeps the audit record", async () => {
  const w = await ledgerWorld();
  const db = await getDb();
  const actor = await user("owner2");
  await deleteWorkspace(w.ws.id, actor.id, async () => undefined);
  expect(await db.select().from(s.workspaces).where(eq(s.workspaces.id, w.ws.id))).toEqual([]);
  expect(await db.select().from(s.incidents).where(eq(s.incidents.workspaceId, w.ws.id))).toEqual([]);
  const audit = await db.select().from(s.auditLog).where(eq(s.auditLog.workspaceId, w.ws.id));
  expect(audit.map((a) => a.action)).toContain("workspace.deleted");
});

test("deleting an account removes workspaces only they belong to, and refuses while they are the last owner of a shared one", async () => {
  const solo = await ledgerWorld();
  const shared = await ledgerWorld();
  const db = await getDb();
  const me = await user("me");
  const teammate = await user("teammate");
  await db.insert(s.memberships).values([{ workspaceId: solo.ws.id, userId: me.id, role: "owner" }, { workspaceId: shared.ws.id, userId: me.id, role: "owner" }, { workspaceId: shared.ws.id, userId: teammate.id, role: "member" }]);
  await expect(deleteAccount(me.id, async () => undefined)).rejects.toThrow(/last owner/);
  await db.update(s.memberships).set({ role: "owner" }).where(eq(s.memberships.userId, teammate.id));
  await deleteAccount(me.id, async () => undefined);
  expect(await db.select().from(s.users).where(eq(s.users.id, me.id))).toEqual([]);
  expect(await db.select().from(s.workspaces).where(eq(s.workspaces.id, solo.ws.id))).toEqual([]);
  expect((await db.select().from(s.workspaces).where(eq(s.workspaces.id, shared.ws.id))).length).toBe(1);
});

test("repositories removed from the GitHub App are archived, then purged after 30 days", async () => {
  const w = await ledgerWorld();
  const db = await getDb();
  await archiveRepositories(w.ws.id, [w.repo.fullName], new Date("2026-10-01T00:00:00Z"));
  expect((await db.select().from(s.repositories).where(eq(s.repositories.id, w.repo.id)))[0].archivedAt).not.toBeNull();
  await purgeExpired(new Date("2026-10-20T00:00:00Z"), async () => undefined);
  expect((await db.select().from(s.repositories).where(eq(s.repositories.id, w.repo.id))).length).toBe(1);
  await purgeExpired(new Date(new Date("2026-10-01T00:00:00Z").getTime() + 31 * DAY), async () => undefined);
  expect(await db.select().from(s.repositories).where(eq(s.repositories.id, w.repo.id))).toEqual([]);
});

test("run logs and webhook deliveries older than 30 days are trimmed", async () => {
  const w = await ledgerWorld();
  const db = await getDb();
  const old = new Date(Date.now() - 40 * DAY);
  const [run] = await db.insert(s.timeTravelRuns).values({ incidentId: w.incident.id, attempt: 1, status: "proven", log: "very long log", finishedAt: old, createdAt: old }).returning();
  await db.insert(s.deliveries).values({ workspaceId: w.ws.id, kind: "github", event: "x", detail: "d", ok: true, createdAt: old });
  const out = await trimRetention(new Date());
  expect(out.logs).toBeGreaterThanOrEqual(1);
  expect((await db.select().from(s.timeTravelRuns).where(eq(s.timeTravelRuns.id, run.id)))[0].log).toBe("");
  expect((await db.select().from(s.deliveries).where(eq(s.deliveries.workspaceId, w.ws.id))).length).toBe(0);
});
