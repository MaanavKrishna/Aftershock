import { describe, test, expect, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { setDeps } from "@/lib/timetravel/deps";
import type { RunSpec } from "@/lib/runner/types";
import { ledgerWorld } from "../support/world";
import { LEDGER_TEST, dockerAvailable } from "../support/fixtureRepo";

afterEach(() => setDeps({}));

async function provenWorld(code = LEDGER_TEST, flag = true) {
  const w = await ledgerWorld();
  const db = await getDb();
  await db.update(s.workspaces).set({ settings: { flags: { testStrength: flag } } }).where(eq(s.workspaces.id, w.ws.id));
  await db.update(s.incidents).set({ status: "proven", parentSha: w.git.parent }).where(eq(s.incidents.id, w.incident.id));
  const [mem] = await db.insert(s.memoryTests).values({ workspaceId: w.ws.id, incidentId: w.incident.id, repoId: w.repo.id, path: "tests/aftershock/test_inc_1.py", fn: "test_retry_is_rejected", code }).returning();
  const reload = async () => (await db.select().from(s.memoryTests).where(eq(s.memoryTests.id, mem.id)))[0];
  return { ...w, db, mem, reload };
}

describe("test strength", () => {
  test("each mutant of the fixed lines runs on the fix commit; the score is what the test catches", async () => {
    const w = await provenWorld();
    const seen: RunSpec[] = [];
    // Kill every mutant except the one that changes the 400 status code.
    setDeps({ runner: () => ({ kind: "docker", run: async (spec) => (seen.push(spec), { installOk: true, results: [{ outcome: spec.overlay?.[0].content.includes("return 401") ? "passed" : "failed", durationMs: 1 }], log: "", cpuMs: 1, wallMs: 1 }) }) });
    const { strength } = await import("@/lib/workflows/strength");
    const r = await strength(w.mem.id);
    expect(seen.length).toBeGreaterThan(1);
    expect(new Set(seen.map((x) => x.sha))).toEqual(new Set([w.git.fix]));
    expect(seen.every((x) => x.overlay?.[0].path === "ledger.py")).toBe(true);
    const after = await w.reload();
    expect(after.strength).toMatchObject({ total: seen.length, killed: seen.length - 1, survivors: [expect.objectContaining({ to: "        return 401" })] });
    expect(r?.score).toBe(after.strength!.score);
  });
  test("a weak test is announced with what it misses", async () => {
    const w = await provenWorld();
    setDeps({ runner: () => ({ kind: "docker", run: async () => ({ installOk: true, results: [{ outcome: "passed", durationMs: 1 }], log: "", cpuMs: 1, wallMs: 1 }) }) });
    const { strength } = await import("@/lib/workflows/strength");
    await strength(w.mem.id);
    expect((await w.reload()).strength?.score).toBe(0);
    const acts = await w.db.select().from(s.activity).where(eq(s.activity.incidentId, w.incident.id));
    expect(acts.map((a) => a.title)).toContain("INC-1's test misses small changes to the fix");
  });
  test("environment errors don't count as caught or missed; flag off does nothing", async () => {
    const w = await provenWorld();
    setDeps({ runner: () => ({ kind: "docker", run: async () => ({ installOk: false, results: [{ outcome: "error", durationMs: 1 }], log: "", cpuMs: 1, wallMs: 1 }) }) });
    const { strength } = await import("@/lib/workflows/strength");
    await strength(w.mem.id);
    expect((await w.reload()).strength).toBeNull();
    const off = await provenWorld(LEDGER_TEST, false);
    expect(await strength(off.mem.id)).toBeNull();
  });
});

describe.runIf(dockerAvailable())("test strength in Docker", () => {
  test("the real ledger test catches the mutants of its fix", async () => {
    const w = await provenWorld();
    const { strength } = await import("@/lib/workflows/strength");
    const r = await strength(w.mem.id);
    expect(r?.total).toBeGreaterThan(0);
    expect(r?.score).toBeGreaterThanOrEqual(50);
  }, 300_000);
});
