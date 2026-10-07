import type { RunResult } from "./verdict";

export type AdmissionDecision = {
  status: "proven" | "rejected" | "unproven";
  reason: string;
  feedback?: string;
};

const count = (runs: RunResult[], outcome: RunResult["outcome"]) => runs.filter((r) => r.outcome === outcome).length;

/**
 * The admission rule: the draft must fail on every run before the fix and pass on every run on the fix.
 * Environment errors never count as a reproduction.
 */
export function decideAdmission(before: RunResult[], fix: RunResult[], runsRequired = 3): AdmissionDecision {
  if (before.length < runsRequired || fix.length < runsRequired) {
    return { status: "unproven", reason: `Needed ${runsRequired} runs on each commit; got ${before.length} before and ${fix.length} on the fix.` };
  }
  if (count(before, "error") || count(fix, "error")) {
    const failing = before.concat(fix).find((r) => r.outcome === "error");
    return {
      status: "unproven",
      reason: `The environment failed, so nothing was proven${failing?.message ? `: ${failing.message}` : "."}`,
    };
  }
  if (count(before, "passed") === before.length) {
    return {
      status: "rejected",
      reason: "The draft passed before the fix, so it does not reproduce the incident.",
      feedback: "The previous draft passed before the fix. It must exercise the exact failure described in the incident so it fails on the parent commit.",
    };
  }
  if (count(before, "failed") !== before.length) {
    return {
      status: "unproven",
      reason: `Flaky before the fix: failed ${count(before, "failed")} of ${before.length} runs.`,
      feedback: "The previous draft failed only some of the time before the fix. Remove timing or ordering dependence.",
    };
  }
  if (count(fix, "passed") !== fix.length) {
    return {
      status: "unproven",
      reason: `Did not pass on the fix: passed ${count(fix, "passed")} of ${fix.length} runs.`,
      feedback: "The previous draft also failed on the fix commit. It must pass once the fix is applied; assert only the behaviour the fix guarantees.",
    };
  }
  return { status: "proven", reason: `Failed ${before.length}/${before.length} before the fix and passed ${fix.length}/${fix.length} on it.` };
}
