export class NotReproducible extends Error {}

export const REF = /^[A-Za-z0-9][A-Za-z0-9._/~^-]{0,99}$/;

export type Resolved = { fixSha: string; parentSha: string; title: string; changedFiles: string[]; diff: string };

/** Read access to a repository's history, from local git or the GitHub API. */
export interface GitSource {
  revParse(ref: string): Promise<string | null>;
  /** The fix commit, its first parent, and what it changed. Throws NotReproducible for root or unknown commits. */
  resolveFix(fixRef: string): Promise<Resolved>;
  readFileAt(sha: string, file: string, max?: number): Promise<string | null>;
  listFiles(sha: string): Promise<string[]>;
  /** First-parent ancestors, newest first, starting at sha (inclusive). */
  firstParentChain(sha: string, max: number): Promise<{ sha: string; subject: string }[]>;
}
