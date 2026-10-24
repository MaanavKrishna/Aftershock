import { eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { github } from "./api";

/** Fills in visibility for repositories added before it was recorded (or when GitHub was unreachable). */
export async function refreshVisibility(limit = 200): Promise<number> {
  const db = await getDb();
  const unknown = await db.select().from(s.repositories).where(isNull(s.repositories.isPrivate)).limit(limit);
  let filled = 0;
  for (const r of unknown) {
    const priv = await github.repoVisibility(r.workspaceId, r.fullName).catch(() => null);
    if (priv === null) continue;
    await db.update(s.repositories).set({ isPrivate: priv }).where(eq(s.repositories.id, r.id));
    filled++;
  }
  return filled;
}
