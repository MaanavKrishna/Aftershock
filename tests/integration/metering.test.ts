import { test, expect, afterEach } from "vitest";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { setDeps } from "@/lib/timetravel/deps";
import { ledgerWorld } from "../support/world";
import { LEDGER_TEST } from "../support/fixtureRepo";

afterEach(() => setDeps({}));

const usage = async (workspaceId: string) => (await (await getDb()).select().from(s.usage).where(and(eq(s.usage.workspaceId, workspaceId), eq(s.usage.month, new Date().toISOString().slice(0, 7)))))[0]?.sandboxCpuMs ?? 0;

test("nightly re-checks on the hosted sandbox count toward the workspace's sandbox hours; Docker runs don't", async () => {
  const w = await ledgerWorld();
  const db = await getDb();
  const [mem] = await db.insert(s.memoryTests).values({ workspaceId: w.ws.id, incidentId: w.incident.id, repoId: w.repo.id, path: "tests/aftershock/test_inc_1.py", fn: "t", code: LEDGER_TEST }).returning();
  const { runNightly } = await import("@/lib/workflows/nightly");
  setDeps({ runner: () => ({ kind: "docker", run: async () => ({ installOk: true, results: [{ outcome: "passed", durationMs: 1 }], log: "", cpuMs: 4000, wallMs: 1 }) }) });
  await runNightly(mem.id);
  expect(await usage(w.ws.id)).toBe(0);
  setDeps({ runner: () => ({ kind: "sandbox", run: async () => ({ installOk: true, results: [{ outcome: "passed", durationMs: 1 }], log: "", cpuMs: 4000, wallMs: 1 }) }) });
  await runNightly(mem.id);
  expect(await usage(w.ws.id)).toBe(4000);
});

test("no hosted run starts once a workspace has used its sandbox hours, whatever started it", async () => {
  const w = await ledgerWorld();
  const db = await getDb();
  await db.insert(s.usage).values({ workspaceId: w.ws.id, month: new Date().toISOString().slice(0, 7), sandboxCpuMs: 6 * 3_600_000 });
  let started = 0;
  setDeps({ runner: () => ({ kind: "sandbox", run: async () => (started++, { installOk: true, results: [{ outcome: "passed", durationMs: 1 }], log: "", cpuMs: 1, wallMs: 1 }) }) });
  const { deps } = await import("@/lib/timetravel/deps");
  const r = await (await deps()).runner().run({ repoUrl: "x", sha: "abc", framework: "pytest", install: "true", testPath: "t.py", testCode: "", runs: 2, timeoutMs: 1000, cache: { workspaceId: w.ws.id, repoId: w.repo.id, trusted: true } });
  expect(started).toBe(0);
  expect(r.results).toHaveLength(2);
  expect(r.results[0]).toMatchObject({ outcome: "error", message: expect.stringMatching(/sandbox hours/i) });
  // Docker (self-hosted) runs are free and never blocked.
  setDeps({ runner: () => ({ kind: "docker", run: async () => (started++, { installOk: true, results: [{ outcome: "passed", durationMs: 1 }], log: "", cpuMs: 1, wallMs: 1 }) }) });
  await (await deps()).runner().run({ repoUrl: "x", sha: "abc", framework: "pytest", install: "true", testPath: "t.py", testCode: "", runs: 1, timeoutMs: 1000, cache: { workspaceId: w.ws.id, repoId: w.repo.id, trusted: true } });
  expect(started).toBe(1);
});
