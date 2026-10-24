import { test, expect, afterEach, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { setStartOverride } from "@/lib/workflows/start";

let started: string[] = [];
beforeEach(() => {
  process.env.AFTERSHOCK_DEMO = "1";
  started = [];
  setStartOverride((k, id) => started.push(`${k}:${id}`));
});
afterEach(() => {
  delete process.env.AFTERSHOCK_DEMO;
  setStartOverride(null);
});

async function world() {
  const db = await getDb();
  const login = `bf-${crypto.randomUUID().slice(0, 8)}`;
  const [ws] = await db.insert(s.workspaces).values({ login, name: login }).returning();
  for (const name of ["ecommerce-api", "storefront-web", "billing-worker"]) {
    await db.insert(s.repositories).values({ workspaceId: ws.id, fullName: `${login}/${name}`, name, cloneUrl: "https://github.com/x/y.git", framework: "pytest", installCmd: "pip install -r requirements.txt" });
  }
  const incidents = () => db.select().from(s.incidents).where(eq(s.incidents.workspaceId, ws.id));
  return { ws, incidents };
}

test("backfill imports closed incident issues once and starts time travel for those with a fix", async () => {
  const w = await world();
  const { backfill } = await import("@/lib/workflows/backfill");
  const r = await backfill(w.ws.id, 10);
  expect(r).toEqual({ imported: 3, travelling: 2 });
  const incs = await w.incidents();
  expect(incs.map((i) => i.sourceRef).sort()).toEqual(["billing-worker#91", "ecommerce-api#52", "storefront-web#215"]);
  const withFix = incs.filter((i) => i.fixSha).map((i) => `timeTravel:${i.id}`).sort();
  expect(started.sort()).toEqual(withFix);
  expect(incs.find((i) => i.sourceRef === "billing-worker#91")?.statusReason).toMatch(/without a linked fix/);
  expect(await backfill(w.ws.id, 10)).toEqual({ imported: 0, travelling: 0 });
});

test("backfill respects the limit", async () => {
  const w = await world();
  const { backfill } = await import("@/lib/workflows/backfill");
  expect((await backfill(w.ws.id, 1)).imported).toBe(1);
  expect(await w.incidents()).toHaveLength(1);
});
