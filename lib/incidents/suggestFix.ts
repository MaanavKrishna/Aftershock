import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { incidentKey } from "@/lib/domain/ids";
import { extractPaths } from "@/lib/domain/similar";
import { github } from "@/lib/github/api";
import { recordActivity } from "@/lib/notify/outbox";

/**
 * For incidents still awaiting a fix, a merged pull request that changes the files they point at
 * (watched files, or paths in the alert's stack trace) is suggested as the fix. A person confirms it;
 * nothing starts on its own. Returns the incident keys that got a suggestion.
 */
export async function suggestFixes(ws: typeof s.workspaces.$inferSelect, repo: typeof s.repositories.$inferSelect, pr: { number: number; sha: string; title: string }, alreadyReferenced: number[]): Promise<string> {
  if (!/^[0-9a-f]{40}$/.test(pr.sha)) return "";
  const db = await getDb();
  const waiting = await db
    .select()
    .from(s.incidents)
    .where(and(eq(s.incidents.workspaceId, ws.id), eq(s.incidents.status, "awaiting_fix"), isNull(s.incidents.fixSha), or(eq(s.incidents.repoId, repo.id), isNull(s.incidents.repoId))));
  const candidates = waiting.filter((i) => !alreadyReferenced.includes(i.number) && !i.suggestedFix);
  if (!candidates.length) return "";
  const { files } = await github.prFiles(ws.id, repo.fullName, pr.number);
  if (!files.length) return "";
  const keys: string[] = [];
  for (const inc of candidates) {
    const pointsAt = new Set([...inc.watchedFiles, ...extractPaths(`${inc.observed}\n${inc.trigger}`)]);
    const hit = files.find((f) => pointsAt.has(f) || [...pointsAt].some((p) => p.endsWith(`/${f}`) || f.endsWith(`/${p}`)));
    if (!hit) continue;
    await db.update(s.incidents).set({ suggestedFix: { pr: pr.number, sha: pr.sha, title: pr.title.slice(0, 200), why: `changes ${hit}` } }).where(and(eq(s.incidents.id, inc.id), inArray(s.incidents.status, ["awaiting_fix"])));
    const key = incidentKey(ws.incidentPrefix, inc.number);
    keys.push(key);
    await recordActivity({ workspaceId: ws.id, incidentId: inc.id, title: `PR #${pr.number} probably fixed ${key}`, detail: `It changes ${hit}. Confirm it on the incident to start time travel.`, tone: "pending" });
  }
  return keys.join(", ");
}
