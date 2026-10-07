type Client = { request: (route: string, params: Record<string, unknown>) => Promise<{ data: unknown }> };

/**
 * The commit a merged pull request landed as. Uses the app's installation client: the runner's
 * clone token only reads contents, not pull requests. Null if not merged or unreadable.
 */
export async function mergeCommitForPr(client: Client | null, fullName: string, pr: number): Promise<string | null> {
  if (!client || !/^[\w.-]+\/[\w.-]+$/.test(fullName)) return null;
  const [owner, repo] = fullName.split("/");
  try {
    const { data } = await client.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", { owner, repo, pull_number: pr });
    const d = data as { merged?: boolean; merge_commit_sha?: string | null };
    return d.merged && d.merge_commit_sha ? d.merge_commit_sha : null;
  } catch {
    return null;
  }
}

/**
 * GitHub's test merge commit for an open pull request — the PR merged into its base, which is what
 * CI tests. Waits briefly while GitHub computes mergeability. Null when the PR conflicts or it stays unknown.
 */
export async function testMergeCommit(client: Client | null, fullName: string, pr: number, delayMs = 2_000, tries = 5): Promise<string | null> {
  if (!client || !/^[\w.-]+\/[\w.-]+$/.test(fullName)) return null;
  const [owner, repo] = fullName.split("/");
  for (let i = 0; i < tries; i++) {
    try {
      const { data } = await client.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", { owner, repo, pull_number: pr });
      const d = data as { mergeable?: boolean | null; merge_commit_sha?: string | null };
      if (d.mergeable === true && d.merge_commit_sha) return d.merge_commit_sha;
      if (d.mergeable === false) return null;
    } catch {
      return null;
    }
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}
