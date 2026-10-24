import { sleep } from "workflow";

/** Durable timer on Vercel; a plain timer when workflows run in-process (local development). */
export async function pause(ms: number): Promise<void> {
  const wait = Math.max(1000, ms);
  try {
    await sleep(wait);
  } catch {
    await new Promise((r) => setTimeout(r, wait));
  }
}
