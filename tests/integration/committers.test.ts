import { test, expect } from "vitest";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { scoped } from "@/lib/db/queries/scope";
import { ledgerWorld } from "../support/world";

test("active committers are distinct human pull request authors from the last 30 days", async () => {
  const w = await ledgerWorld();
  const db = await getDb();
  const base = { workspaceId: w.ws.id, repoId: w.repo.id, title: "t", headSha: "h", baseSha: "b", status: "done" as const };
  await db.insert(s.prChecks).values([
    { ...base, prNumber: 1, author: "ana" },
    { ...base, prNumber: 2, author: "ana" },
    { ...base, prNumber: 3, author: "ben" },
    { ...base, prNumber: 4, author: "dependabot[bot]", authorIsBot: true },
    { ...base, prNumber: 5, author: "old", createdAt: new Date(Date.now() - 40 * 86_400_000) },
  ]);
  expect(await scoped(w.ws.id).activeCommitters()).toBe(2);
  const usage = await scoped(w.ws.id).usage();
  expect(usage.committers).toBe(2);
  expect(usage.allowanceMs).toBe(5 * 3_600_000);
});
