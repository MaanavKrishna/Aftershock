import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { incidentKey } from "@/lib/domain/ids";
import { fieldsFromIssue } from "@/lib/domain/issueBody";
import type { ImportableIssue } from "@/lib/github/issues";
import { recordActivity } from "@/lib/notify/outbox";

type Values = Omit<typeof s.incidents.$inferInsert, "workspaceId" | "number">;

/** Thrown when an alert with the same fingerprint already became an incident (possibly a moment ago). */
export class DuplicateIncident extends Error {
  constructor(readonly existing: typeof s.incidents.$inferSelect) {
    super(`Duplicate of incident ${existing.number}`);
  }
}

const constraintOf = (err: unknown): string => {
  const e = err as { constraint?: string; cause?: { constraint?: string }; message?: string };
  return e.constraint ?? e.cause?.constraint ?? e.message ?? "";
};

/**
 * The one way to create an incident: takes the next number, retries when another insert took it first
 * (alerts often arrive together), refuses duplicate alert fingerprints, then links similar past incidents.
 */
export async function insertIncident(workspaceId: string, values: Values | ((number: number) => Values)) {
  const db = await getDb();
  const { scoped } = await import("@/lib/db/queries/scope");
  for (let tries = 0; tries < 8; tries++) {
    const number = await scoped(workspaceId).nextIncidentNumber();
    const v = typeof values === "function" ? values(number) : values;
    try {
      const [row] = await db.insert(s.incidents).values({ ...v, workspaceId, number }).returning();
      const { linkRelated } = await import("./related");
      await linkRelated(row.id);
      return row;
    } catch (err) {
      const c = constraintOf(err);
      if (c.includes("incidents_workspace_fingerprint") && v.fingerprint) {
        const [existing] = await db.select().from(s.incidents).where(and(eq(s.incidents.workspaceId, workspaceId), eq(s.incidents.fingerprint, v.fingerprint)));
        if (existing) throw new DuplicateIncident(existing);
      }
      if (!c.includes("incidents_workspace_number") || tries === 7) throw err;
      await new Promise((r) => setTimeout(r, 5 + Math.random() * 20 * (tries + 1)));
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
