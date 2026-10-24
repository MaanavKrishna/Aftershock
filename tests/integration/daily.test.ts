import { test, expect, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { setStartOverride } from "@/lib/workflows/start";
import { setDeps } from "@/lib/timetravel/deps";
import { ledgerWorld } from "../support/world";
import { LEDGER_TEST } from "../support/fixtureRepo";

afterEach(() => setStartOverride(null));

const call = async (auth?: string) => {
  process.env.CRON_SECRET = "cron-secret-for-tests";
  const { GET } = await import("@/app/api/cron/nightly/route");
  return GET(new NextRequest("http://x/api/cron/nightly", { headers: auth ? { authorization: auth } : {} }));
};

test("the cron starts one daily workflow instead of one run per test, and rejects a wrong secret", async () => {
  const starts: string[] = [];
  setStartOverride((kind) => starts.push(kind));
  expect((await call("Bearer wrong")).status).toBe(401);
  expect((await call()).status).toBe(401);
  const res = await call("Bearer cron-secret-for-tests");
  expect(res.status).toBe(200);
  expect(starts).toEqual(["daily"]);
});

test("the daily workflow re-checks every memory test, one step each", async () => {
  const w = await ledgerWorld();
  const db = await getDb();
  const [mem] = await db.insert(s.memoryTests).values({ workspaceId: w.ws.id, incidentId: w.incident.id, repoId: w.repo.id, path: "tests/aftershock/test_inc_1.py", fn: "test_x", code: LEDGER_TEST }).returning();
  let runs = 0;
  setDeps({ runner: () => ({ kind: "docker", run: async () => (runs++, { installOk: true, results: [{ outcome: "passed", durationMs: 1 }], log: "", cpuMs: 1, wallMs: 1 }) }), drafter: () => ({ draft: async () => { throw new Error("unused"); } }), openBotPr: async () => null });
  const { daily } = await import("@/lib/workflows/daily");
  const summary = await daily("2026-10-24");
  expect(summary.nightly).toBeGreaterThanOrEqual(1);
  expect(summary).toHaveProperty("retention.logs");
  expect(summary).toHaveProperty("purged.repositories");
  const [after] = await db.select().from(s.memoryTests).where(eq(s.memoryTests.id, mem.id));
  expect(after.nights).toEqual([true]);
  expect(runs).toBeGreaterThanOrEqual(1);
});
