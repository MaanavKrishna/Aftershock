import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { incidentKey } from "@/lib/domain/ids";
import { fieldsFromIssue } from "@/lib/domain/issueBody";
import type { ImportableIssue } from "@/lib/github/issues";
import { recordActivity } from "@/lib/notify/outbox";

/** Inserts an incident with the next number, retrying if two inserts race for the same number. */
export async function insertIncident(workspaceId: string, values: Omit<typeof s.incidents.$inferInsert, "workspaceId" | "number">) {
  const db = await getDb();
  const { scoped } = await import("@/lib/db/queries/scope");
  for (let tries = 0; tries < 3; tries++) {
    const number = await scoped(workspaceId).nextIncidentNumber();
    try {
      const [row] = await db.insert(s.incidents).values({ ...values, workspaceId, number }).returning();
      return row;
    } catch (err) {
      if (tries === 2) throw err;
    }
  }
  throw new Error("unreachable");
}

/** A closed GitHub issue becomes an incident (with its fix when the issue was closed by one). */
export async function importIssueAsIncident(workspaceId: string, prefix: string, issue: ImportableIssue) {
  const hasFix = Boolean(issue.fixSha || issue.fixPr);
  const row = await insertIncident(workspaceId, {
    repoId: issue.repoId, title: issue.title, ...fieldsFromIssue(issue.body), source: "issue", sourceRef: `${issue.repo}#${issue.number}`,
    fixSha: issue.fixSha ?? null, parentSha: issue.parentSha ?? null, fixPr: issue.fixPr ?? null, status: "awaiting_fix",
    statusReason: hasFix ? null : "The issue was closed without a linked fix. Link the fix commit or PR to start time travel.",
  });
  await recordActivity({ workspaceId, incidentId: row.id, title: `Imported from issue #${issue.number}`, detail: `${incidentKey(prefix, row.number)} · ${issue.repo}`, tone: "pass", event: "incident.opened" });
  return { row, hasFix };
}
