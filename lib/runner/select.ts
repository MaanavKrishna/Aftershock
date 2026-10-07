/** Where a pull request check runs. Time travel always uses the sandbox (or Docker locally). */
export function pickRunner(repo: { runner: string }, quota: { remainingCpuMs: number }, hasWorkflow: boolean): "sandbox" | "actions" | "unavailable" {
  if (repo.runner === "actions") return "actions";
  if (quota.remainingCpuMs > 0) return "sandbox";
  return hasWorkflow ? "actions" : "unavailable";
}
