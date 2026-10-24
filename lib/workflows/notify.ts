import { pause } from "./pause";

async function round(workspaceId: string): Promise<number | null> {
  "use step";
  const { deliverDue } = await import("@/lib/notify/outbox");
  const r = await deliverDue({ workspaceId });
  return r.nextAt ? r.nextAt.getTime() : null;
}

/** Delivers a workspace's queued notifications, retrying with back-off until nothing is pending. */
export async function notify(workspaceId: string): Promise<void> {
  "use workflow";
  for (let i = 0; i < 6; i++) {
    const next = await round(workspaceId);
    if (next === null) return;
    await pause(next - Date.now());
  }
}
