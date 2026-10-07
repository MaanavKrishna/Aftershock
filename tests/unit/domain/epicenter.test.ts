import { test, expect } from "vitest";
import { findEpicenter, healthFrom, prFromSubject } from "@/lib/domain/epicenter";

const chain = (n: number) => Array.from({ length: n }, (_, i) => ({ sha: `c${i}`, subject: `commit ${i}` }));

test("binary search finds the commit that introduced the bug within the run cap", async () => {
  let runs = 0;
  const r = await findEpicenter(chain(40), async (sha) => (runs++, Number(sha.slice(1)) <= 17 ? "fail" : "pass"), 12);
  expect(r).toEqual({ sha: "c17", subject: "commit 17", testedCommits: runs });
  expect(runs).toBeLessThanOrEqual(12);
});

test("if no ancestor passes, the epicenter is unavailable", async () => {
  const r = await findEpicenter(chain(10), async () => "fail", 12);
  expect(r).toEqual({ unavailable: "The bug is older than the 10 commits searched." });
});

test("when the search reaches the first commit, it says so instead of blaming older history", async () => {
  const r = await findEpicenter(chain(5), async () => "fail", 12, { reachedRoot: true });
  expect(r).toEqual({ unavailable: "The test fails on every commit back to the repository's first, so no commit shows where the bug started." });
});

test("an environment error on an old commit stops the search honestly", async () => {
  const r = await findEpicenter(chain(40), async (sha) => (sha === "c0" || sha === "c1" ? "fail" : "error"), 12);
  expect("unavailable" in r && r.unavailable).toMatch(/could not run/);
});

test("the bug introduced in the newest ancestor is found", async () => {
  const r = await findEpicenter(chain(5), async (sha) => (sha === "c0" ? "fail" : "pass"), 12);
  expect(r).toMatchObject({ sha: "c0" });
});

test("PR numbers come from merge and squash subjects", () => {
  expect(prFromSubject("Merge pull request #31 from x/y")).toBe(31);
  expect(prFromSubject("feat: mock payments endpoint (#31)")).toBe(31);
  expect(prFromSubject("plain commit")).toBeUndefined();
});

test("health: latest night failing is failing, an older failure is flaky, else healthy", () => {
  expect(healthFrom([true, true, false])).toBe("failing");
  expect(healthFrom([true, false, true])).toBe("flaky");
  expect(healthFrom([true, true])).toBe("healthy");
  expect(healthFrom([])).toBe("healthy");
});
