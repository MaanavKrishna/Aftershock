import type { RunReport, RunSpec, Runner } from "./types";

/** Turns a runner that cannot start (provider limits, outages) into error results with a reason, instead of an exception. */
export async function runSafely(runner: Runner, spec: RunSpec): Promise<RunReport> {
  const started = Date.now();
  try {
    return await runner.run(spec);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = (err as { status?: number }).status;
    const capacity = status === 402 || /usage limit|quota|402/i.test(message);
    const reason = capacity
      ? "Sandbox capacity is used up for now (provider limit). Runs resume when capacity resets, or switch the repository to run on GitHub Actions."
      : `The runner could not start: ${message.slice(0, 300)}`;
    (await import("@/lib/obs/log")).log.error("runner could not start", { sha: spec.sha.slice(0, 12), framework: spec.framework, capacity, err });
    return {
      installOk: false,
      results: Array.from({ length: spec.runs }, () => ({ outcome: "error" as const, durationMs: 0, message: reason })),
      log: reason,
      cpuMs: 0,
      wallMs: Date.now() - started,
    };
  }
}
