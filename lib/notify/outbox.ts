import { and, asc, eq, inArray, lt, lte, min, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { flagEnabled } from "@/lib/flags";
import { incidentKey } from "@/lib/domain/ids";
import { log } from "@/lib/obs/log";
import { nextDelayMs, type NotifyPayload } from "./format";

type Tone = "pass" | "fail" | "neutral" | "pending";
export type ActivityInput = { workspaceId: string; incidentId?: string | null; title: string; detail?: string; tone?: Tone; event?: s.NotifyEvent };
export type Target = typeof s.notificationTargets.$inferSelect;
export type Outbound = typeof s.notifications.$inferSelect;
export type Sender = (target: Target, row: Outbound) => Promise<{ ok: boolean; status: string }>;

/** A target is switched off after this many failed attempts in a row. */
export const DISABLE_AFTER = 10;
const STALE_CLAIM_MS = 5 * 60_000;

/**
 * The one way to write to the activity feed. Events also queue a notification for every enabled target
 * subscribed to them (outbox), then start delivery. Queueing problems are logged and never fail the caller.
 */
export async function recordActivity(a: ActivityInput): Promise<void> {
  const db = await getDb();
  await db.insert(s.activity).values({ workspaceId: a.workspaceId, incidentId: a.incidentId ?? null, title: a.title, detail: a.detail ?? "", tone: a.tone ?? "neutral" });
  if (!a.event) return;
  try {
    const [ws] = await db.select().from(s.workspaces).where(eq(s.workspaces.id, a.workspaceId));
    if (!ws || !flagEnabled("notifications", ws.settings)) return;
    const event = a.event;
    const targets = (await db.select().from(s.notificationTargets).where(and(eq(s.notificationTargets.workspaceId, ws.id), eq(s.notificationTargets.enabled, true)))).filter((t) => t.events.includes(event));
    if (!targets.length) return;
    const [inc] = a.incidentId ? await db.select({ number: s.incidents.number }).from(s.incidents).where(eq(s.incidents.id, a.incidentId)) : [];
    const base = (process.env.APP_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
    const payload: NotifyPayload = {
      event, title: a.title.slice(0, 300), detail: (a.detail ?? "").slice(0, 1000), tone: a.tone ?? "neutral", workspace: ws.login, createdAt: new Date().toISOString(),
      ...(inc ? { incident: incidentKey(ws.incidentPrefix, inc.number), url: `${base}/incidents/${inc.number}` } : { url: `${base}/overview` }),
    };
    await db.insert(s.notifications).values(targets.map((t) => ({ workspaceId: ws.id, targetId: t.id, event, payload })));
    const { startNotify } = await import("@/lib/workflows/start");
    await startNotify(ws.id);
  } catch (err) {
    log.warn("notify.queue_failed", { workspaceId: a.workspaceId, event: a.event, err });
  }
}

/**
 * Sends every due notification (optionally for one workspace). Rows are claimed with a conditional update,
 * so concurrent deliverers never send the same row twice. Returns when the next retry is due, if any.
 */
export async function deliverDue(opts: { workspaceId?: string; now?: Date; send?: Sender; limit?: number } = {}): Promise<{ sent: number; failed: number; retrying: number; nextAt: Date | null }> {
  const db = await getDb();
  const now = opts.now ?? new Date();
  const send = opts.send ?? (await import("./send")).sendNotification;
  const scope = opts.workspaceId ? eq(s.notifications.workspaceId, opts.workspaceId) : undefined;
  await db.update(s.notifications).set({ status: "pending" }).where(and(eq(s.notifications.status, "sending"), lt(s.notifications.claimedAt, new Date(now.getTime() - STALE_CLAIM_MS)), scope));
  const due = await db.select({ id: s.notifications.id }).from(s.notifications).where(and(eq(s.notifications.status, "pending"), lte(s.notifications.nextAttemptAt, now), scope)).orderBy(asc(s.notifications.createdAt)).limit(opts.limit ?? 50);
  const claimed = due.length ? await db.update(s.notifications).set({ status: "sending", claimedAt: now }).where(and(inArray(s.notifications.id, due.map((d) => d.id)), eq(s.notifications.status, "pending"))).returning() : [];

  const out = { sent: 0, failed: 0, retrying: 0 };
  for (const row of claimed) {
    const [target] = await db.select().from(s.notificationTargets).where(eq(s.notificationTargets.id, row.targetId));
    if (!target?.enabled) {
      await db.update(s.notifications).set({ status: "failed", lastError: "target disabled" }).where(eq(s.notifications.id, row.id));
      out.failed++;
      continue;
    }
    let result: { ok: boolean; status: string };
    try {
      result = await send(target, row);
    } catch (err) {
      result = { ok: false, status: (err instanceof Error ? err.message : String(err)).slice(0, 200) };
    }
    const attempts = row.attempts + 1;
    if (result.ok) {
      await db.update(s.notifications).set({ status: "sent", attempts, sentAt: now, lastError: "" }).where(eq(s.notifications.id, row.id));
      await db.update(s.notificationTargets).set({ consecutiveFailures: 0, lastStatus: result.status, lastDeliveryAt: now }).where(eq(s.notificationTargets.id, target.id));
      out.sent++;
      continue;
    }
    const delay = nextDelayMs(attempts);
    await db.update(s.notifications).set({ status: delay === null ? "failed" : "pending", attempts, lastError: result.status, nextAttemptAt: new Date(now.getTime() + (delay ?? 0)) }).where(eq(s.notifications.id, row.id));
    if (delay === null) out.failed++;
    else out.retrying++;
    const [t] = await db.update(s.notificationTargets).set({ consecutiveFailures: sql`${s.notificationTargets.consecutiveFailures} + 1`, lastStatus: result.status, lastDeliveryAt: now }).where(eq(s.notificationTargets.id, target.id)).returning();
    if (t && t.consecutiveFailures >= DISABLE_AFTER && t.enabled) {
      await db.update(s.notificationTargets).set({ enabled: false, disabledReason: `Switched off after ${t.consecutiveFailures} failed deliveries in a row (last: ${result.status}).` }).where(eq(s.notificationTargets.id, t.id));
      log.warn("notify.target_disabled", { workspaceId: t.workspaceId, targetId: t.id, status: result.status });
    }
  }
  const [next] = await db.select({ at: min(s.notifications.nextAttemptAt) }).from(s.notifications).where(and(eq(s.notifications.status, "pending"), scope));
  return { ...out, nextAt: next?.at ? new Date(next.at) : null };
}
