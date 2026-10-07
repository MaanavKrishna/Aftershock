import path from "node:path";
import { GithubSource } from "./github";
import type { GitSource } from "./types";

export { NotReproducible, type GitSource, type Resolved } from "./types";

/** GitHub repositories are read through the REST API (no git binary on Vercel); anything else through the git CLI. */
export async function sourceFor(repo: { cloneUrl: string; fullName: string }, token?: string): Promise<GitSource> {
  if (/^https:\/\/github\.com\//.test(repo.cloneUrl)) return new GithubSource(repo.fullName, token);
  const { LocalSource } = await import("./local");
  return LocalSource.open(repo.cloneUrl, token);
}

/** Context the drafter reads: test setup files and the tests nearest the changed files. */
export async function draftContext(src: GitSource, parentSha: string, changed: string[], framework: string): Promise<{ name: string; note: string; content: string }[]> {
  const files = await src.listFiles(parentSha);
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
    const c = await src.readFileAt(parentSha, f);
    if (c !== null) out.push({ name: f, note: "at parent", content: c });
  }
  for (const f of setup) out.push({ name: f, note: "fixtures", content: (await src.readFileAt(parentSha, f)) ?? "" });
  for (const f of tests) out.push({ name: f, note: "style", content: (await src.readFileAt(parentSha, f)) ?? "" });
  return out;
}
