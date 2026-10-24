import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";

/** Adds hosted sandbox time to the workspace's monthly usage. Docker and Actions runs are free and not counted. */
export async function meterSandbox(workspaceId: string, cpuMs: number, runnerKind: string): Promise<void> {
  if (runnerKind !== "sandbox" || !(cpuMs > 0)) return;
  const month = new Date().toISOString().slice(0, 7);
  await (await getDb())
    .insert(s.usage)
    .values({ workspaceId, month, sandboxCpuMs: Math.round(cpuMs) })
    .onConflictDoUpdate({ target: [s.usage.workspaceId, s.usage.month], set: { sandboxCpuMs: sql`${s.usage.sandboxCpuMs} + ${Math.round(cpuMs)}` } });
}
