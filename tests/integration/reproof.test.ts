import { describe, test, expect, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { setDeps } from "@/lib/timetravel/deps";
import { setStartOverride } from "@/lib/workflows/start";
import type { RunSpec } from "@/lib/runner/types";
import { ledgerWorld } from "../support/world";
import { LEDGER_TEST, dockerAvailable } from "../support/fixtureRepo";

afterEach(() => {
  setDeps({});
  setStartOverride(null);
});

async function provenWorld(code = LEDGER_TEST) {
  const w = await ledgerWorld();
  const db = await getDb();
  await db.update(s.workspaces).set({ settings: { flags: { reproof: true } } }).where(eq(s.workspaces.id, w.ws.id));
  await db.update(s.incidents).set({ status: "proven", parentSha: w.git.parent }).where(eq(s.incidents.id, w.incident.id));
  const [mem] = await db.insert(s.memoryTests).values({ workspaceId: w.ws.id, incidentId: w.incident.id, repoId: w.repo.id, path: "tests/aftershock/test_inc_1.py", fn: "test_retry_is_rejected", code }).returning();
  const reload = async () => (await db.select().from(s.memoryTests).where(eq(s.memoryTests.id, mem.id)))[0];
  const commit = (file: string, content: string) => {
    fs.writeFileSync(path.join(w.git.dir, file), content);
    execFileSync("git", ["-C", w.git.dir, "commit", "-qam", "later change"]);
  };
  return { ...w, mem, reload, commit };
}

const fakeRunner = (outcome: "passed" | "failed", seen: RunSpec[]) =>
  setDeps({ runner: () => ({ kind: "docker", run: async (spec) => (seen.push(spec), { installOk: true, results: Array.from({ length: spec.runs }, () => ({ outcome, durationMs: 1 })), log: "", cpuMs: 5, wallMs: 5 }) }) });

describe("re-proof", () => {
  test("the fix is undone on today's main (later edits kept) and a failing test means still guarding", async () => {
    const w = await provenWorld();
    w.commit("ledger.py", "# payments\n" + fs.readFileSync(path.join(w.git.dir, "ledger.py"), "utf8"));
    const seen: RunSpec[] = [];
    fakeRunner("failed", seen);
    const { runReproof } = await import("@/lib/workflows/reproof");
    expect(await runReproof(w.mem.id)).toBe("guarding");
    const head = execFileSync("git", ["-C", w.git.dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    expect(seen[0].sha).toBe(head);
    expect(seen[0].overlay).toEqual([{ path: "ledger.py", content: "# payments\nPAYMENTS = []\n\n\ndef pay(order_id):\n    PAYMENTS.append(order_id)\n    return 201\n" }]);
    expect(seen[0].runs).toBe(2);
    expect(await w.reload()).toMatchObject({ guardStatus: "guarding", guardSha: head });
  });
  test("a test that passes with the fix undone is weak, and that is announced", async () => {
    const w = await provenWorld();
    await (await getDb()).update(s.memoryTests).set({ guardStatus: "guarding" }).where(eq(s.memoryTests.id, w.mem.id));
    fakeRunner("passed", []);
    const { runReproof } = await import("@/lib/workflows/reproof");
    expect(await runReproof(w.mem.id)).toBe("weak");
    const acts = await (await getDb()).select().from(s.activity).where(eq(s.activity.incidentId, w.incident.id));
    expect(acts.map((a) => a.title)).toContain("Memory test no longer guards INC-1");
  });
  test("when the fixed lines were rewritten since, the test is drifted and nothing runs", async () => {
    const w = await provenWorld();
    w.commit("ledger.py", "PAYMENTS = set()\n\n\ndef pay(order_id):\n    if order_id in PAYMENTS:\n        return 409\n    PAYMENTS.add(order_id)\n    return 201\n");
    const seen: RunSpec[] = [];
    fakeRunner("failed", seen);
    const { runReproof } = await import("@/lib/workflows/reproof");
    expect(await runReproof(w.mem.id)).toBe("drifted");
    expect(seen).toEqual([]);
    expect((await w.reload()).guardDetail).toMatch(/ledger\.py/);
  });
  test("mixed or broken runs leave the status unchanged", async () => {
    const w = await provenWorld();
    setDeps({ runner: () => ({ kind: "docker", run: async () => ({ installOk: false, results: [{ outcome: "error", durationMs: 1 }, { outcome: "error", durationMs: 1 }], log: "", cpuMs: 1, wallMs: 1 }) }) });
    const { runReproof } = await import("@/lib/workflows/reproof");
    expect(await runReproof(w.mem.id)).toBe("inconclusive");
    expect((await w.reload()).guardStatus).toBeNull();
  });
  test("skipped when the flag is off or the test is failing on main", async () => {
    const w = await provenWorld();
    const db = await getDb();
    await db.update(s.workspaces).set({ settings: {} }).where(eq(s.workspaces.id, w.ws.id));
    const { runReproof } = await import("@/lib/workflows/reproof");
    expect(await runReproof(w.mem.id)).toBe("skipped");
    await db.update(s.workspaces).set({ settings: { flags: { reproof: true } } }).where(eq(s.workspaces.id, w.ws.id));
    await db.update(s.memoryTests).set({ health: "failing" }).where(eq(s.memoryTests.id, w.mem.id));
    expect(await runReproof(w.mem.id)).toBe("skipped");
  });
  test("the daily job re-proves weekly, on Sundays", async () => {
    const w = await provenWorld();
    // Like the real thing: passes on main, fails once the fix is undone.
    setDeps({ runner: () => ({ kind: "docker", run: async (spec) => ({ installOk: true, results: Array.from({ length: spec.runs }, () => ({ outcome: spec.overlay ? ("failed" as const) : ("passed" as const), durationMs: 1 })), log: "", cpuMs: 1, wallMs: 1 }) }) });
    const { daily } = await import("@/lib/workflows/daily");
    const sat = await daily("2026-10-24");
    expect(sat.reproved).toBe(0);
    const sun = await daily("2026-10-25");
    expect(sun.reproved).toBeGreaterThanOrEqual(1);
    expect((await w.reload()).guardStatus).toBe("guarding");
  });
});

describe.runIf(dockerAvailable())("re-proof in Docker", () => {
  test("a real proven test still guards; a test that asserts nothing is weak", async () => {
    const w = await provenWorld();
    const { runReproof } = await import("@/lib/workflows/reproof");
    expect(await runReproof(w.mem.id)).toBe("guarding");
    const weak = await provenWorld("def test_nothing():\n    assert True\n");
    expect(await runReproof(weak.mem.id)).toBe("weak");
  }, 240_000);
});
