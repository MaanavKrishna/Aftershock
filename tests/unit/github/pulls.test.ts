import { test, expect } from "vitest";
import { mergeCommitForPr } from "@/lib/github/pulls";

const client = (data: unknown, fail = false) => ({
  request: async (route: string, params: Record<string, unknown>) => {
    if (fail) throw new Error("404");
    expect(route).toBe("GET /repos/{owner}/{repo}/pulls/{pull_number}");
    expect(params).toEqual({ owner: "o", repo: "r", pull_number: 2 });
    return { data };
  },
});

test("a merged pull request resolves to its merge commit through the app's installation client", async () => {
  expect(await mergeCommitForPr(client({ merged: true, merge_commit_sha: "63cd971" }), "o/r", 2)).toBe("63cd971");
});

test("unmerged, missing or unreadable pull requests resolve to null", async () => {
  expect(await mergeCommitForPr(client({ merged: false, merge_commit_sha: "x" }), "o/r", 2)).toBeNull();
  expect(await mergeCommitForPr(client({}, true), "o/r", 2)).toBeNull();
  expect(await mergeCommitForPr(null, "o/r", 2)).toBeNull();
});

test("the test merge commit is used once GitHub has computed mergeability", async () => {
  const { testMergeCommit } = await import("@/lib/github/pulls");
  const states = [{ mergeable: null, merge_commit_sha: null }, { mergeable: true, merge_commit_sha: "m1" }];
  let calls = 0;
  const c = { request: async () => ({ data: states[Math.min(calls++, states.length - 1)] }) };
  expect(await testMergeCommit(c, "o/r", 4, 0)).toBe("m1");
  expect(calls).toBe(2);
});

test("a conflicting or unknown pull request has no test merge commit", async () => {
  const { testMergeCommit } = await import("@/lib/github/pulls");
  expect(await testMergeCommit({ request: async () => ({ data: { mergeable: false, merge_commit_sha: "stale" } }) }, "o/r", 4, 0)).toBeNull();
  expect(await testMergeCommit({ request: async () => ({ data: { mergeable: null, merge_commit_sha: null } }) }, "o/r", 4, 0)).toBeNull();
  expect(await testMergeCommit(null, "o/r", 4, 0)).toBeNull();
});
