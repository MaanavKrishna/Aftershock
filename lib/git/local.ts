import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export class NotReproducible extends Error {}

function git(args: string[], timeoutMs = 120_000): Promise<{ ok: boolean; out: string }> {
  return new Promise((resolve) => {
    execFile("git", args, { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024, encoding: "utf8" }, (err, stdout) => resolve({ ok: !err, out: (stdout ?? "").toString() }));
  });
}

const isLocal = (url: string) => url.startsWith("/") || url.startsWith("file://");
const authArgs = (token?: string) => (token ? ["-c", `http.extraHeader=Authorization: Basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`] : []);
export const REF = /^[A-Za-z0-9][A-Za-z0-9._/~^-]{0,99}$/;

/** A git dir for the repo: the local path itself, or a cached blobless bare clone. */
export async function gitDirFor(repoUrl: string, token?: string): Promise<string> {
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

export async function ensureCommit(dir: string, sha: string, token?: string): Promise<boolean> {
  if (!REF.test(sha)) return false;
  if ((await git(["-C", dir, "cat-file", "-e", `${sha}^{commit}`])).ok) return true;
  await git([...authArgs(token), "-C", dir, "fetch", "--quiet", "origin", sha], 300_000);
  return (await git(["-C", dir, "cat-file", "-e", `${sha}^{commit}`])).ok;
}

export async function revParse(dir: string, ref: string): Promise<string | null> {
  if (!REF.test(ref)) return null;
  const r = await git(["-C", dir, "rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
  return r.ok ? r.out.trim() : null;
}

export type Resolved = { fixSha: string; parentSha: string; title: string; changedFiles: string[]; diff: string };

/** The fix commit, its first parent, and what it changed. Root commits and unknown SHAs cannot be time-travelled. */
export async function resolveFix(dir: string, fixRef: string, token?: string): Promise<Resolved> {
  if (!(await ensureCommit(dir, fixRef, token))) throw new NotReproducible(`The fix commit ${fixRef} does not exist in this repository.`);
  const fixSha = (await revParse(dir, fixRef))!;
  const parentSha = await revParse(dir, `${fixSha}^1`);
  if (!parentSha) throw new NotReproducible("The fix is the repository’s first commit, so there is no “before the fix” to travel back to.");
  const title = (await git(["-C", dir, "log", "-1", "--format=%s", fixSha])).out.trim();
  const files = (await git(["-C", dir, "diff", "--name-only", parentSha, fixSha])).out.split("\n").map((f) => f.trim()).filter(Boolean);
  const diff = (await git(["-C", dir, "diff", "--unified=3", parentSha, fixSha])).out.slice(0, 40_000);
  return { fixSha, parentSha, title, changedFiles: files, diff };
}

export async function readFileAt(dir: string, sha: string, file: string, max = 12_000): Promise<string | null> {
  const r = await git(["-C", dir, "show", `${sha}:${file}`]);
  return r.ok ? r.out.slice(0, max) : null;
}

export async function listFiles(dir: string, sha: string): Promise<string[]> {
  const r = await git(["-C", dir, "ls-tree", "-r", "--name-only", sha]);
  return r.ok ? r.out.split("\n").filter(Boolean) : [];
}

/** Ancestors from newest to oldest, starting at sha (inclusive). */
export async function firstParentChain(dir: string, sha: string, max: number): Promise<{ sha: string; subject: string }[]> {
  const r = await git(["-C", dir, "log", "--first-parent", `-n${max}`, "--format=%H%x09%s", sha]);
  return r.ok ? r.out.split("\n").filter(Boolean).map((l) => ({ sha: l.split("\t")[0], subject: l.split("\t").slice(1).join("\t") })) : [];
}

/** Context the drafter reads: test setup files and the tests nearest the changed files. */
export async function draftContext(dir: string, parentSha: string, changed: string[], framework: string): Promise<{ name: string; note: string; content: string }[]> {
  const files = await listFiles(dir, parentSha);
  const isTest = (f: string) => (framework === "pytest" ? /(^|\/)(test_[^/]+|[^/]+_test)\.py$/.test(f) : /\.(test|spec)\.[cm]?[jt]sx?$/.test(f));
  const setup = files.filter((f) => (framework === "pytest" ? /(^|\/)conftest\.py$/.test(f) : /(vitest|jest)\.config\.[cm]?[jt]s$/.test(f) || /(^|\/)setup(Tests)?\.[jt]s$/.test(f))).slice(0, 2);
  const words = new Set(changed.flatMap((c) => path.basename(c).replace(/\.[^.]+$/, "").split(/[_\-.]/)).filter((w) => w.length > 2).map((w) => w.toLowerCase()));
  const tests = files
    .filter(isTest)
    .map((f) => ({ f, score: path.basename(f).toLowerCase().split(/[_\-.]/).filter((w) => words.has(w)).length }))
    .sort((a, b) => b.score - a.score || a.f.localeCompare(b.f))
    .slice(0, 2)
    .map((x) => x.f);
  const out: { name: string; note: string; content: string }[] = [];
  for (const f of changed.slice(0, 3)) {
    const c = await readFileAt(dir, parentSha, f);
    if (c !== null) out.push({ name: f, note: "at parent", content: c });
  }
  for (const f of setup) out.push({ name: f, note: "fixtures", content: (await readFileAt(dir, parentSha, f)) ?? "" });
  for (const f of tests) out.push({ name: f, note: "style", content: (await readFileAt(dir, parentSha, f)) ?? "" });
  return out;
}
