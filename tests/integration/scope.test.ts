import { test, expect, beforeAll } from "vitest";
import { getDb } from "@/lib/db/client";
import { seedDemo } from "@/lib/db/seed";
import { scoped } from "@/lib/db/queries/scope";
import * as s from "@/lib/db/schema";
import { NextRequest } from "next/server";
import { GET as callback } from "@/app/api/auth/callback/route";

let demo: { workspaceId: string };
let otherWorkspace: string;

beforeAll(async () => {
  demo = await seedDemo();
  const db = await getDb();
  const [w] = await db.insert(s.workspaces).values({ login: "other-org", name: "Other" }).onConflictDoNothing().returning();
  otherWorkspace = w?.id ?? (await db.select().from(s.workspaces)).find((x) => x.login === "other-org")!.id;
  await db.insert(s.incidents).values({ workspaceId: otherWorkspace, number: 900, title: "secret", source: "form", status: "awaiting_fix" }).onConflictDoNothing();
});

test("a workspace sees its own incident", async () => {
  expect((await scoped(demo.workspaceId).getIncident(12))?.title).toBe("Payment retry charged a customer twice");
});

test("a workspace cannot read another workspace's incident", async () => {
  expect(await scoped(demo.workspaceId).getIncident(900)).toBeNull();
  expect(await scoped(otherWorkspace).getIncident(12)).toBeNull();
});

test("lists only include the workspace's rows", async () => {
  const rows = await scoped(otherWorkspace).listIncidents({});
  expect(rows.map((r) => r.number)).toEqual([900]);
});

test("OAuth callback with a mismatched state is refused", async () => {
  const req = new NextRequest("http://localhost/api/auth/callback?code=abc&state=evil", { headers: { cookie: "as_oauth_state=good" } });
  const res = await callback(req);
  expect(res.status).toBe(400);
});
