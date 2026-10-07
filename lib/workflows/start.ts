// Replaced by the durable workflows in plan Task 7 and Task 9.
export async function startTimeTravel(_incidentId: string, _opts: { hint?: string } = {}): Promise<{ runId: string }> {
  throw new Error("Time travel is not available yet.");
}
export async function startSuggestFix(_checkId: string): Promise<void> {
  throw new Error("Suggested fixes are not available yet.");
}
