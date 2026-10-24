import { test, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyGithubSignature } from "@/lib/github/signature";
import { renderComment, COMMENT_MARKER } from "@/lib/github/comment";

const sign = (body: string, secret: string) => "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

test("a correctly signed delivery verifies", () => {
  expect(verifyGithubSignature('{"a":1}', sign('{"a":1}', "s3cret"), "s3cret")).toBe(true);
});
test("a wrong, missing or malformed signature is rejected", () => {
  expect(verifyGithubSignature('{"a":1}', sign('{"a":2}', "s3cret"), "s3cret")).toBe(false);
  expect(verifyGithubSignature('{"a":1}', null, "s3cret")).toBe(false);
  expect(verifyGithubSignature('{"a":1}', "sha1=abc", "s3cret")).toBe(false);
  expect(verifyGithubSignature('{"a":1}', sign('{"a":1}', "s3cret"), "")).toBe(false);
});

const res = (key: string, verdict: "recur" | "safe" | "inconclusive", passed: number) => ({ key, title: `${key} title`, testPath: `tests/aftershock/${key}.py`, verdict, passed, runs: 3, failure: verdict === "recur" ? "assert 201 == 400" : undefined });

test("a recur comment leads with the incident that would come back", () => {
  const md = renderComment({ verdict: "recur", results: [res("INC-12", "recur", 0), res("INC-7", "safe", 3)], skipped: 9, url: "https://x/pulls/214" });
  expect(md.startsWith(COMMENT_MARKER)).toBe(true);
  expect(md).toContain("1 incident would recur");
  expect(md).toContain("This change reopens **INC-12**");
  expect(md).toContain("| INC-12 | `tests/aftershock/INC-12.py` | 0/3 pass |");
  expect(md).toContain("assert 201 == 400");
  expect(md).toContain("9 skipped");
});
test("a safe comment says every lesson held", () => {
  expect(renderComment({ verdict: "safe", results: [res("INC-7", "safe", 3)], skipped: 0, url: "u" })).toContain("Every relevant incident stayed fixed");
});
test("an inconclusive comment never reads as green", () => {
  const md = renderComment({ verdict: "inconclusive", results: [res("INC-9", "inconclusive", 2)], skipped: 0, url: "u" });
  expect(md).toContain("Inconclusive");
  expect(md).not.toMatch(/stayed fixed/);
});

test("an inconclusive comment says why, once per distinct reason", () => {
  const r = (key: string) => ({ key, title: key, testPath: `t/${key}.py`, verdict: "inconclusive" as const, passed: 0, runs: 3, failure: "Dependency install failed (exit 1)" });
  const md = renderComment({ verdict: "inconclusive", results: [r("INC-1"), r("INC-3")], skipped: 0, url: "u" });
  expect(md).toContain("Why: Dependency install failed (exit 1)");
  expect(md.match(/Dependency install failed/g)).toHaveLength(1);
});

test("the comment states the recurrence risk with its reasons, and stays quiet when it is low", async () => {
  const { renderComment } = await import("@/lib/github/comment");
  const base = { verdict: "safe" as const, results: [], skipped: 0, url: "https://x" };
  const high = renderComment({ ...base, risk: { level: "high", score: 6, incidents: ["INC-3", "INC-7"], reasons: ["Touches app/cart.py, the code behind INC-3 and INC-7"] } });
  expect(high).toContain("**Risk: high**");
  expect(high).toContain("Touches app/cart.py, the code behind INC-3 and INC-7");
  expect(renderComment({ ...base, risk: { level: "low", score: 0, incidents: [], reasons: [] } })).not.toContain("Risk:");
});
