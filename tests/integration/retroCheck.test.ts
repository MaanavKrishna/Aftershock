import { describe, test, expect, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { setGithubApi } from "@/lib/github/api";
import { setStartOverride } from "@/lib/workflows/start";
import { retroCheck } from "@/lib/workflows/retroCheck";

afterEach(() => {
  setGithubApi(null);
  setStartOverride(null);
});

/** A repository with a memory test and a spread of pull request checks. */
async function world() {
  const db = await getDb();
  const login = `retro-${crypto.randomUUID().slice(0, 8)}`;
  const [ws] = await db.insert(s.workspaces).values({ login, name: login }).returning();
  const repo = async (name: string) => (await db.insert(s.repositories).values({ workspaceId: ws.id, name, fullName: `${login}/${name}`, cloneUrl: "https://github.com/x/y.git", framework: "pytest", installCmd: "pip install -r requirements.txt" }).returning())[0];
  const [shop, other] = [await repo("shop"), await repo("other")];
  const [inc] = await db.insert(s.incidents).values({ workspaceId: ws.id, repoId: shop.id, number: 1, title: "t", source: "form", status: "proven" }).returning();
  const [test] = await db.insert(s.memoryTests).values({ workspaceId: ws.id, incidentId: inc.id, repoId: shop.id, path: "t.py", fn: "t" }).returning();
  const ago = (min: number) => new Date(Date.now() - min * 60_000);
  const check = (repoId: string, prNumber: number, status: "queued" | "running" | "done", createdAt: Date, extra: Partial<typeof s.prChecks.$inferInsert> = {}) =>
    db.insert(s.prChecks).values({ workspaceId: ws.id, repoId, prNumber, title: `PR ${prNumber}`, headSha: `head-${prNumber}`, baseSha: "base", status, verdict: status === "done" ? "safe" : null, createdAt, ...extra }).returning();
  await check(shop.id, 4, "done", ago(120), { headSha: "old-head" });
  await check(shop.id, 4, "done", ago(10), { changedFiles: ["pay.py"], diff: "+x", filesChanged: 1, commentId: 555 });
  await check(shop.id, 5, "done", ago(20)); // closed on GitHub
  await check(shop.id, 6, "done", ago(30));
  await check(shop.id, 6, "running", ago(5)); // already being checked
  await check(shop.id, 7, "done", ago(15 * 24 * 60)); // older than two weeks
  await check(other.id, 4, "done", ago(10)); // another repository
  const checks = async () => db.select().from(s.prChecks).where(eq(s.prChecks.workspaceId, ws.id));
  return { ws, shop, other, test, checks };
}

function record() {
  const started: [string, string][] = [];
  setStartOverride((kind, id) => started.push([kind, id]));
  return started;
}

describe("retro-check", () => {
  test("a new memory test re-runs the latest finished check of each open pull request", async () => {
    const w = await world();
    const runs: string[] = [];
    setGithubApi({ openPullRequests: async (_ws, fullName) => (fullName === w.shop.fullName ? [4, 6, 7] : []), createCheckRun: async (_ws, _name, sha) => (runs.push(sha), 9001) });
    const started = record();
    const before = (await w.checks()).length;
    await retroCheck(w.test.id);
    const after = await w.checks();
    expect(after.length).toBe(before + 1);
    const copy = after.find((c) => c.status === "queued")!;
    expect(copy).toMatchObject({ repoId: w.shop.id, prNumber: 4, headSha: "head-4", baseSha: "base", changedFiles: ["pay.py"], diff: "+x", filesChanged: 1, commentId: 555, checkRunId: 9001, verdict: null });
    expect(runs).toEqual(["head-4"]);
    expect(started).toEqual([["prCheck", copy.id]]);
  });

  test("without GitHub, every recent finished pull request is re-checked", async () => {
    const w = await world();
    setGithubApi({ openPullRequests: async () => null });
    const started = record();
    await retroCheck(w.test.id);
    const copies = (await w.checks()).filter((c) => c.status === "queued");
    expect(copies.map((c) => c.prNumber).sort()).toEqual([4, 5]);
    expect(copies.every((c) => c.repoId === w.shop.id && c.checkRunId === null)).toBe(true);
    expect(started.map(([, id]) => id).sort()).toEqual(copies.map((c) => c.id).sort());
  });

  test("an unknown memory test does nothing", async () => {
    const started = record();
    setGithubApi({ openPullRequests: async () => { throw new Error("must not be called"); } });
    await retroCheck("no-such-test");
    expect(started).toEqual([]);
  });

  test("a GitHub failure stops the re-check before anything is queued", async () => {
    const w = await world();
    setGithubApi({ openPullRequests: async () => { throw new Error("GitHub is down"); } });
    const started = record();
    await expect(retroCheck(w.test.id)).rejects.toThrow("GitHub is down");
    expect((await w.checks()).some((c) => c.status === "queued")).toBe(false);
    expect(started).toEqual([]);
  });
});
