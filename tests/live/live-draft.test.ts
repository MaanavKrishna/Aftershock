import { test, expect } from "vitest";
import { timeTravel } from "@/lib/workflows/timeTravel";
import { setDeps } from "@/lib/timetravel/deps";
import { DockerRunner } from "@/lib/runner/docker";
import { modelDrafter } from "@/lib/model/draft";
import { ledgerWorld } from "../support/world";

// Opt-in: AFTERSHOCK_LIVE=1 npx vitest run tests/live — calls the configured model.
test.skipIf(process.env.AFTERSHOCK_LIVE !== "1")("the configured model drafts a test that time travel proves", async () => {
  const w = await ledgerWorld();
  setDeps({ runner: () => new DockerRunner(), drafter: () => modelDrafter(), openBotPr: async () => null });
  await timeTravel(w.incident.id, {});
  const runs = await w.runs();
  console.log(runs.map((r) => `attempt ${r.attempt}: ${r.status} — ${r.reason}`).join("\n"));
  console.log(runs.at(-1)?.testCode);
  expect(runs.length).toBeGreaterThan(0);
}, 900_000);
