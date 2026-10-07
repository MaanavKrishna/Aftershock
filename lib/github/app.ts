import type { Scoped } from "@/lib/db/queries/scope";
import type { ImportableIssue } from "./issues";

// Filled in with the GitHub App (plan Task 10).
export async function listClosedIncidentIssues(_scope: Scoped): Promise<ImportableIssue[]> {
  return [];
}

// Replaced by the GitHub App in plan Task 10. Public repos clone without a token.
export async function installationTokenFor(_workspaceId: string, _fullName: string): Promise<string | undefined> {
  return undefined;
}
