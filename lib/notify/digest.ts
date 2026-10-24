import { and, count, eq, gte, lt } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { flagEnabled } from "@/lib/flags";
import { recordActivity } from "./outbox";

const DAY = 86_400_000;
const n = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;

/** On Mondays (UTC), a short week-in-review for every workspace with a target subscribed to it. Returns how many were sent. */
export async function weeklyDigests(day: string): Promise<number> {
  const end = new Date(`${day}T00:00:00Z`);
  if (end.getUTCDay() !== 1) return 0;
  const start = new Date(end.getTime() - 7 * DAY);
  const db = await getDb();
  const targets = await db.select({ workspaceId: s.notificationTargets.workspaceId, events: s.notificationTargets.events }).from(s.notificationTargets).where(eq(s.notificationTargets.enabled, true));
  const ids = [...new Set(targets.filter((t) => t.events.includes("digest.weekly")).map((t) => t.workspaceId))];
  let sent = 0;
  for (const id of ids) {
    const [ws] = await db.select().from(s.workspaces).where(eq(s.workspaces.id, id));
    if (!ws || ws.uninstalledAt || !flagEnabled("notifications", ws.settings)) continue;
    const win = <T extends { createdAt: unknown }>(col: T["createdAt"]) => and(gte(col as never, start), lt(col as never, new Date(end.getTime() + DAY)));
    const [{ opened }] = await db.select({ opened: count() }).from(s.incidents).where(and(eq(s.incidents.workspaceId, id), win(s.incidents.createdAt)));
    const [{ proven }] = await db.select({ proven: count() }).from(s.timeTravelRuns).innerJoin(s.incidents, eq(s.incidents.id, s.timeTravelRuns.incidentId)).where(and(eq(s.incidents.workspaceId, id), eq(s.timeTravelRuns.status, "proven"), win(s.timeTravelRuns.createdAt)));
    const [{ blocked }] = await db.select({ blocked: count() }).from(s.prChecks).where(and(eq(s.prChecks.workspaceId, id), eq(s.prChecks.verdict, "recur"), eq(s.prChecks.overridden, false), win(s.prChecks.createdAt)));
    const [{ checks }] = await db.select({ checks: count() }).from(s.prChecks).where(and(eq(s.prChecks.workspaceId, id), win(s.prChecks.createdAt)));
    const [{ failing }] = await db.select({ failing: count() }).from(s.memoryTests).where(and(eq(s.memoryTests.workspaceId, id), eq(s.memoryTests.health, "failing")));
    await recordActivity({
      workspaceId: id, title: `Week in review: ${n(Number(blocked), "recurrence")} blocked`,
      detail: [n(Number(opened), "incident") + " opened", n(Number(proven), "test") + " proven", n(Number(checks), "pull request check"), n(Number(blocked), "recurrence") + " blocked", ...(Number(failing) ? [n(Number(failing), "memory test") + " failing on main"] : [])].join(" · "),
      tone: Number(blocked) ? "fail" : "neutral", event: "digest.weekly",
    });
    sent++;
  }
  return sent;
}
