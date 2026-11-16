import { describe, test, expect, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { scoped, type Page } from "@/lib/db/queries/scope";
import { encodeCursor, MAX_PAGE } from "@/lib/db/queries/paging";

type Db = Awaited<ReturnType<typeof getDb>>;

/** A workspace with one live and one archived repository. */
async function world(db: Db, tag: string) {
  const login = `${tag}-${crypto.randomUUID().slice(0, 8)}`;
  const [ws] = await db.insert(s.workspaces).values({ login, name: login }).returning();
  const repo = (name: string, archived = false) => ({ workspaceId: ws.id, name, fullName: `${login}/${name}`, cloneUrl: `https://github.com/${login}/${name}.git`, framework: "pytest" as const, installCmd: "pip install -r requirements.txt", archivedAt: archived ? new Date() : null });
  const [live, gone] = await db.insert(s.repositories).values([repo("shop"), repo("legacy", true)]).returning();
  return { ws, live, gone, sc: scoped(ws.id) };
}

/** Follows nextCursor to the end, failing on a runaway loop. */
async function all<T>(first: (cursor?: string) => Promise<Page<T>>): Promise<{ pages: T[][]; rows: T[] }> {
  const pages: T[][] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 100; i++) {
    const p = await first(cursor);
    pages.push(p.rows);
    if (!p.nextCursor) return { pages, rows: pages.flat() };
    cursor = p.nextCursor;
  }
  throw new Error("cursor never ended");
}

const SAME = new Date("2026-03-01T10:00:00.123456Z");

let db: Db;
let A: Awaited<ReturnType<typeof world>>;
let B: Awaited<ReturnType<typeof world>>;

beforeAll(async () => {
  db = await getDb();
  A = await world(db, "page-a");
  B = await world(db, "page-b");
  // Seven incidents in A: #3 on the archived repository, #5 with two attempts, #6 unproven, #7 traveling.
  for (let n = 1; n <= 7; n++) {
    const status: s.IncidentStatus = n === 6 ? "unproven" : n === 7 ? "traveling" : n % 2 ? "proven" : "awaiting_fix";
    const [inc] = await db.insert(s.incidents).values({ workspaceId: A.ws.id, repoId: n === 3 ? A.gone.id : A.live.id, number: n, title: `A${n}`, source: "form", status, watchedFiles: n <= 3 ? ["pay.py", "pay.py"] : ["cart.py"] }).returning();
    if (n === 5 || n === 7) {
      await db.insert(s.timeTravelRuns).values([{ incidentId: inc.id, attempt: 1, status: "rejected" }, { incidentId: inc.id, attempt: 2, status: n === 7 ? "running" : "proven" }]);
    }
    if (n % 2) {
      // Two memory tests for the same incident: a tie on the sort key.
      await db.insert(s.memoryTests).values([
        { workspaceId: A.ws.id, incidentId: inc.id, repoId: A.live.id, path: `t_${n}_a.py`, fn: "t", health: n === 1 ? "flaky" : "healthy", botPrState: n === 5 ? "open" : null, botPr: n === 5 ? 50 : null },
        { workspaceId: A.ws.id, incidentId: inc.id, repoId: A.live.id, path: `t_${n}_b.py`, fn: "t" },
      ]);
    }
  }
  // B has its own incident #1..#3, checks, memory and audit rows that A must never see.
  for (let n = 1; n <= 3; n++) {
    const [inc] = await db.insert(s.incidents).values({ workspaceId: B.ws.id, repoId: B.live.id, number: n, title: `B${n}`, source: "form", status: "proven" }).returning();
    await db.insert(s.memoryTests).values({ workspaceId: B.ws.id, incidentId: inc.id, repoId: B.live.id, path: `b_${n}.py`, fn: "t" });
  }
  // Checks in A: PRs 1-4 checked twice (older safe, newer recur for PR 2), PRs 5-9 once, all PRs 5-9 at the same instant.
  const base = { workspaceId: A.ws.id, repoId: A.live.id, title: "t", headSha: "h", baseSha: "b", status: "done" as const };
  for (let pr = 1; pr <= 4; pr++) {
    await db.insert(s.prChecks).values({ ...base, prNumber: pr, verdict: "safe", createdAt: new Date(Date.now() - 3_600_000 * (10 - pr)) });
    await db.insert(s.prChecks).values({ ...base, prNumber: pr, verdict: pr === 2 ? "recur" : "safe", createdAt: new Date(Date.now() - 60_000 * (10 - pr)) });
  }
  for (let pr = 5; pr <= 9; pr++) await db.insert(s.prChecks).values({ ...base, prNumber: pr, verdict: "inconclusive", createdAt: SAME });
  await db.insert(s.prChecks).values({ workspaceId: B.ws.id, repoId: B.live.id, prNumber: 1, title: "secret", headSha: "h", baseSha: "b", status: "done", verdict: "recur" });
  // Audit: 7 entries in A at the same instant, 3 more later; 2 in B.
  await db.insert(s.auditLog).values(Array.from({ length: 7 }, (_, i) => ({ workspaceId: A.ws.id, action: i % 2 ? "token.created" : "member.role", target: `same-${i}`, createdAt: SAME })));
  await db.insert(s.auditLog).values(Array.from({ length: 3 }, (_, i) => ({ workspaceId: A.ws.id, action: "token.created", target: `later-${i}`, createdAt: new Date(SAME.getTime() + (i + 1) * 1000) })));
  await db.insert(s.auditLog).values([{ workspaceId: B.ws.id, action: "token.created", target: "b-secret" }, { workspaceId: B.ws.id, action: "member.role", target: "b-secret-2" }]);
});

describe("incidentPage", () => {
  test("pages newest number first with no duplicates or gaps, matching incidentRows", async () => {
    const { pages, rows } = await all((cursor) => A.sc.incidentPage({ cursor, limit: 3 }));
    expect(pages.map((p) => p.map((r) => r.incident.number))).toEqual([[7, 6, 5], [4, 3, 2], [1]]);
    expect(JSON.parse(JSON.stringify(rows))).toEqual(JSON.parse(JSON.stringify(await A.sc.incidentRows({}))));
  });

  test("each row carries its latest attempt, and no repository when it is archived", async () => {
    const { rows } = await A.sc.incidentPage({ limit: 50 });
    const by = Object.fromEntries(rows.map((r) => [r.incident.number, r]));
    expect(by[5].run).toMatchObject({ attempt: 2, status: "proven" });
    expect(by[4].run).toBeUndefined();
    expect(by[3].repo).toBeUndefined();
    expect(by[4].repo?.name).toBe("shop");
  });

  test("filters by status and repository", async () => {
    expect((await A.sc.incidentPage({ status: "awaiting_fix" })).rows.map((r) => r.incident.number)).toEqual([4, 2]);
    expect((await A.sc.incidentPage({ repo: A.gone.id })).rows.map((r) => r.incident.number)).toEqual([3]);
    expect((await A.sc.incidentPage({ repo: B.live.id })).rows).toEqual([]);
  });

  test("a new incident arriving between pages neither repeats nor hides rows", async () => {
    const first = await A.sc.incidentPage({ limit: 2 });
    const [extra] = await db.insert(s.incidents).values({ workspaceId: A.ws.id, number: 99, title: "late", source: "form", status: "awaiting_fix" }).returning();
    try {
      const rest = await all((cursor) => A.sc.incidentPage({ cursor: cursor ?? first.nextCursor!, limit: 2 }));
      expect([...first.rows, ...rest.rows].map((r) => r.incident.number)).toEqual([7, 6, 5, 4, 3, 2, 1]);
    } finally {
      await db.delete(s.incidents).where(eq(s.incidents.id, extra.id));
    }
  });

  test("another workspace's rows never appear", async () => {
    const { rows } = await all((cursor) => B.sc.incidentPage({ cursor, limit: 2 }));
    expect(rows.map((r) => r.incident.title)).toEqual(["B3", "B2", "B1"]);
    // A cursor from A, replayed in B, still only reads B.
    const fromA = (await A.sc.incidentPage({ limit: 1 })).nextCursor;
    expect((await B.sc.incidentPage({ cursor: fromA })).rows.every((r) => r.incident.workspaceId === B.ws.id)).toBe(true);
  });
});

describe("checkPage", () => {
  test("latest check per pull request, newest first, with ties on time broken by id", async () => {
    const { pages, rows } = await all((cursor) => A.sc.checkPage({ cursor, limit: 2 }));
    expect(pages.every((p) => p.length <= 2)).toBe(true);
    expect(rows.map((r) => r.check.prNumber).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(new Set(rows.map((r) => r.check.id)).size).toBe(9);
    expect(rows.find((r) => r.check.prNumber === 2)?.check.verdict).toBe("recur");
    expect(JSON.parse(JSON.stringify(rows))).toEqual(JSON.parse(JSON.stringify(await A.sc.checks())));
  });

  test("history pages through every check, and verdict filters the latest", async () => {
    const { rows } = await all((cursor) => A.sc.checkPage({ cursor, limit: 3, history: true }));
    expect(rows.length).toBe(13);
    expect(new Set(rows.map((r) => r.check.id)).size).toBe(13);
    const times = rows.map((r) => r.check.createdAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect((await A.sc.checkPage({ verdict: "recur" })).rows.map((r) => r.check.prNumber)).toEqual([2]);
    expect((await A.sc.checkPage({ verdict: "safe" })).rows.map((r) => r.check.prNumber).sort()).toEqual([1, 3, 4]);
  });

  test("never shows another workspace's checks", async () => {
    const { rows } = await all((cursor) => A.sc.checkPage({ cursor, limit: 4, history: true }));
    expect(rows.some((r) => r.check.title === "secret")).toBe(false);
    expect((await B.sc.checkPage({})).rows.map((r) => r.check.title)).toEqual(["secret"]);
  });
});

describe("memoryPage", () => {
  test("pages by incident, two tests for one incident split cleanly across pages", async () => {
    const { pages, rows } = await all((cursor) => A.sc.memoryPage({ cursor, limit: 3 }));
    expect(pages.map((p) => p.length)).toEqual([3, 3, 2]);
    expect(rows.map((r) => r.incident.number)).toEqual([7, 7, 5, 5, 3, 3, 1, 1]);
    expect(new Set(rows.map((r) => r.test.id)).size).toBe(8);
    expect(JSON.parse(JSON.stringify(rows))).toEqual(JSON.parse(JSON.stringify(await A.sc.memory())));
  });

  test("filters by health and stays in its workspace", async () => {
    expect((await A.sc.memoryPage({ health: "flaky" })).rows.map((r) => r.test.path)).toEqual(["t_1_a.py"]);
    expect((await B.sc.memoryPage({})).rows.map((r) => r.test.path)).toEqual(["b_3.py", "b_2.py", "b_1.py"]);
  });
});

describe("auditPage", () => {
  test("entries written in the same instant page without repeats or gaps", async () => {
    const { pages, rows } = await all((cursor) => A.sc.auditPage({ cursor, limit: 4 }));
    expect(pages.map((p) => p.length)).toEqual([4, 4, 2]);
    expect(rows.slice(0, 3).map((r) => r.target)).toEqual(["later-2", "later-1", "later-0"]);
    expect(new Set(rows.map((r) => r.id)).size).toBe(10);
    expect(rows.map((r) => r.id)).toEqual((await A.sc.auditLog(100)).map((r) => r.id));
  });

  test("filters by action and never shows another workspace", async () => {
    const { rows } = await all((cursor) => A.sc.auditPage({ cursor, limit: 2, action: "token.created" }));
    expect(rows.length).toBe(6);
    expect(rows.every((r) => r.action === "token.created" && !r.target.startsWith("b-"))).toBe(true);
  });
});

describe("limits and cursors", () => {
  test("limits are clamped to 1..200 and default to 50 (100 for the audit log)", async () => {
    expect((await A.sc.incidentPage({ limit: 0 })).rows.length).toBe(1);
    expect((await A.sc.incidentPage({ limit: -5 })).rows.length).toBe(1);
    expect((await A.sc.incidentPage({ limit: 2.7 })).rows.length).toBe(2);
    expect((await A.sc.incidentPage({ limit: Number.NaN })).rows.length).toBe(7);
    expect((await A.sc.auditPage({ limit: 10_000 })).rows.length).toBe(10);
    expect(MAX_PAGE).toBe(200);
  });

  test("the last page has no next cursor; malformed or foreign cursors start over", async () => {
    expect((await A.sc.incidentPage({ limit: 7 })).nextCursor).toBeNull();
    expect((await A.sc.incidentPage({ limit: 6 })).nextCursor).not.toBeNull();
    for (const bad of ["not-a-cursor", "", Buffer.from("[1,2]").toString("base64url"), encodeCursor("check", 5, "x"), encodeCursor("audit", "yesterday", "x")]) {
      expect((await A.sc.incidentPage({ cursor: bad, limit: 1 })).rows[0].incident.number).toBe(7);
      expect((await A.sc.auditPage({ cursor: bad, limit: 1 })).rows[0].target).toBe("later-2");
    }
  });
});

describe("overviewSummary", () => {
  test("matches what the Overview page derives from the full lists", async () => {
    const sum = await A.sc.overviewSummary();
    const [rows, memory, checks, history] = await Promise.all([A.sc.incidentRows({}), A.sc.memory(), A.sc.checks(), A.sc.checks({ history: true })]);
    const week = Date.now() - 7 * 86_400_000;
    const recur = history.filter((c, i, all) => c.check.verdict === "recur" && all.findIndex((x) => x.check.verdict === "recur" && x.check.repoId === c.check.repoId && x.check.prNumber === c.check.prNumber) === i);
    expect(sum.counts).toEqual({
      repositories: 1,
      incidents: rows.length,
      awaitingFix: rows.filter((r) => r.incident.status === "awaiting_fix").length,
      unproven: rows.filter((r) => r.incident.status === "unproven").length,
      memory: memory.length,
      memoryRepositories: new Set(memory.map((m) => m.repo.id)).size,
      checksEver: history.length,
      pullsChecked7d: checks.filter((c) => c.check.createdAt.getTime() > week).length,
      recurrencesBlocked: recur.length,
    });
    expect(sum.latestRecurrence).toEqual({ prNumber: recur[0].check.prNumber, repoName: recur[0].repo.name });
    const expected = [
      ...memory.filter((m) => m.test.botPrState === "open").map((m) => `merge:${m.incident.number}`),
      ...rows.filter((r) => r.incident.status === "unproven").map((r) => `unproven:${r.incident.number}`),
      ...rows.filter((r) => r.incident.status === "awaiting_fix").map((r) => `awaiting_fix:${r.incident.number}`),
    ];
    expect(sum.decisionCount).toBe(expected.length);
    expect(sum.decisions.map((d) => (d.kind === "merge_test" ? `merge:${d.incidentNumber}` : `${d.kind}:${d.incident.number}`))).toEqual(expected.slice(0, 3));
    expect(sum.decisions[0]).toMatchObject({ kind: "merge_test", botPr: 50, path: "t_5_a.py" });
    expect(sum.recentChecks.map((c) => c.check.id)).toEqual(checks.slice(0, 5).map((c) => c.check.id));
    expect(sum.traveling?.incident.number).toBe(7);
    expect(sum.traveling?.run).toMatchObject({ attempt: 2, status: "running" });
    // A file listed twice on one incident counts once.
    expect(sum.faults).toEqual([{ file: "cart.py", count: 4 }, { file: "pay.py", count: 3 }]);
    expect(sum.workspace?.id).toBe(A.ws.id);
  });

  test("an empty workspace gets zeros and empty lists", async () => {
    const empty = await world(db, "page-empty");
    const sum = await empty.sc.overviewSummary();
    expect(sum).toMatchObject({ decisions: [], decisionCount: 0, recentChecks: [], traveling: null, faults: [], activity: [], latestRecurrence: null });
    expect(Object.values(sum.counts).filter((n) => n !== 0)).toEqual([1]); // only the live repository
  });
});
