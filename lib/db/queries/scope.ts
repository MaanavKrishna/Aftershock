import { and, desc, eq, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";

export type IncidentFilter = { status?: s.IncidentStatus; source?: s.IncidentSource };

/**
 * Every read and write for a signed-in request goes through here, so no query can
 * forget the workspace filter.
 */
export function scoped(workspaceId: string) {
  const mine = eq(s.incidents.workspaceId, workspaceId);
  return {
    workspaceId,
    async getIncident(number: number) {
      const db = await getDb();
      const [row] = await db.select().from(s.incidents).where(and(mine, eq(s.incidents.number, number)));
      return row ?? null;
    },
    async listIncidents(filter: IncidentFilter) {
      const db = await getDb();
      const where: SQL[] = [mine];
      if (filter.status) where.push(eq(s.incidents.status, filter.status));
      if (filter.source) where.push(eq(s.incidents.source, filter.source));
      return db.select().from(s.incidents).where(and(...where)).orderBy(desc(s.incidents.number));
    },
  };
}
export type Scoped = ReturnType<typeof scoped>;
