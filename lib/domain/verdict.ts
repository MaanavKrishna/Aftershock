export type RunOutcome = "passed" | "failed" | "error";
export type RunResult = { outcome: RunOutcome; durationMs: number; message?: string };
export type PrVerdict = "recur" | "safe" | "inconclusive" | "skipped";

/** One memory test's verdict on a head commit. Mixed results are never green. */
export function prVerdict(runs: RunResult[]): PrVerdict {
  if (runs.length === 0) return "skipped";
  if (runs.some((r) => r.outcome === "error")) return "inconclusive";
  if (runs.every((r) => r.outcome === "failed")) return "recur";
  if (runs.every((r) => r.outcome === "passed")) return "safe";
  return "inconclusive";
}

/** The pull request's overall verdict from its per-test verdicts. */
export function aggregatePr(verdicts: PrVerdict[]): PrVerdict {
  if (verdicts.includes("recur")) return "recur";
  if (verdicts.includes("inconclusive")) return "inconclusive";
  if (verdicts.includes("safe")) return "safe";
  return "skipped";
}
