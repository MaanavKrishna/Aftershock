import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { incidentKey } from "@/lib/domain/ids";
import { renderLessons } from "@/lib/domain/lessons";
import { mergeLessons } from "@/lib/domain/agentsMd";
import { openOrReusePr } from "./botPr";

type Client = { request: (route: string, params: Record<string, unknown>) => Promise<{ data: unknown }> };
export const LESSONS_BRANCH = "aftershock/lessons";

/**
 * Opens (or updates) one bot pull request that writes this repository's lessons into AGENTS.md, which
 * coding agents read before every task. Only the aftershock/lessons branch is written; a person merges.
 */
export async function syncAgentsMd(workspaceId: string, repoId: string, client?: Client): Promise<{ status: "opened"; pr: number } | { status: "up to date" } | { status: "no lessons" } | { status: "not connected" }> {
  const db = await getDb();
  const [repo] = await db.select().from(s.repositories).where(and(eq(s.repositories.id, repoId), eq(s.repositories.workspaceId, workspaceId)));
  const [ws] = await db.select().from(s.workspaces).where(eq(s.workspaces.id, workspaceId));
  if (!repo || !ws) return { status: "no lessons" };
  const rows = await db.select({ t: s.memoryTests, i: s.incidents }).from(s.memoryTests).innerJoin(s.incidents, eq(s.incidents.id, s.memoryTests.incidentId)).where(eq(s.memoryTests.repoId, repo.id));
  if (!rows.length) return { status: "no lessons" };
  const lessons = renderLessons(rows.sort((a, b) => a.i.number - b.i.number).map(({ t, i }) => ({ key: incidentKey(ws.incidentPrefix, i.number), title: i.title, files: i.watchedFiles, expected: i.expected, testPath: t.path })));
  const ok = client ?? ((await (await import("./app")).octokitFor(workspaceId)) as Client | null);
  if (!ok) return { status: "not connected" };
  const [owner, name] = repo.fullName.split("/");
  const read = async (ref: string): Promise<{ text: string; sha: string } | null> => {
    try {
      const { data } = (await ok.request("GET /repos/{owner}/{repo}/contents/{path}", { owner, repo: name, path: "AGENTS.md", ref })) as { data: { sha: string; content: string } };
      return { text: Buffer.from(data.content, "base64").toString("utf8"), sha: data.sha };
    } catch (err) {
      if ((err as { status?: number }).status === 404) return null;
      throw err;
    }
  };
  const current = await read(repo.defaultBranch);
  const next = mergeLessons(current?.text ?? null, lessons);
  if (current && next === current.text) return { status: "up to date" };
  // The bot branch always restarts from the default branch, so the PR shows exactly one change.
  const { data: ref } = (await ok.request("GET /repos/{owner}/{repo}/git/ref/{ref}", { owner, repo: name, ref: `heads/${repo.defaultBranch}` })) as { data: { object: { sha: string } } };
  try {
    await ok.request("POST /repos/{owner}/{repo}/git/refs", { owner, repo: name, ref: `refs/heads/${LESSONS_BRANCH}`, sha: ref.object.sha });
  } catch {
    await ok.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", { owner, repo: name, ref: `heads/${LESSONS_BRANCH}`, sha: ref.object.sha, force: true });
  }
  const onBranch = await read(LESSONS_BRANCH);
  await ok.request("PUT /repos/{owner}/{repo}/contents/{path}", { owner, repo: name, path: "AGENTS.md", branch: LESSONS_BRANCH, message: "docs: sync lessons from production into AGENTS.md", content: Buffer.from(next).toString("base64"), ...(onBranch ? { sha: onBranch.sha } : {}) });
  const pr = await openOrReusePr(ok, {
    owner, repo: name, head: LESSONS_BRANCH, base: repo.defaultBranch,
    title: "Sync lessons from production into AGENTS.md",
    body: `Aftershock keeps a section of \`AGENTS.md\` in step with your proven incident tests, so coding agents (Claude Code, Codex, Cursor, Copilot) read them before changing risky code.\n\n${rows.length} lesson${rows.length === 1 ? "" : "s"}, each backed by a test that failed before its fix and passed after. Only the marked section changes; the rest of the file is yours.`,
  });
  return { status: "opened", pr };
}
