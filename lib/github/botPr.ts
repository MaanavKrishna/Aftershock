import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import type { BotPrInput } from "@/lib/timetravel/deps";
import { octokitFor } from "./app";

/** Opens a PR on a new aftershock/<incident> branch. Never commits to the default branch. */
export async function openBotPr(i: BotPrInput): Promise<number | null> {
  const ok = await octokitFor(i.workspaceId);
  if (!ok) return null;
  const db = await getDb();
  const [repo] = await db.select().from(s.repositories).where(eq(s.repositories.id, i.repoId));
  const [owner, name] = repo.fullName.split("/");
  const base = repo.defaultBranch;
  const branch = `aftershock/${i.key.toLowerCase()}`;
  const { data: ref } = await ok.request("GET /repos/{owner}/{repo}/git/ref/{ref}", { owner, repo: name, ref: `heads/${base}` });
  await ok.request("POST /repos/{owner}/{repo}/git/refs", { owner, repo: name, ref: `refs/heads/${branch}`, sha: ref.object.sha }).catch(() => undefined);
  const yaml = [`id: ${i.key}`, `title: ${JSON.stringify(i.title)}`, `test: ${i.path}`, `proven:`, `  fails_on: ${i.parentSha}`, `  passes_on: ${i.fixSha}`, ""].join("\n");
  const put = async (path: string, content: string, message: string) => {
    let sha: string | undefined;
    try {
      const { data } = await ok.request("GET /repos/{owner}/{repo}/contents/{path}", { owner, repo: name, path, ref: branch });
      if ("sha" in data) sha = data.sha;
    } catch {
      sha = undefined;
    }
    await ok.request("PUT /repos/{owner}/{repo}/contents/{path}", { owner, repo: name, path, branch, message, content: Buffer.from(content).toString("base64"), ...(sha ? { sha } : {}) });
  };
  await put(i.path, i.code, `test: add proven regression test for ${i.key}`);
  await put(`.aftershock/incidents/${i.key}.yaml`, yaml, `chore: record ${i.key} proof`);
  const { data: pr } = await ok.request("POST /repos/{owner}/{repo}/pulls", {
    owner, repo: name, head: branch, base,
    title: `Add proven regression test for ${i.key}`,
    body: `Aftershock proved this test against your git history:\n\n- **Fails** on \`${i.parentSha.slice(0, 7)}\` (before the fix), 3 of 3 runs\n- **Passes** on \`${i.fixSha.slice(0, 7)}\` (the fix), 3 of 3 runs\n\nIncident: **${i.key} — ${i.title}**\n\nMerge it to keep the lesson in your repository. Nothing else changes.`,
  });
  return pr.number;
}
