import { test, expect } from "vitest";
import { GithubSource } from "@/lib/git/github";
import { NotReproducible } from "@/lib/git/types";

type Route = [RegExp, number, unknown];
function fakeFetch(routes: Route[]) {
  const calls: string[] = [];
  const f = (async (url: string) => {
    calls.push(url);
    const r = routes.find(([re]) => re.test(url));
    if (!r) return new Response("{}", { status: 404 });
    return new Response(typeof r[2] === "string" ? r[2] : JSON.stringify(r[2]), { status: r[1] });
  }) as unknown as typeof fetch;
  return { f, calls };
}

const commit = (sha: string, parents: string[], message = "msg", files: { filename: string; patch?: string }[] = []) => ({ sha, parents: parents.map((p) => ({ sha: p })), commit: { message }, files });

test("resolveFix returns the fix, its first parent, title, files and diff", async () => {
  const { f } = fakeFetch([[/commits\/aa86f56$/, 200, commit("aa86f56full", ["3f2a1c9full", "zzz"], "fix: reject duplicate\n\nbody", [{ filename: "app/pay.py", patch: "@@ -1 +1 @@\n-a\n+b" }])]]);
  const r = await new GithubSource("o/r", undefined, f).resolveFix("aa86f56");
  expect(r).toEqual({ fixSha: "aa86f56full", parentSha: "3f2a1c9full", title: "fix: reject duplicate", changedFiles: ["app/pay.py"], diff: "--- a/app/pay.py\n+++ b/app/pay.py\n@@ -1 +1 @@\n-a\n+b" });
});

test("a root commit or a missing commit cannot be time-travelled", async () => {
  const { f } = fakeFetch([[/commits\/root$/, 200, commit("rootfull", [])]]);
  const s = new GithubSource("o/r", undefined, f);
  await expect(s.resolveFix("root")).rejects.toThrow(NotReproducible);
  await expect(s.resolveFix("root")).rejects.toThrow(/first commit/);
  await expect(s.resolveFix("deadbeef")).rejects.toThrow(/does not exist/);
});

test("refs are validated before any request", async () => {
  const { f, calls } = fakeFetch([]);
  expect(await new GithubSource("o/r", undefined, f).revParse("../../x")).toBeNull();
  expect(calls).toEqual([]);
});

test("readFileAt reads raw contents at a commit, null when missing", async () => {
  const { f, calls } = fakeFetch([[/contents\/app\/pay\.py\?ref=abc/, 200, "print('hi')\n"]]);
  const s = new GithubSource("o/r", "tok", f);
  expect(await s.readFileAt("abc", "app/pay.py")).toBe("print('hi')\n");
  expect(await s.readFileAt("abc", "nope.py")).toBeNull();
  expect(calls[0]).toContain("/repos/o/r/contents/app/pay.py?ref=abc");
});

test("listFiles lists blobs in the tree", async () => {
  const { f } = fakeFetch([[/git\/trees\/abc\?recursive=1/, 200, { tree: [{ path: "a.py", type: "blob" }, { path: "dir", type: "tree" }, { path: "dir/b.py", type: "blob" }] }]]);
  expect(await new GithubSource("o/r", undefined, f).listFiles("abc")).toEqual(["a.py", "dir/b.py"]);
});

test("firstParentChain follows first parents only, newest first", async () => {
  const list = [commit("c3", ["c2", "side"], "three"), commit("side", ["c1"], "side"), commit("c2", ["c1"], "two"), commit("c1", [], "one")];
  const { f } = fakeFetch([[/commits\?sha=c3&per_page=100/, 200, list]]);
  expect(await new GithubSource("o/r", undefined, f).firstParentChain("c3", 10)).toEqual([
    { sha: "c3", subject: "three" },
    { sha: "c2", subject: "two" },
    { sha: "c1", subject: "one" },
  ]);
});

test("sourceFor uses the GitHub API for github.com repositories and git for local paths", async () => {
  const { sourceFor } = await import("@/lib/git/source");
  expect(await sourceFor({ cloneUrl: "https://github.com/o/r.git", fullName: "o/r" })).toBeInstanceOf(GithubSource);
  expect(await sourceFor({ cloneUrl: "/tmp/repo", fullName: "local/repo" })).not.toBeInstanceOf(GithubSource);
});
