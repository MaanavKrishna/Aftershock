import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import type { Scoped } from "@/lib/db/queries/scope";
import type { ImportableIssue } from "./issues";

type AppClient = import("@octokit/app").App;
let cached: AppClient | null | undefined;

export function githubAppConfigured(): boolean {
  return Boolean(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY);
}

/** The GitHub App, or null when GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY are not set. */
export async function githubApp(): Promise<AppClient | null> {
  if (cached !== undefined) return cached;
  if (!githubAppConfigured()) return (cached = null);
  const { App } = await import("@octokit/app");
  cached = new App({ appId: process.env.GITHUB_APP_ID!, privateKey: process.env.GITHUB_APP_PRIVATE_KEY!.replace(/\\n/g, "\n") });
  return cached;
}

export async function installationFor(workspaceId: string): Promise<number | null> {
  const db = await getDb();
  const [ws] = await db.select().from(s.workspaces).where(eq(s.workspaces.id, workspaceId));
  return ws?.installationId ?? null;
}

export async function octokitFor(workspaceId: string) {
  const app = await githubApp();
  const id = await installationFor(workspaceId);
  if (!app || !id) return null;
  return app.getInstallationOctokit(id);
}

/** A one-hour, read-only token scoped to one repository, for cloning into a runner. */
export async function installationTokenFor(workspaceId: string, fullName: string): Promise<string | undefined> {
  const app = await githubApp();
  const id = await installationFor(workspaceId);
  if (!app || !id) return undefined;
  const { data } = await app.octokit.request("POST /app/installations/{installation_id}/access_tokens", {
    installation_id: id,
    repositories: [fullName.split("/")[1]],
    permissions: { contents: "read" },
  });
  return data.token;
}

export async function listClosedIncidentIssues(scope: Scoped): Promise<ImportableIssue[]> {
  const ok = await octokitFor(scope.workspaceId);
  if (!ok) return [];
  const ws = await scope.workspace();
  const label = ws?.settings.issueLabel ?? "incident";
  const existing = new Set((await scope.listIncidents({})).map((i) => i.sourceRef));
  const { closingCommit } = await import("./api");
  const out: ImportableIssue[] = [];
  for (const repo of await scope.repos()) {
    const [owner, name] = repo.fullName.split("/");
    const { data } = await ok.request("GET /repos/{owner}/{repo}/issues", { owner, repo: name, state: "closed", labels: label, per_page: 20 });
    for (const issue of data) {
      if (issue.pull_request || existing.has(`${repo.name}#${issue.number}`)) continue;
      const fix = await closingCommit(scope.workspaceId, repo.fullName, issue.number);
      out.push({ repoId: repo.id, repo: repo.name, number: issue.number, title: issue.title, closedAt: issue.closed_at ? new Date(issue.closed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "", body: (issue.body ?? "").slice(0, 4000), fixSha: fix.sha, fixPr: fix.pr });
    }
  }
  return out;
}
