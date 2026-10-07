import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { github } from "./api";
import { gitDirFor, readFileAt } from "@/lib/git/local";

function unifiedDiff(file: string, before: string, after: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aftershock-diff-"));
  try {
    fs.writeFileSync(path.join(dir, "a"), before);
    fs.writeFileSync(path.join(dir, "b"), after);
    try {
      execFileSync("git", ["diff", "--no-index", "--no-color", "a", "b"], { cwd: dir, encoding: "utf8" });
      return "";
    } catch (e) {
      return String((e as { stdout?: string }).stdout ?? "").replace(/^diff --git a\/a b\/b\n(index[^\n]*\n)?/, "").replace("--- a/a", `--- a/${file}`).replace("+++ b/b", `+++ b/${file}`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Posts a passed suggested fix as a PR comment with its diff. A human applies it. */
export async function postSuggestion(checkId: string, fixId: string): Promise<void> {
  const db = await getDb();
  const [check] = await db.select().from(s.prChecks).where(eq(s.prChecks.id, checkId));
  const [fix] = await db.select().from(s.suggestedFixes).where(eq(s.suggestedFixes.id, fixId));
  const [repo] = await db.select().from(s.repositories).where(eq(s.repositories.id, check.repoId));
  const patch = JSON.parse(fix.patch) as { path: string; content: string };
  const before = (await readFileAt(await gitDirFor(repo.cloneUrl), check.headSha, patch.path, 200_000)) ?? "";
  const diff = unifiedDiff(patch.path, before, patch.content);
  const body = [`### Aftershock · suggested fix`, "", fix.explanation, "", `It passed all ${fix.results.length} memory test${fix.results.length === 1 ? "" : "s"} for this repository. Apply it yourself if it looks right.`, "", "```diff", diff.slice(0, 50_000), "```"].join("\n");
  await github.upsertComment(check.workspaceId, repo.fullName, check.prNumber, body, null);
}
