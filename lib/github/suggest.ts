import { createTwoFilesPatch } from "diff";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { github } from "./api";
import { sourceFor } from "@/lib/git/source";
import { deps } from "@/lib/timetravel/deps";

export function unifiedDiff(file: string, before: string, after: string): string {
  if (before === after) return "";
  return createTwoFilesPatch(`a/${file}`, `b/${file}`, before, after, undefined, undefined, { context: 3 }).replace(/^=+\n/, "");
}

/** Posts a passed suggested fix as a PR comment with its diff. A human applies it. */
export async function postSuggestion(checkId: string, fixId: string): Promise<void> {
  const db = await getDb();
  const [check] = await db.select().from(s.prChecks).where(eq(s.prChecks.id, checkId));
  const [fix] = await db.select().from(s.suggestedFixes).where(eq(s.suggestedFixes.id, fixId));
  const [repo] = await db.select().from(s.repositories).where(eq(s.repositories.id, check.repoId));
  const patch = JSON.parse(fix.patch) as { path: string; content: string };
  const src = await sourceFor(repo, await (await deps()).tokenFor(repo));
  const before = (await src.readFileAt(check.headSha, patch.path, 200_000)) ?? "";
  const diff = unifiedDiff(patch.path, before, patch.content);
  const body = [`### Aftershock · suggested fix`, "", fix.explanation, "", `It passed all ${fix.results.length} memory test${fix.results.length === 1 ? "" : "s"} for this repository. Apply it yourself if it looks right.`, "", "```diff", diff.slice(0, 50_000), "```"].join("\n");
  await github.upsertComment(check.workspaceId, repo.fullName, check.prNumber, body, null);
}
