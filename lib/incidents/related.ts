import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { incidentKey } from "@/lib/domain/ids";
import { similarIncidents } from "@/lib/domain/similar";
import { log } from "@/lib/obs/log";

/**
 * Has this happened before? Compares a new incident with the workspace's others and records the likely
 * matches. A strong match is announced so people look at the earlier incident (and its test) first.
 * Never throws: a failed comparison must not lose the incident.
 */
export async function linkRelated(incidentId: string): Promise<void> {
  try {
    const db = await getDb();
    const [inc] = await db.select().from(s.incidents).where(eq(s.incidents.id, incidentId));
    if (!inc) return;
    const [ws] = await db.select().from(s.workspaces).where(eq(s.workspaces.id, inc.workspaceId));
    const others = await db.select({ id: s.incidents.id, number: s.incidents.number, title: s.incidents.title, observed: s.incidents.observed, watchedFiles: s.incidents.watchedFiles }).from(s.incidents).where(and(eq(s.incidents.workspaceId, inc.workspaceId), ne(s.incidents.id, inc.id))).limit(2000);
    const matches = similarIncidents({ id: inc.id, title: inc.title, observed: `${inc.observed}\n${inc.trigger}`, files: inc.watchedFiles }, others.map((o) => ({ ...o, key: incidentKey(ws.incidentPrefix, o.number) }))).slice(0, 3);
    if (!matches.length) return;
    await db.update(s.incidents).set({ related: matches }).where(eq(s.incidents.id, inc.id));
    const top = matches[0];
    const { recordActivity } = await import("@/lib/notify/outbox");
    await recordActivity({ workspaceId: inc.workspaceId, incidentId: inc.id, title: `${incidentKey(ws.incidentPrefix, inc.number)} looks like ${top.key} again`, detail: `${top.why} (match ${Math.round(top.score * 100)}%)`, tone: "fail" });
  } catch (err) {
    log.warn("incident.related_failed", { incidentId, err });
  }
}
