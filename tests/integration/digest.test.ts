import { test, expect, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";
import { setStartOverride } from "@/lib/workflows/start";
import { weeklyDigests } from "@/lib/notify/digest";

afterEach(() => setStartOverride(null));

test("Monday's digest summarises the last 7 days for workspaces that subscribed", async () => {
  setStartOverride(() => undefined);
  const db = await getDb();
  const login = `dg-${crypto.randomUUID().slice(0, 8)}`;
  const [ws] = await db.insert(s.workspaces).values({ login, name: login, settings: { flags: { notifications: true } } }).returning();
  const [t] = await db.insert(s.notificationTargets).values({ workspaceId: ws.id, kind: "webhook", name: "ops", urlCiphertext: encrypt("https://ops.example.com/h"), events: ["digest.weekly"] }).returning();
  const [repo] = await db.insert(s.repositories).values({ workspaceId: ws.id, fullName: `${login}/r`, name: "r", cloneUrl: "x", framework: "pytest", installCmd: "x" }).returning();
  await db.insert(s.incidents).values({ workspaceId: ws.id, repoId: repo.id, number: 1, title: "t", source: "form", status: "proven" });
  await db.insert(s.prChecks).values({ workspaceId: ws.id, repoId: repo.id, prNumber: 3, title: "t", headSha: "a", baseSha: "b", status: "done", verdict: "recur" });
  expect(await weeklyDigests("2026-10-25")).toBe(0); // a Sunday
  expect(await weeklyDigests("2026-10-26")).toBeGreaterThanOrEqual(1);
  const [n] = await db.select().from(s.notifications).where(eq(s.notifications.targetId, t.id));
  expect(n.event).toBe("digest.weekly");
  expect(String(n.payload.title)).toMatch(/^Week in review/);
  expect(String(n.payload.detail)).toContain("1 incident opened");
  expect(String(n.payload.detail)).toContain("1 recurrence blocked");
});
