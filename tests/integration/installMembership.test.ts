import { test, expect } from "vitest";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { joinInstalledWorkspaces } from "@/lib/auth/accounts";

const rand = () => Math.floor(Math.random() * 1e9);

test("signing in joins workspaces of GitHub App installations the user can access", async () => {
  const db = await getDb();
  const [fresh] = await db.insert(s.workspaces).values({ login: `org-${rand()}`, name: "Fresh", installationId: rand() }).returning();
  const [busy] = await db.insert(s.workspaces).values({ login: `org-${rand()}`, name: "Busy", installationId: rand() }).returning();
  const [other] = await db.insert(s.workspaces).values({ login: `org-${rand()}`, name: "Other", installationId: rand() }).returning();
  const [owner] = await db.insert(s.users).values({ githubId: String(rand()), login: "first" }).returning();
  await db.insert(s.memberships).values({ workspaceId: busy.id, userId: owner.id, role: "owner" });
  const [me] = await db.insert(s.users).values({ githubId: String(rand()), login: "me" }).returning();

  await joinInstalledWorkspaces(me.id, [fresh.installationId!, busy.installationId!, rand()]);
  await joinInstalledWorkspaces(me.id, [fresh.installationId!, busy.installationId!]);

  const role = async (ws: string) => (await db.select().from(s.memberships).where(and(eq(s.memberships.workspaceId, ws), eq(s.memberships.userId, me.id))))[0]?.role;
  expect(await role(fresh.id)).toBe("owner");
  expect(await role(busy.id)).toBe("member");
  expect(await role(other.id)).toBeUndefined();
});
