import { describe, test, expect, beforeEach } from "vitest";
import { timeTravel } from "@/lib/workflows/timeTravel";
import { setDeps, type Drafter } from "@/lib/timetravel/deps";
import type { Runner, RunSpec } from "@/lib/runner/types";
import type { RunResult } from "@/lib/domain/verdict";
import { ledgerWorld } from "../support/world";

const r = (o: RunResult["outcome"], message?: string): RunResult => ({ outcome: o, durationMs: 5, message });

/** Fake runner: decides outcomes per commit and per draft code. */
function fakeRunner(decide: (spec: RunSpec) => RunResult["outcome"], message?: string): Runner {
  return { kind: "docker", run: async (spec) => ({ installOk: true, results: Array.from({ length: spec.runs }, () => r(decide(spec), message)), log: `ran ${spec.sha.slice(0, 7)}`, cpuMs: 10, wallMs: 20 }) };
}

function fakeDrafter(codes: string[]): Drafter & { inputs: { feedback?: string; hint?: string }[] } {
  const inputs: { feedback?: string; hint?: string }[] = [];
  return {
    inputs,
    draft: async (input) => {
      inputs.push({ feedback: input.feedback, hint: input.hint });
      const code = codes[Math.min(inputs.length - 1, codes.length - 1)];
      if (code === "INVALID") throw Object.assign(new Error("Model returned more than one file"), { name: "InvalidModelOutput" });
      return { path: "tests/aftershock/test_inc_1.py", code, model: "fake-model", tokens: 100 };
    },
  };
}

let bot: string[];
beforeEach(() => {
  bot = [];
});

describe("time travel", () => {
  test("a draft that fails before the fix and passes on it is proven, stored, and proposed in a bot PR", async () => {
    const w = await ledgerWorld();
    const drafter = fakeDrafter(["GOOD"]);
    setDeps({ runner: () => fakeRunner((s) => (s.sha === w.git.parent ? "failed" : "passed")), drafter: () => drafter, openBotPr: async ({ path }) => (bot.push(path), 77) });
    await timeTravel(w.incident.id, {});
    const inc = await w.reload();
    expect(inc.status).toBe("proven");
    expect(inc.parentSha).toBe(w.git.parent);
    expect(inc.watchedFiles).toEqual(["ledger.py"]);
    const [mem] = await w.memory();
    expect(mem.path).toBe("tests/aftershock/test_inc_1.py");
    expect(mem.botPr).toBe(77);
    expect(bot).toEqual(["tests/aftershock/test_inc_1.py"]);
    const runs = await w.runs();
    expect(runs.map((x) => x.status)).toEqual(["proven"]);
    expect(runs[0].beforeResults.map((x) => x.outcome)).toEqual(["failed", "failed", "failed"]);
  });

  test("proving an incident again replaces its memory test instead of adding a second one", async () => {
    const w = await ledgerWorld();
    setDeps({ runner: () => fakeRunner((s) => (s.sha === w.git.parent ? "failed" : "passed")), drafter: () => fakeDrafter(["GOOD"]), openBotPr: async () => null });
    await timeTravel(w.incident.id, {});
    setDeps({ runner: () => fakeRunner((s) => (s.sha === w.git.parent ? "failed" : "passed")), drafter: () => fakeDrafter(["BETTER"]), openBotPr: async () => null });
    await timeTravel(w.incident.id, {});
    const mem = await w.memory();
    expect(mem.length).toBe(1);
    expect(mem[0].code).toBe("BETTER");
  });

  test("a model timeout is retried within the same attempt instead of ending time travel", async () => {
    const w = await ledgerWorld();
    let calls = 0;
    const drafter: Drafter = {
      draft: async () => {
        calls++;
        if (calls < 3) throw Object.assign(new Error("Request timed out."), { name: "APIConnectionTimeoutError" });
        return { path: "tests/aftershock/test_inc_1.py", code: "GOOD", model: "fake-model", tokens: 1 };
      },
    };
    setDeps({ runner: () => fakeRunner((s) => (s.sha === w.git.parent ? "failed" : "passed")), drafter: () => drafter, openBotPr: async () => null, retryDelayMs: 0 });
    await timeTravel(w.incident.id, {});
    expect(calls).toBe(3);
    expect((await w.runs()).map((x) => x.status)).toEqual(["proven"]);
  });

  test("a rejected draft feeds its failure into the next draft, which can be proven", async () => {
    const w = await ledgerWorld();
    const drafter = fakeDrafter(["WEAK", "GOOD"]);
    setDeps({ runner: () => fakeRunner((s) => (s.testCode === "WEAK" ? "passed" : s.sha === w.git.parent ? "failed" : "passed")), drafter: () => drafter, openBotPr: async () => null });
    await timeTravel(w.incident.id, {});
    expect((await w.runs()).map((x) => x.status)).toEqual(["rejected", "proven"]);
    expect(drafter.inputs[1].feedback).toMatch(/passed before the fix/);
    expect((await w.reload()).status).toBe("proven");
  });

  test("three drafts that never reproduce leave the incident unproven", async () => {
    const w = await ledgerWorld();
    setDeps({ runner: () => fakeRunner(() => "passed"), drafter: () => fakeDrafter(["WEAK"]), openBotPr: async () => null });
    await timeTravel(w.incident.id, {});
    expect((await w.runs()).map((x) => x.status)).toEqual(["rejected", "rejected", "rejected"]);
    const inc = await w.reload();
    expect(inc.status).toBe("unproven");
    expect(await w.memory()).toEqual([]);
  });

  test("environment errors are never treated as a reproduction and stop redrafting", async () => {
    const w = await ledgerWorld();
    const drafter = fakeDrafter(["GOOD"]);
    setDeps({ runner: () => fakeRunner(() => "error", "Dependency install failed (exit 1)"), drafter: () => drafter, openBotPr: async () => null });
    await timeTravel(w.incident.id, {});
    const runs = await w.runs();
    expect(runs.map((x) => x.status)).toEqual(["unproven"]);
    expect(runs[0].reason).toMatch(/environment/i);
    expect(drafter.inputs).toHaveLength(1);
    expect((await w.reload()).status).toBe("unproven");
  });

  test("invalid model output is recorded and the next draft is tried", async () => {
    const w = await ledgerWorld();
    const drafter = fakeDrafter(["INVALID", "GOOD"]);
    setDeps({ runner: () => fakeRunner((s) => (s.sha === w.git.parent ? "failed" : "passed")), drafter: () => drafter, openBotPr: async () => null });
    await timeTravel(w.incident.id, {});
    const runs = await w.runs();
    expect(runs.map((x) => x.status)).toEqual(["unproven", "proven"]);
    expect(runs[0].reason).toMatch(/more than one file/);
  });

  test("a fix that is the root commit cannot be time-travelled and stays awaiting fix with a reason", async () => {
    const w = await ledgerWorld("root");
    setDeps({ runner: () => fakeRunner(() => "failed"), drafter: () => fakeDrafter(["GOOD"]), openBotPr: async () => null });
    await timeTravel(w.incident.id, {});
    const inc = await w.reload();
    expect(inc.status).toBe("awaiting_fix");
    expect(inc.statusReason).toMatch(/first commit/);
    expect(await w.runs()).toEqual([]);
  });

  test("an unknown fix SHA stays awaiting fix with a reason", async () => {
    const w = await ledgerWorld("missing");
    setDeps({ runner: () => fakeRunner(() => "failed"), drafter: () => fakeDrafter(["GOOD"]), openBotPr: async () => null });
    await timeTravel(w.incident.id, {});
    const inc = await w.reload();
    expect(inc.status).toBe("awaiting_fix");
    expect(inc.statusReason).toMatch(/does not exist/);
  });

  test("a hint is passed to the first draft of a retry, and attempts keep counting", async () => {
    const w = await ledgerWorld();
    const d1 = fakeDrafter(["WEAK"]);
    setDeps({ runner: () => fakeRunner(() => "passed"), drafter: () => d1, openBotPr: async () => null });
    await timeTravel(w.incident.id, {});
    const d2 = fakeDrafter(["GOOD"]);
    setDeps({ runner: () => fakeRunner((s) => (s.sha === w.git.parent ? "failed" : "passed")), drafter: () => d2, openBotPr: async () => null });
    await timeTravel(w.incident.id, { hint: "retry twice" });
    expect(d2.inputs[0].hint).toBe("retry twice");
    expect((await w.runs()).map((x) => x.attempt)).toEqual([1, 2, 3, 4]);
  });
});
