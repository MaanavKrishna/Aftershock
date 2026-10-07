import { test, expect } from "vitest";
import { timeTravel } from "@/lib/workflows/timeTravel";
import { setDeps } from "@/lib/timetravel/deps";
import { DockerRunner } from "@/lib/runner/docker";
import { ledgerWorld } from "../support/world";
import { LEDGER_TEST, dockerAvailable } from "../support/fixtureRepo";

test.skipIf(!dockerAvailable())("a real test is proven against real commits in Docker", async () => {
  const w = await ledgerWorld();
  setDeps({
    runner: () => new DockerRunner(),
    drafter: () => ({ draft: async () => ({ path: "tests/aftershock/test_inc_1.py", code: LEDGER_TEST, model: "fixed" }) }),
    openBotPr: async () => null,
  });
  await timeTravel(w.incident.id, {});
  const [run] = await w.runs();
  expect(run.beforeResults.map((r) => r.outcome)).toEqual(["failed", "failed", "failed"]);
  expect(run.fixResults.map((r) => r.outcome)).toEqual(["passed", "passed", "passed"]);
  expect(run.status).toBe("proven");
  expect((await w.reload()).status).toBe("proven");
  expect(run.log).toMatch(/before the fix/);
}, 600_000);
