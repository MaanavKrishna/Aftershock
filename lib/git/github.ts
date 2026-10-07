import { NotReproducible, REF, type GitSource, type Resolved } from "./types";

type Commit = { sha: string; parents: { sha: string }[]; commit: { message: string }; files?: { filename: string; patch?: string }[] };

/** Repository history through the GitHub REST API — used on servers without a git binary. */
export class GithubSource implements GitSource {
  constructor(
    private fullName: string,
    private token?: string,
    private fetcher: typeof fetch = fetch,
  ) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(fullName)) throw new Error("Invalid repository name");
  }

  private async get(path: string, accept = "application/vnd.github+json"): Promise<Response> {
    return this.fetcher(`https://api.github.com/repos/${this.fullName}${path}`, {
      headers: { Accept: accept, "X-GitHub-Api-Version": "2022-11-28", ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) },
    });
  }

  private async commit(ref: string): Promise<Commit | null> {
    if (!REF.test(ref)) return null;
    const res = await this.get(`/commits/${encodeURIComponent(ref)}`);
    return res.ok ? ((await res.json()) as Commit) : null;
  }

  async revParse(ref: string) {
    return (await this.commit(ref))?.sha ?? null;
  }

  async resolveFix(fixRef: string): Promise<Resolved> {
    const c = await this.commit(fixRef);
    if (!c) throw new NotReproducible(`The fix commit ${fixRef} does not exist in this repository.`);
    if (!c.parents.length) throw new NotReproducible("The fix is the repository’s first commit, so there is no “before the fix” to travel back to.");
    const files = c.files ?? [];
    return {
      fixSha: c.sha,
      parentSha: c.parents[0].sha,
      title: c.commit.message.split("\n")[0],
      changedFiles: files.map((f) => f.filename),
      diff: files.filter((f) => f.patch).map((f) => `--- a/${f.filename}\n+++ b/${f.filename}\n${f.patch}`).join("\n").slice(0, 40_000),
    };
  }

  async readFileAt(sha: string, file: string, max = 12_000) {
    if (!REF.test(sha)) return null;
    const res = await this.get(`/contents/${file.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(sha)}`, "application/vnd.github.raw");
    return res.ok ? (await res.text()).slice(0, max) : null;
  }

  async listFiles(sha: string) {
    if (!REF.test(sha)) return [];
    const res = await this.get(`/git/trees/${encodeURIComponent(sha)}?recursive=1`);
    if (!res.ok) return [];
    const data = (await res.json()) as { tree: { path: string; type: string }[] };
    return data.tree.filter((t) => t.type === "blob").map((t) => t.path);
  }

  async firstParentChain(sha: string, max: number) {
    if (!REF.test(sha)) return [];
    const res = await this.get(`/commits?sha=${encodeURIComponent(sha)}&per_page=100`);
    if (!res.ok) return [];
    const list = (await res.json()) as Commit[];
    const bySha = new Map(list.map((c) => [c.sha, c]));
    const out: { sha: string; subject: string }[] = [];
    let cur = bySha.get(list[0]?.sha);
    while (cur && out.length < max) {
      out.push({ sha: cur.sha, subject: cur.commit.message.split("\n")[0] });
      cur = cur.parents[0] ? bySha.get(cur.parents[0].sha) : undefined;
    }
    return out;
  }
}
