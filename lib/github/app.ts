import type { Scoped } from "@/lib/db/queries/scope";
import type { ImportableIssue } from "./issues";

// Filled in with the GitHub App (plan Task 10).
export async function listClosedIncidentIssues(_scope: Scoped): Promise<ImportableIssue[]> {
  return [];
}
