import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NotReproducible, REF, type GitSource, type Resolved } from "./types";

function git(args: string[], timeoutMs = 120_000): Promise<{ ok: boolean; out: string }> {
  return new Promise((resolve) => {
    execFile("git", args, { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024, encoding: "utf8" }, (err, stdout) => resolve({ ok: !err, out: (stdout ?? "").toString() }));
  });
}

const isLocal = (url: string) => url.startsWith("/") || url.startsWith("file://");
const authArgs = (token?: string) => (token ? ["-c", `http.extraHeader=Authorization: Basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`] : []);

/** A git dir for the repo: the local path itself, or a cached blobless bare clone. */
async function gitDirFor(repoUrl: string, token?: string): Promise<string> {
  if (isLocal(repoUrl)) return repoUrl.replace(/^file:\/\//, "");
  const cache = path.join(os.homedir(), ".cache", "aftershock", "repos", createHash("sha1").update(repoUrl).digest("hex"));
  if (!fs.existsSync(cache)) {
    fs.mkdirSync(path.dirname(cache), { recursive: true });
    const c = await git([...authArgs(token), "clone", "--quiet", "--bare", "--filter=blob:none", repoUrl, cache], 300_000);
    if (!c.ok) throw new NotReproducible("The repository could not be cloned. Check the GitHub App has access to it.");
  } else {
    await git([...authArgs(token), "-C", cache, "fetch", "--quiet", "origin", "+refs/heads/*:refs/heads/*"], 300_000);
  }
  return cache;
}

/** Repository history through the git CLI — local paths and non-GitHub remotes. */
export class LocalSource implements GitSource {
  private constructor(private dir: string, private token?: string) {}

  static async open(repoUrl: string, token?: string): Promise<LocalSource> {
    return new LocalSource(await gitDirFor(repoUrl, token), token);
  }

  private async ensureCommit(sha: string): Promise<boolean> {
    if (!REF.test(sha)) return false;
    if ((await git(["-C", this.dir, "cat-file", "-e", `${sha}^{commit}`])).ok) return true;
    await git([...authArgs(this.token), "-C", this.dir, "fetch", "--quiet", "origin", sha], 300_000);
    return (await git(["-C", this.dir, "cat-file", "-e", `${sha}^{commit}`])).ok;
  }

  async revParse(ref: string): Promise<string | null> {
    if (!REF.test(ref)) return null;
    const r = await git(["-C", this.dir, "rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
    return r.ok ? r.out.trim() : null;
  }

  async resolveFix(fixRef: string): Promise<Resolved> {
    const dir = this.dir;
    if (!(await this.ensureCommit(fixRef))) throw new NotReproducible(`The fix commit ${fixRef} does not exist in this repository.`);
    const fixSha = (await this.revParse(fixRef))!;
    const parentSha = await this.revParse(`${fixSha}^1`);
    if (!parentSha) throw new NotReproducible("The fix is the repository’s first commit, so there is no “before the fix” to travel back to.");
    const title = (await git(["-C", dir, "log", "-1", "--format=%s", fixSha])).out.trim();
    const files = (await git(["-C", dir, "diff", "--name-only", parentSha, fixSha])).out.split("\n").map((f) => f.trim()).filter(Boolean);
    const diff = (await git(["-C", dir, "diff", "--unified=3", parentSha, fixSha])).out.slice(0, 40_000);
    return { fixSha, parentSha, title, changedFiles: files, diff };
  }

  async readFileAt(sha: string, file: string, max = 12_000): Promise<string | null> {
    if (!(await this.ensureCommit(sha))) return null;
    const r = await git(["-C", this.dir, "show", `${sha}:${file}`]);
    return r.ok ? r.out.slice(0, max) : null;
  }

  async listFiles(sha: string): Promise<string[]> {
    if (!REF.test(sha)) return [];
    const r = await git(["-C", this.dir, "ls-tree", "-r", "--name-only", sha]);
    return r.ok ? r.out.split("\n").filter(Boolean) : [];
  }

  async firstParentChain(sha: string, max: number): Promise<{ sha: string; subject: string }[]> {
    if (!REF.test(sha)) return [];
    const r = await git(["-C", this.dir, "log", "--first-parent", `-n${max}`, "--format=%H%x09%s", sha]);
    return r.ok ? r.out.split("\n").filter(Boolean).map((l) => ({ sha: l.split("\t")[0], subject: l.split("\t").slice(1).join("\t") })) : [];
  }
}
