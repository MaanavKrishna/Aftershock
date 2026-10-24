import { sleep } from "workflow";

async function round(workspaceId: string): Promise<number | null> {
  "use step";
  const { deliverDue } = await import("@/lib/notify/outbox");
  const r = await deliverDue({ workspaceId });
  return r.nextAt ? r.nextAt.getTime() : null;
}

/** Durable timer on Vercel; a plain timer when workflows run in-process (local development). */
async function pause(ms: number): Promise<void> {
  const wait = Math.max(1000, ms);
  try {
    await sleep(wait);
  } catch {
    await new Promise((r) => setTimeout(r, wait));
  }
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
