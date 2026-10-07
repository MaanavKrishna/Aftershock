/** The commit a merged pull request landed as, via the GitHub REST API. Null if not merged. */
export async function mergeCommitForPr(fullName: string, pr: number, token?: string): Promise<string | null> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(fullName)) return null;
  const res = await fetch(`https://api.github.com/repos/${fullName}/pulls/${pr}`, {
    headers: { Accept: "application/vnd.github+json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { merged?: boolean; merge_commit_sha?: string | null };
  return data.merged && data.merge_commit_sha ? data.merge_commit_sha : null;
}
