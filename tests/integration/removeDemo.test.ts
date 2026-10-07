import { test, expect } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { seedDemo } from "@/lib/db/seed";
import { removeDemoData } from "@/lib/db/removeDemo";

test("removing demo data deletes the demo workspace and its seeded users, and nothing else", async () => {
  const db = await getDb();
  const { workspaceId } = await seedDemo();
  const [real] = await db.insert(s.workspaces).values({ login: `real-${crypto.randomUUID().slice(0, 6)}`, name: "Real" }).returning();
  const [user] = await db.insert(s.users).values({ githubId: String(Math.floor(Math.random() * 1e9)), login: "realuser" }).returning();
  await db.insert(s.memberships).values({ workspaceId: real.id, userId: user.id, role: "owner" });

  const removed = await removeDemoData(db);
  expect(removed.workspaces).toBe(1);
  expect(removed.users).toBe(3);
  expect(await db.select().from(s.workspaces).where(eq(s.workspaces.id, workspaceId))).toEqual([]);
  expect(await db.select().from(s.incidents).where(eq(s.incidents.workspaceId, workspaceId))).toEqual([]);
  expect(await db.select().from(s.users).where(inArray(s.users.login, ["you", "teammate-a", "teammate-b"]))).toEqual([]);
  expect((await db.select().from(s.workspaces).where(eq(s.workspaces.id, real.id))).length).toBe(1);
  expect((await db.select().from(s.users).where(eq(s.users.id, user.id))).length).toBe(1);
  expect(await removeDemoData(db)).toEqual({ workspaces: 0, users: 0 });
});
