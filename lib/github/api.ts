import { octokitFor } from "./app";

export type Detected = { framework: "pytest" | "vitest" | "jest"; install: string; language: string };

export type GithubApi = {
  detectFramework(workspaceId: string, fullName: string): Promise<Detected>;
  closingCommit(workspaceId: string, fullName: string, issue: number): Promise<{ sha?: string; pr?: number }>;
  prFiles(workspaceId: string, fullName: string, pr: number): Promise<{ files: string[]; diff: string }>;
  createCheckRun(workspaceId: string, fullName: string, headSha: string): Promise<number | null>;
  completeCheckRun(workspaceId: string, fullName: string, id: number | null, conclusion: "success" | "failure" | "neutral", summary: string, url: string): Promise<void>;
  upsertComment(workspaceId: string, fullName: string, pr: number, body: string, existing: number | null): Promise<number | null>;
  /** Open PR numbers, or null when GitHub is not connected (callers fall back to recent checks). */
  openPullRequests(workspaceId: string, fullName: string): Promise<number[] | null>;
};

type Closer = { __typename: "PullRequest"; number: number; mergeCommit: { oid: string } | null } | { __typename: "Commit"; oid: string } | null;

/** The fix an issue's closer points at: a merged pull request (and its merge commit) or a commit. */
export function fixFromCloser(closer: Closer): { sha?: string; pr?: number } {
  if (closer?.__typename === "PullRequest") return closer.mergeCommit ? { sha: closer.mergeCommit.oid, pr: closer.number } : { pr: closer.number };
  if (closer?.__typename === "Commit") return { sha: closer.oid };
  return {};
}

const split = (fullName: string) => {
  const [owner, repo] = fullName.split("/");
  return { owner, repo };
};

const real: GithubApi = {
  async detectFramework(workspaceId, fullName) {
    const ok = await octokitFor(workspaceId);
    const read = async (path: string) => {
      if (!ok) return null;
      try {
        const { data } = await ok.request("GET /repos/{owner}/{repo}/contents/{path}", { ...split(fullName), path });
        return "content" in data ? Buffer.from(data.content, "base64").toString("utf8") : null;
      } catch {
        return null;
      }
    };
    const pkg = await read("package.json");
    if (pkg) {
      const json = JSON.parse(pkg);
      const deps = { ...json.dependencies, ...json.devDependencies };
      const lock = (await read("package-lock.json")) !== null;
      return { framework: deps.vitest ? "vitest" : "jest", install: lock ? "npm ci" : "npm install", language: "TypeScript" };
    }
    const req = await read("requirements.txt");
    return { framework: "pytest", install: req !== null ? "pip install -r requirements.txt" : "pip install -e .", language: "Python" };
  },
  async closingCommit(workspaceId, fullName, issue) {
    const ok = await octokitFor(workspaceId);
    if (!ok) return {};
    // REST "closed" events carry no commit when a pull request closed the issue; GraphQL names the closer.
    const { owner, repo } = split(fullName);
    const data = await ok.graphql<{ repository: { issue: { timelineItems: { nodes: { closer: Closer }[] } } | null } }>(
      `query($owner: String!, $repo: String!, $issue: Int!) {
        repository(owner: $owner, name: $repo) { issue(number: $issue) { timelineItems(itemTypes: [CLOSED_EVENT], last: 1) { nodes { ... on ClosedEvent {
          closer { __typename ... on PullRequest { number mergeCommit { oid } } ... on Commit { oid } }
        } } } } }
      }`,
      { owner, repo, issue },
    );
    return fixFromCloser(data.repository.issue?.timelineItems.nodes[0]?.closer ?? null);
  },
  async prFiles(workspaceId, fullName, pr) {
    const ok = await octokitFor(workspaceId);
    if (!ok) return { files: [], diff: "" };
    const { data } = await ok.request("GET /repos/{owner}/{repo}/pulls/{pull_number}/files", { ...split(fullName), pull_number: pr, per_page: 100 });
    return { files: data.map((f) => f.filename), diff: data.map((f) => `--- ${f.filename}\n${f.patch ?? ""}`).join("\n").slice(0, 60_000) };
  },
  async createCheckRun(workspaceId, fullName, headSha) {
    const ok = await octokitFor(workspaceId);
    if (!ok) return null;
    const { data } = await ok.request("POST /repos/{owner}/{repo}/check-runs", { ...split(fullName), name: "Aftershock", head_sha: headSha, status: "in_progress" });
    return Number(data.id);
  },
  async completeCheckRun(workspaceId, fullName, id, conclusion, summary, url) {
    const ok = await octokitFor(workspaceId);
    if (!ok || !id) return;
    await ok.request("PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}", { ...split(fullName), check_run_id: id, status: "completed", conclusion, details_url: url, output: { title: summary.split("\n").find((l) => l.startsWith("###"))?.replace(/^#+\s*/, "") ?? "Aftershock", summary } });
  },
  async upsertComment(workspaceId, fullName, pr, body, existing) {
    const ok = await octokitFor(workspaceId);
    if (!ok) return null;
    if (existing) {
      await ok.request("PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}", { ...split(fullName), comment_id: existing, body });
      return existing;
    }
    const { data } = await ok.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", { ...split(fullName), issue_number: pr, body });
    return Number(data.id);
  },
  async openPullRequests(workspaceId, fullName) {
    const ok = await octokitFor(workspaceId);
    if (!ok) return null;
    const { data } = await ok.request("GET /repos/{owner}/{repo}/pulls", { ...split(fullName), state: "open", per_page: 100 });
    return data.map((p) => p.number);
  },
};

const noop: GithubApi = {
  detectFramework: async () => ({ framework: "pytest", install: "pip install -r requirements.txt", language: "Python" }),
  closingCommit: async () => ({}),
  prFiles: async () => ({ files: [], diff: "" }),
  createCheckRun: async () => null,
  completeCheckRun: async () => undefined,
  upsertComment: async () => null,
  openPullRequests: async () => null,
};

let override: Partial<GithubApi> | null = null;
/** Tests replace GitHub with fakes; anything not overridden becomes a no-op. */
export function setGithubApi(o: Partial<GithubApi> | null) {
  override = o;
}

export const github: GithubApi = new Proxy({} as GithubApi, {
  get: (_t, key: keyof GithubApi) => (override ? override[key] ?? noop[key] : real[key]),
});

export const closingCommit = (w: string, f: string, n: number) => github.closingCommit(w, f, n);
