import { runNightly } from "./nightly";

async function memoryTestIds(): Promise<string[]> {
  "use step";
  const { getDb } = await import("@/lib/db/client");
  const s = await import("@/lib/db/schema");
  const db = await getDb();
  return (await db.select({ id: s.memoryTests.id }).from(s.memoryTests)).map((r) => r.id);
}

/**
 * The one daily job (Vercel Hobby allows a daily cron). Each re-check is its own durable step, so
 * the whole run is never bound by a single function's time limit, and one failure skips only itself.
 */
export async function daily(day: string): Promise<{ day: string; nightly: number; failed: number }> {
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
  return { day, nightly: ids.length, failed };
}
