import { test, expect } from "vitest";
import { getDb } from "@/lib/db/client";
import { scoped } from "@/lib/db/queries/scope";
import * as s from "@/lib/db/schema";

test("a pull request checked several times is listed and counted once, by its latest check", async () => {
  const db = await getDb();
  const [ws] = await db.insert(s.workspaces).values({ login: `latest-${crypto.randomUUID().slice(0, 6)}`, name: "Latest" }).returning();
  const [repo] = await db.insert(s.repositories).values({ workspaceId: ws.id, name: "shop", fullName: "o/shop", cloneUrl: "https://github.com/o/shop.git", framework: "pytest", installCmd: "pip install -r requirements.txt" }).returning();
  const base = { workspaceId: ws.id, repoId: repo.id, prNumber: 4, title: "t", baseSha: "b", filesChanged: 1, changedFiles: ["a.py"], diff: "", status: "done" as const };
  await db.insert(s.prChecks).values({ ...base, headSha: "h1", verdict: "recur", createdAt: new Date(Date.now() - 60_000) });
  await db.insert(s.prChecks).values({ ...base, headSha: "h2", verdict: "safe" });
  await db.insert(s.prChecks).values({ ...base, prNumber: 5, headSha: "h3", verdict: "skipped", createdAt: new Date(Date.now() + 1_000) });
  const sc = scoped(ws.id);
  expect((await sc.checks()).map((c) => [c.check.prNumber, c.check.verdict])).toEqual([[5, "skipped"], [4, "safe"]]);
  expect(await sc.checks({ verdict: "recur" })).toEqual([]);
  expect((await sc.checks({ history: true })).length).toBe(3);
  expect(await sc.verdictCounts()).toMatchObject({ all: 2, safe: 1, skipped: 1 });
});
