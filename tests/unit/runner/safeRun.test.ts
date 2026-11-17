import { describe, test, expect, vi, afterEach } from "vitest";
import { runSafely } from "@/lib/runner/safeRun";
import { log } from "@/lib/obs/log";
import type { RunReport, RunSpec, Runner } from "@/lib/runner/types";

const spec: RunSpec = { repoUrl: "https://github.com/x/y.git", sha: "0123456789abcdef0123", framework: "pytest", install: "pip install -r requirements.txt", testPath: "tests/t.py", testCode: "", runs: 3, timeoutMs: 1000 };
const failing = (err: unknown): Runner => ({ kind: "sandbox", run: async () => Promise.reject(err) });

afterEach(() => vi.restoreAllMocks());

describe("runSafely", () => {
  test("passes a successful report through untouched", async () => {
    const report: RunReport = { installOk: true, results: [{ outcome: "passed", durationMs: 4 }], log: "ok", cpuMs: 7, wallMs: 9 };
    const run = vi.fn(async () => report);
    expect(await runSafely({ kind: "docker", run }, spec)).toBe(report);
    expect(run).toHaveBeenCalledWith(spec);
  });

  test("a runner that cannot start becomes one error result per run, with the reason", async () => {
    const error = vi.spyOn(log, "error").mockImplementation(() => undefined);
    const r = await runSafely(failing(new Error("connection reset")), spec);
    expect(r.installOk).toBe(false);
    expect(r.cpuMs).toBe(0);
    expect(r.wallMs).toBeGreaterThanOrEqual(0);
    expect(r.log).toBe("The runner could not start: connection reset");
    expect(r.results).toEqual(Array.from({ length: 3 }, () => ({ outcome: "error", durationMs: 0, message: "The runner could not start: connection reset" })));
    expect(error).toHaveBeenCalledWith("runner could not start", expect.objectContaining({ sha: "0123456789ab", framework: "pytest", capacity: false }));
  });

  test("provider capacity limits (HTTP 402, quota, usage limit) get a plain explanation", async () => {
    vi.spyOn(log, "error").mockImplementation(() => undefined);
    const cases: unknown[] = [Object.assign(new Error("Payment Required"), { status: 402 }), new Error("You have reached your usage limit"), new Error("QUOTA exceeded"), new Error("request failed with 402")];
    for (const err of cases) {
      const r = await runSafely(failing(err), spec);
      expect(r.log).toMatch(/^Sandbox capacity is used up for now/);
      expect(r.results[0].message).toBe(r.log);
    }
  });

  test("non-Error throws and very long messages are handled", async () => {
    vi.spyOn(log, "error").mockImplementation(() => undefined);
    expect((await runSafely(failing("plain string"), { ...spec, runs: 1 })).log).toBe("The runner could not start: plain string");
    const long = await runSafely(failing(new Error("x".repeat(1000))), spec);
    expect(long.log.length).toBe("The runner could not start: ".length + 300);
  });
});
