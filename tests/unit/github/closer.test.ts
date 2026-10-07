import { test, expect } from "vitest";
import { fixFromCloser } from "@/lib/github/api";

test("an issue closed by a merged pull request links the PR and its merge commit", () => {
  expect(fixFromCloser({ __typename: "PullRequest", number: 2, mergeCommit: { oid: "63cd971" } })).toEqual({ sha: "63cd971", pr: 2 });
});

test("an issue closed by a commit links the commit", () => {
  expect(fixFromCloser({ __typename: "Commit", oid: "abc1234" })).toEqual({ sha: "abc1234" });
});

test("an issue closed by hand links nothing", () => {
  expect(fixFromCloser(null)).toEqual({});
  expect(fixFromCloser({ __typename: "PullRequest", number: 3, mergeCommit: null })).toEqual({ pr: 3 });
});
