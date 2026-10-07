import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";

/**
 * Durable on Vercel (Workflow SDK `start`); in local development and tests the same
 * orchestration runs in-process in the background.
 */
const durable = () => process.env.AFTERSHOCK_WORKFLOWS === "durable" || (Boolean(process.env.VERCEL) && process.env.AFTERSHOCK_WORKFLOWS !== "inline");

async function launch<A extends unknown[]>(fn: (...args: A) => Promise<unknown>, args: A, label: string): Promise<void> {
  if (durable()) {
    const { start } = await import("workflow/api");
    await start(fn as never, args as never);
    return;
  }
  void fn(...args).catch((err) => console.error(`[aftershock] ${label} failed`, err));
}

export async function startTimeTravel(incidentId: string, opts: { hint?: string } = {}): Promise<void> {
  const db = await getDb();
  await db.update(s.incidents).set({ status: "traveling", statusReason: null, updatedAt: new Date() }).where(eq(s.incidents.id, incidentId));
  const { timeTravel } = await import("./timeTravel");
  await launch(timeTravel, [incidentId, opts], "time travel");
}

export async function startSuggestFix(checkId: string): Promise<void> {
  const { suggestFix } = await import("./suggestFix");
  await launch(suggestFix, [checkId], "suggested fix");
}

export async function startRetroCheck(memoryTestId: string): Promise<void> {
  const { retroCheck } = await import("./retroCheck");
  await launch(retroCheck, [memoryTestId], "retro-check");
}

export async function startEpicenter(memoryTestId: string): Promise<void> {
  const { epicenter } = await import("./epicenter");
  await launch(epicenter, [memoryTestId], "epicenter");
}

export async function startPrCheck(checkId: string): Promise<void> {
  const { prCheck } = await import("./prCheck");
  await launch(prCheck, [checkId], "pull request check");
}
