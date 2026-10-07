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
