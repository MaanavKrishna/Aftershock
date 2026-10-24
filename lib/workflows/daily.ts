import { runNightly } from "./nightly";
import { runReproof } from "./reproof";

async function memoryTestIds(): Promise<string[]> {
  "use step";
  const { getDb } = await import("@/lib/db/client");
  const s = await import("@/lib/db/schema");
  const db = await getDb();
  return (await db.select({ id: s.memoryTests.id }).from(s.memoryTests)).map((r) => r.id);
}

async function retention(day: string): Promise<{ logs: number; deliveries: number; notifications: number }> {
  "use step";
  const { trimRetention } = await import("@/lib/data/lifecycle");
  return trimRetention(new Date(`${day}T00:00:00Z`));
}

/** Safety net for notifications whose delivery workflow died: send anything still due. */
async function sweepNotifications(): Promise<number> {
  "use step";
  const { deliverDue } = await import("@/lib/notify/outbox");
  return (await deliverDue({ limit: 500 })).sent;
}

async function visibility(): Promise<number> {
  "use step";
  const { refreshVisibility } = await import("@/lib/github/visibility");
  return refreshVisibility();
}

async function purge(day: string): Promise<{ repositories: number; workspaces: number }> {
  "use step";
  const { purgeExpired } = await import("@/lib/data/lifecycle");
  const { dbCacheStore } = await import("@/lib/runner/cacheStore");
  const store = dbCacheStore();
  return purgeExpired(new Date(`${day}T00:00:00Z`), (id) => store.deleteSnapshot(id));
}

/**
 * The one daily job (Vercel Hobby allows a daily cron). Each re-check is its own durable step, so
 * the whole run is never bound by a single function's time limit, and one failure skips only itself.
 */
export async function daily(day: string): Promise<{ day: string; nightly: number; failed: number; retention: { logs: number; deliveries: number; notifications: number }; notified: number; reproved: number; purged: { repositories: number; workspaces: number } }> {
  "use workflow";
  const ids = await memoryTestIds();
  let failed = 0;
  for (const id of ids) {
    try {
      await runNightly(id);
    } catch {
      failed++;
    }
  }
  // Weekly, on Sundays (UTC): is every memory test still guarding against its incident?
  let reproved = 0;
  if (new Date(`${day}T00:00:00Z`).getUTCDay() === 0) {
    for (const id of ids) {
      try {
        const r = await runReproof(id);
        if (r !== "skipped") reproved++;
      } catch {
        failed++;
      }
    }
  }
  const notified = await sweepNotifications();
  await visibility().catch(() => 0);
  const kept = await retention(day);
  const purged = await purge(day);
  return { day, nightly: ids.length, failed, retention: kept, notified, reproved, purged };
}
