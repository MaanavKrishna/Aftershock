import { pause } from "./pause";

/** Time travels running at once for one workspace during a backfill, so imports don't flood the runners. */
export const BACKFILL_CONCURRENCY = 3;
export const BACKFILL_MAX = 25;

async function importBatch(workspaceId: string, limit: number): Promise<{ id: string; hasFix: boolean }[]> {
  "use step";
  const { scoped } = await import("@/lib/db/queries/scope");
  const { listImportableIssues } = await import("@/lib/github/issues");
  const { importIssueAsIncident } = await import("@/lib/incidents/create");
  const sc = scoped(workspaceId);
  const ws = await sc.workspace();
  if (!ws) return [];
  const issues = (await listImportableIssues(sc)).slice(0, Math.min(limit, BACKFILL_MAX));
  const out: { id: string; hasFix: boolean }[] = [];
  for (const issue of issues) {
    const { row, hasFix } = await importIssueAsIncident(workspaceId, ws.incidentPrefix, issue);
    out.push({ id: row.id, hasFix });
  }
  return out;
}

async function travelling(workspaceId: string): Promise<number> {
  "use step";
  const { and, eq } = await import("drizzle-orm");
  const { getDb } = await import("@/lib/db/client");
  const s = await import("@/lib/db/schema");
  return (await (await getDb()).select({ id: s.incidents.id }).from(s.incidents).where(and(eq(s.incidents.workspaceId, workspaceId), eq(s.incidents.status, "traveling")))).length;
}

async function startTravel(incidentId: string): Promise<void> {
  "use step";
  const { startTimeTravel } = await import("./start");
  await startTimeTravel(incidentId);
}

/** Imports the workspace's closed incident issues and proves the ones that have a fix, a few at a time. */
export async function backfill(workspaceId: string, limit: number): Promise<{ imported: number; travelling: number }> {
  "use workflow";
  const imported = await importBatch(workspaceId, limit);
  const queue = imported.filter((x) => x.hasFix);
  for (const x of queue) {
    for (let i = 0; i < 90 && (await travelling(workspaceId)) >= BACKFILL_CONCURRENCY; i++) await pause(60_000);
    await startTravel(x.id);
  }
  return { imported: imported.length, travelling: queue.length };
}
