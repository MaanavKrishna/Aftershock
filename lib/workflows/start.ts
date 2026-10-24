import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";

/**
 * Durable on Vercel (Workflow SDK `start`); in local development and tests the same
 * orchestration runs in-process in the background.
 */
const durable = () => process.env.AFTERSHOCK_WORKFLOWS === "durable" || (Boolean(process.env.VERCEL) && process.env.AFTERSHOCK_WORKFLOWS !== "inline");

type Override = (kind: string, id: string) => void;
let override: Override | null = null;
/** Tests record starts instead of running workflows. */
export function setStartOverride(o: Override | null) {
  override = o;
}

async function launch<A extends unknown[]>(fn: (...args: A) => Promise<unknown>, args: A, label: string): Promise<void> {
  if (override) {
    override(fn.name, String(args[0]));
    return;
  }
  const { log } = await import("@/lib/obs/log");
  log.info("workflow started", { workflow: label, id: String(args[0]), durable: durable() });
  if (durable()) {
    const { start } = await import("workflow/api");
    await start(fn as never, args as never);
    return;
  }
  void fn(...args).catch((err) => log.error("workflow failed", { workflow: label, id: String(args[0]), err }));
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

export async function startNightly(memoryTestId: string): Promise<void> {
  const { nightly } = await import("./nightly");
  await launch(nightly, [memoryTestId], "nightly re-check");
}

/** The single daily job: nightly re-checks now; retention and re-proof hook in here too. */
export async function startDaily(day: string): Promise<void> {
  const { daily } = await import("./daily");
  await launch(daily, [day], "daily");
}

export async function startNotify(workspaceId: string): Promise<void> {
  const { notify } = await import("./notify");
  await launch(notify, [workspaceId], "notifications");
}

export async function startReproof(memoryTestId: string): Promise<void> {
  const { reproof } = await import("./reproof");
  await launch(reproof, [memoryTestId], "re-proof");
}

export async function startBackfill(workspaceId: string, limit: number): Promise<void> {
  const { backfill } = await import("./backfill");
  await launch(backfill, [workspaceId, limit], "backfill");
}
