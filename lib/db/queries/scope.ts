import { and, asc, count, desc, eq, gte, inArray, sql, type SQL, type SQLWrapper, isNull, isNotNull } from "drizzle-orm";
import { alias, type AnyPgColumn } from "drizzle-orm/pg-core";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { faultLines } from "@/lib/domain/faultlines";
import { clampLimit, decodeCursor, encodeCursor, toPage, type Page } from "./paging";
import { toCsv } from "@/lib/data/csv";

export type { Page } from "./paging";
export type IncidentFilter = { status?: s.IncidentStatus; source?: s.IncidentSource };

/** One incident on a list: its repository (unless archived) and its latest time travel attempt. */
export type IncidentListRow = { incident: s.IncidentRow; repo: s.RepositoryRow | undefined; run: s.TimeTravelRunRow | undefined };
/** One pull request check with its results and how many incidents it skipped. */
export type CheckListRow = { check: s.PrCheckRow; repo: s.RepositoryRow; results: (typeof s.prCheckResults.$inferSelect)[]; skipped: number };
/** One memory test with its incident, repository, and how often it ran in (guarded) and blocked a pull request. */
export type MemoryListRow = { test: s.MemoryTestRow; incident: s.IncidentRow; repo: s.RepositoryRow; guarded: number; blocked: number };
export type AuditListRow = { id: string; action: string; target: string; detail: string; createdAt: Date; actor: string | null };
export type ActivityRow = typeof s.activity.$inferSelect;
export type WorkspaceSettings = (typeof s.workspaces.$inferSelect)["settings"];

/** Something on the Overview waiting on a person, in the order the page shows them. */
export type OverviewDecision =
  | { kind: "merge_test"; incidentNumber: number; botPr: number | null; path: string }
  | { kind: "unproven" | "awaiting_fix"; incident: s.IncidentRow };

/**
 * Everything the Overview page shows, from `scoped(ws).overviewSummary()`.
 * Lists are already cut to what the page shows; counts cover the whole workspace.
 */
export type OverviewSummary = {
  workspace: typeof s.workspaces.$inferSelect | null;
  counts: {
    /** Repositories the GitHub App can see (archived ones excluded). */
    repositories: number;
    incidents: number;
    awaitingFix: number;
    unproven: number;
    /** Memory tests, and how many repositories they span. */
    memory: number;
    memoryRepositories: number;
    /** Every check ever run (the "see a pull request checked" step). */
    checksEver: number;
    /** Pull requests whose latest check ran in the last 7 days. */
    pullsChecked7d: number;
    /** Distinct pull requests a recurrence was ever blocked on. */
    recurrencesBlocked: number;
  };
  /** The newest pull request a recurrence was blocked on, for the stat's link. */
  latestRecurrence: { prNumber: number; repoName: string } | null;
  /** Up to 3, ordered: test PRs to merge, then unproven, then awaiting fix (newest incident first in each). */
  decisions: OverviewDecision[];
  /** All waiting decisions, for the headline ("Three decisions are waiting on you"). */
  decisionCount: number;
  /** Latest check per pull request, newest first, up to 5. */
  recentChecks: CheckListRow[];
  /** The newest incident being time travelled, with its current run. */
  traveling: IncidentListRow | null;
  /** Files where incidents keep starting, most incidents first, up to 5. */
  faults: { file: string; count: number }[];
  /** Newest activity, up to 5. */
  activity: ActivityRow[];
};

/** A timestamp as UTC text with microseconds, so a cursor round-trips exactly. */
const tsKey = (col: AnyPgColumn) => sql<string>`to_char(${col} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
/** Rows strictly after the cursor in a (sort column desc, id desc) order. */
const before = (col: SQLWrapper, idCol: SQLWrapper, key: string | number, id: string, ts = false) =>
  ts ? sql`(${col}, ${idCol}) < (${key}::timestamptz, ${id})` : sql`(${col}, ${idCol}) < (${key}, ${id})`;

/** Only a pull request's latest check: no later check exists for the same repository and number. */
const newer = alias(s.prChecks, "newer_check");
const latestPerPr = sql`not exists (select 1 from ${s.prChecks} as ${newer} where ${newer.workspaceId} = ${s.prChecks.workspaceId} and ${newer.repoId} = ${s.prChecks.repoId} and ${newer.prNumber} = ${s.prChecks.prNumber} and (${newer.createdAt}, ${newer.id}) > (${s.prChecks.createdAt}, ${s.prChecks.id}))`;

const month = () => new Date().toISOString().slice(0, 7);

/**
 * Every read and write for a signed-in request goes through here, so no query can
 * forget the workspace filter.
 */
export function scoped(workspaceId: string) {
  const mineInc = eq(s.incidents.workspaceId, workspaceId);
  const mineCheck = eq(s.prChecks.workspaceId, workspaceId);

  const incidentWhere = (filter: IncidentFilter & { repo?: string }): SQL => {
    const where: SQL[] = [mineInc];
    if (filter.status) where.push(eq(s.incidents.status, filter.status));
    if (filter.source) where.push(eq(s.incidents.source, filter.source));
    if (filter.repo) where.push(eq(s.incidents.repoId, filter.repo));
    return and(...where)!;
  };

  /** Incidents (newest number first) with their repository and latest attempt: two queries, whatever the count. */
  async function incidentList(where: SQL, limit?: number): Promise<(IncidentListRow & { key: number })[]> {
    const db = await getDb();
    const q = db
      .select({ incident: s.incidents, repo: s.repositories })
      .from(s.incidents)
      .leftJoin(s.repositories, and(eq(s.repositories.id, s.incidents.repoId), eq(s.repositories.workspaceId, workspaceId), isNull(s.repositories.archivedAt)))
      .where(where)
      .orderBy(desc(s.incidents.number), desc(s.incidents.id))
      .$dynamic();
    const rows = await (limit === undefined ? q : q.limit(limit));
    if (!rows.length) return [];
    // Latest attempt per incident, in SQL. A page asks by id; a full list by the same filter (no huge IN list).
    const which =
      limit === undefined
        ? inArray(s.timeTravelRuns.incidentId, db.select({ id: s.incidents.id }).from(s.incidents).where(where))
        : inArray(s.timeTravelRuns.incidentId, rows.map((r) => r.incident.id));
    const runs = await db.selectDistinctOn([s.timeTravelRuns.incidentId]).from(s.timeTravelRuns).where(which).orderBy(s.timeTravelRuns.incidentId, desc(s.timeTravelRuns.attempt), desc(s.timeTravelRuns.createdAt));
    const latest = new Map(runs.map((r) => [r.incidentId, r]));
    return rows.map((r) => ({ incident: r.incident, repo: r.repo ?? undefined, run: latest.get(r.incident.id), key: r.incident.number }));
  }

  /** Checks newest first, latest per pull request unless `history`, with results and skip counts for just those checks. */
  async function checkList(filter: { verdict?: s.CheckVerdict; history?: boolean }, page?: { after: { key: string; id: string } | null; limit: number }): Promise<(CheckListRow & { key: string })[]> {
    const db = await getDb();
    const where: SQL[] = [mineCheck];
    if (!filter.history) where.push(latestPerPr);
    if (filter.verdict) where.push(eq(s.prChecks.verdict, filter.verdict));
    if (page?.after) where.push(before(s.prChecks.createdAt, s.prChecks.id, page.after.key, page.after.id, true));
    const q = db
      .select({ check: s.prChecks, repo: s.repositories, key: tsKey(s.prChecks.createdAt) })
      .from(s.prChecks)
      .innerJoin(s.repositories, eq(s.repositories.id, s.prChecks.repoId))
      .where(and(...where))
      .orderBy(desc(s.prChecks.createdAt), desc(s.prChecks.id))
      .$dynamic();
    const rows = await (page ? q.limit(page.limit) : q);
    const ids = rows.map((r) => r.check.id);
    if (!ids.length) return [];
    const [results, skips] = await Promise.all([
      db.select().from(s.prCheckResults).where(inArray(s.prCheckResults.checkId, ids)),
      db.select({ checkId: s.prCheckSkips.checkId, n: count() }).from(s.prCheckSkips).where(inArray(s.prCheckSkips.checkId, ids)).groupBy(s.prCheckSkips.checkId),
    ]);
    const resultsBy = new Map<string, typeof results>();
    for (const r of results) resultsBy.set(r.checkId, [...(resultsBy.get(r.checkId) ?? []), r]);
    const skipBy = new Map(skips.map((x) => [x.checkId, x.n]));
    return rows.map((r) => ({ check: r.check, repo: r.repo, results: resultsBy.get(r.check.id) ?? [], skipped: skipBy.get(r.check.id) ?? 0, key: r.key }));
  }

  /** Memory tests by incident number (newest first) with how often each guarded and blocked a pull request. */
  async function memoryList(filter: { health?: s.MemoryTestRow["health"] }, page?: { after: { key: number; id: string } | null; limit: number }): Promise<(MemoryListRow & { key: number })[]> {
    const db = await getDb();
    const where: SQL[] = [eq(s.memoryTests.workspaceId, workspaceId)];
    if (filter.health) where.push(eq(s.memoryTests.health, filter.health));
    if (page?.after) where.push(before(s.incidents.number, s.memoryTests.id, page.after.key, page.after.id));
    const q = db
      .select({ test: s.memoryTests, incident: s.incidents, repo: s.repositories })
      .from(s.memoryTests)
      .innerJoin(s.incidents, eq(s.incidents.id, s.memoryTests.incidentId))
      .innerJoin(s.repositories, eq(s.repositories.id, s.memoryTests.repoId))
      .where(and(...where))
      .orderBy(desc(s.incidents.number), desc(s.memoryTests.id))
      .$dynamic();
    const rows = await (page ? q.limit(page.limit) : q);
    if (!rows.length) return [];
    const statWhere: SQL[] = [mineCheck];
    if (page) statWhere.push(inArray(s.prCheckResults.memoryTestId, rows.map((r) => r.test.id)));
    const stats = await db
      .select({ id: s.prCheckResults.memoryTestId, guarded: count(), blocked: sql<number>`count(*) filter (where ${s.prCheckResults.verdict} = 'recur')` })
      .from(s.prCheckResults)
      .innerJoin(s.prChecks, eq(s.prChecks.id, s.prCheckResults.checkId))
      .where(and(...statWhere))
      .groupBy(s.prCheckResults.memoryTestId);
    const by = new Map(stats.map((x) => [x.id, x]));
    return rows.map((r) => ({ ...r, guarded: Number(by.get(r.test.id)?.guarded ?? 0), blocked: Number(by.get(r.test.id)?.blocked ?? 0), key: r.incident.number }));
  }

  async function auditList(filter: { action?: string }, page?: { after: { key: string; id: string } | null; limit: number }): Promise<(AuditListRow & { key: string })[]> {
    const db = await getDb();
    const where: SQL[] = [eq(s.auditLog.workspaceId, workspaceId)];
    if (filter.action) where.push(eq(s.auditLog.action, filter.action));
    if (page?.after) where.push(before(s.auditLog.createdAt, s.auditLog.id, page.after.key, page.after.id, true));
    const q = db
      .select({ id: s.auditLog.id, action: s.auditLog.action, target: s.auditLog.target, detail: s.auditLog.detail, createdAt: s.auditLog.createdAt, actor: s.users.login, key: tsKey(s.auditLog.createdAt) })
      .from(s.auditLog)
      .leftJoin(s.users, eq(s.users.id, s.auditLog.actorUserId))
      .where(and(...where))
      .orderBy(desc(s.auditLog.createdAt), desc(s.auditLog.id))
      .$dynamic();
    return page ? q.limit(page.limit) : q;
  }

  /** Drops the internal sort key the cursor is built from. */
  const strip = <T extends { key: unknown }>(rows: T[]): Omit<T, "key">[] => rows.map(({ key: _k, ...rest }) => rest);

  const api = {
    workspaceId,

    async workspace() {
      const db = await getDb();
      const [w] = await db.select().from(s.workspaces).where(eq(s.workspaces.id, workspaceId));
      return w ?? null;
    },

    async me(userId: string) {
      const db = await getDb();
      const [row] = await db
        .select({ user: s.users, role: s.memberships.role })
        .from(s.memberships)
        .innerJoin(s.users, eq(s.users.id, s.memberships.userId))
        .where(and(eq(s.memberships.workspaceId, workspaceId), eq(s.memberships.userId, userId)));
      return row ?? null;
    },

    async workspacesFor(userId: string) {
      const db = await getDb();
      return db
        .select({ id: s.workspaces.id, name: s.workspaces.name })
        .from(s.memberships)
        .innerJoin(s.workspaces, eq(s.workspaces.id, s.memberships.workspaceId))
        .where(eq(s.memberships.userId, userId))
        .orderBy(asc(s.workspaces.name));
    },

    async auditLog(limit: number): Promise<AuditListRow[]> {
      return strip(await auditList({}, { after: null, limit }));
    },

    /** The audit log, newest first, `limit` (1–200, default 100) entries at a time. `action` matches exactly, e.g. "token.created". */
    async auditPage(opts: { cursor?: string | null; limit?: number; action?: string } = {}): Promise<Page<AuditListRow>> {
      const limit = clampLimit(opts.limit, 100);
      const rows = await auditList({ action: opts.action }, { after: decodeCursor<string>("audit", opts.cursor, "string"), limit: limit + 1 });
      const page = toPage(rows, limit, (r) => encodeCursor("audit", r.key, r.id));
      return { rows: strip(page.rows), nextCursor: page.nextCursor };
    },

    /** The whole audit log as a file body, newest first: CSV (safe to open in a spreadsheet) or JSON. */
    async auditExport(format: "csv" | "json"): Promise<string> {
      const rows = strip(await auditList({}));
      if (format === "json") return JSON.stringify(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })), null, 2);
      return toCsv(["time", "actor", "action", "target", "detail", "id"], rows.map((r) => [r.createdAt.toISOString(), r.actor ?? "", r.action, r.target, r.detail, r.id]));
    },

    async members() {
      const db = await getDb();
      return db
        .select({ user: s.users, role: s.memberships.role })
        .from(s.memberships)
        .innerJoin(s.users, eq(s.users.id, s.memberships.userId))
        .where(eq(s.memberships.workspaceId, workspaceId))
        .orderBy(asc(s.users.login));
    },

    async repos() {
      const db = await getDb();
      return db.select().from(s.repositories).where(and(eq(s.repositories.workspaceId, workspaceId), isNull(s.repositories.archivedAt))).orderBy(asc(s.repositories.name));
    },

    async repo(id: string) {
      const db = await getDb();
      const [r] = await db.select().from(s.repositories).where(and(eq(s.repositories.workspaceId, workspaceId), eq(s.repositories.id, id)));
      return r ?? null;
    },

    async getIncident(number: number) {
      const db = await getDb();
      const [row] = await db.select().from(s.incidents).where(and(mineInc, eq(s.incidents.number, number)));
      return row ?? null;
    },

    async getIncidentById(id: string) {
      const db = await getDb();
      const [row] = await db.select().from(s.incidents).where(and(mineInc, eq(s.incidents.id, id)));
      return row ?? null;
    },

    async listIncidents(filter: IncidentFilter) {
      const db = await getDb();
      return db.select().from(s.incidents).where(incidentWhere(filter)).orderBy(desc(s.incidents.number));
    },

    /** Incidents with their repo name and the latest attempt's results. Every row: prefer `incidentPage`. */
    async incidentRows(filter: IncidentFilter): Promise<IncidentListRow[]> {
      return strip(await incidentList(incidentWhere(filter)));
    },

    /**
     * One page of incidents, newest number first, each with its repository and latest attempt.
     * `repo` is a repository id. `limit` is 1–200 (default 50). Pass `nextCursor` back as `cursor` for the next page.
     */
    async incidentPage(opts: IncidentFilter & { repo?: string; cursor?: string | null; limit?: number } = {}): Promise<Page<IncidentListRow>> {
      const limit = clampLimit(opts.limit, 50);
      const after = decodeCursor<number>("incident", opts.cursor, "number");
      const where = incidentWhere(opts);
      const rows = await incidentList(after ? and(where, before(s.incidents.number, s.incidents.id, after.key, after.id))! : where, limit + 1);
      const page = toPage(rows, limit, (r) => encodeCursor("incident", r.key, r.incident.id));
      return { rows: strip(page.rows), nextCursor: page.nextCursor };
    },

    async statusCounts() {
      const db = await getDb();
      const rows = await db.select({ status: s.incidents.status, n: count() }).from(s.incidents).where(mineInc).groupBy(s.incidents.status);
      const out: Record<string, number> = { all: 0 };
      for (const r of rows) {
        out[r.status] = r.n;
        out.all += r.n;
      }
      return out;
    },

    async nextIncidentNumber() {
      const db = await getDb();
      const [{ max }] = await db.select({ max: sql<number | null>`max(${s.incidents.number})` }).from(s.incidents).where(mineInc);
      return (max ?? 0) + 1;
    },

    async runs(incidentId: string) {
      const db = await getDb();
      const inc = await api.getIncidentById(incidentId);
      if (!inc) return [];
      return db.select().from(s.timeTravelRuns).where(eq(s.timeTravelRuns.incidentId, inc.id)).orderBy(asc(s.timeTravelRuns.attempt));
    },

    /** Inputs for lib/domain/insights.ts: incidents with when they were first proven, checks, and test health. */
    async insightsData() {
      const db = await getDb();
      const [incidents, proofs, checks, tests] = await Promise.all([
        db.select({ id: s.incidents.id, status: s.incidents.status, createdAt: s.incidents.createdAt, watchedFiles: s.incidents.watchedFiles }).from(s.incidents).where(eq(s.incidents.workspaceId, workspaceId)),
        db
          .select({ incidentId: s.timeTravelRuns.incidentId, at: sql<Date>`min(${s.timeTravelRuns.finishedAt})` })
          .from(s.timeTravelRuns)
          .innerJoin(s.incidents, eq(s.incidents.id, s.timeTravelRuns.incidentId))
          .where(and(eq(s.incidents.workspaceId, workspaceId), eq(s.timeTravelRuns.status, "proven")))
          .groupBy(s.timeTravelRuns.incidentId),
        db.select({ verdict: s.prChecks.verdict, overridden: s.prChecks.overridden, createdAt: s.prChecks.createdAt }).from(s.prChecks).where(and(eq(s.prChecks.workspaceId, workspaceId), eq(s.prChecks.status, "done"))),
        db.select({ health: s.memoryTests.health, guardStatus: s.memoryTests.guardStatus, strength: s.memoryTests.strength }).from(s.memoryTests).where(eq(s.memoryTests.workspaceId, workspaceId)),
      ]);
      const provenAt = new Map(proofs.map((p) => [p.incidentId, p.at ? new Date(p.at) : null]));
      return {
        now: new Date(),
        incidents: incidents.map((i) => ({ ...i, provenAt: i.status === "proven" ? (provenAt.get(i.id) ?? null) : null })),
        checks,
        tests: tests.map((t) => ({ health: t.health, guardStatus: t.guardStatus, strength: t.strength?.score ?? null })),
      };
    },

    async memoryTestsForIncident(incidentId: string) {
      const db = await getDb();
      return db.select().from(s.memoryTests).where(and(eq(s.memoryTests.workspaceId, workspaceId), eq(s.memoryTests.incidentId, incidentId)));
    },

    async memoryForIncident(incidentId: string) {
      const db = await getDb();
      const [m] = await db.select().from(s.memoryTests).where(and(eq(s.memoryTests.workspaceId, workspaceId), eq(s.memoryTests.incidentId, incidentId)));
      return m ?? null;
    },

    async notes(incidentId: string) {
      const db = await getDb();
      if (!(await api.getIncidentById(incidentId))) return [];
      return db
        .select({ note: s.notes, user: s.users })
        .from(s.notes)
        .leftJoin(s.users, eq(s.users.id, s.notes.userId))
        .where(eq(s.notes.incidentId, incidentId))
        .orderBy(asc(s.notes.createdAt));
    },

    async trail(incidentId: string) {
      const db = await getDb();
      return db
        .select()
        .from(s.activity)
        .where(and(eq(s.activity.workspaceId, workspaceId), eq(s.activity.incidentId, incidentId)))
        .orderBy(asc(s.activity.createdAt));
    },

    /** Recent activity with the incident number for linking (the inbox). */
    async inbox(limit = 12) {
      const db = await getDb();
      return db
        .select({ id: s.activity.id, title: s.activity.title, detail: s.activity.detail, tone: s.activity.tone, createdAt: s.activity.createdAt, number: s.incidents.number })
        .from(s.activity)
        .leftJoin(s.incidents, eq(s.incidents.id, s.activity.incidentId))
        .where(eq(s.activity.workspaceId, workspaceId))
        .orderBy(desc(s.activity.createdAt))
        .limit(limit);
    },

    async activity(limit = 6) {
      const db = await getDb();
      return db.select().from(s.activity).where(eq(s.activity.workspaceId, workspaceId)).orderBy(desc(s.activity.createdAt)).limit(limit);
    },

    /** Pull request checks this incident's memory test has run in. */
    async checksForIncident(incidentId: string) {
      const db = await getDb();
      return db
        .select({ check: s.prChecks, result: s.prCheckResults })
        .from(s.prCheckResults)
        .innerJoin(s.memoryTests, eq(s.memoryTests.id, s.prCheckResults.memoryTestId))
        .innerJoin(s.prChecks, eq(s.prChecks.id, s.prCheckResults.checkId))
        .where(and(eq(s.memoryTests.incidentId, incidentId), eq(s.prChecks.workspaceId, workspaceId)))
        .orderBy(desc(s.prChecks.createdAt));
    },

    /** Every memory test. Prefer `memoryPage`. */
    async memory(): Promise<MemoryListRow[]> {
      return strip(await memoryList({}));
    },

    /** One page of memory tests, newest incident first. `limit` is 1–200 (default 50). */
    async memoryPage(opts: { cursor?: string | null; limit?: number; health?: s.MemoryTestRow["health"] } = {}): Promise<Page<MemoryListRow>> {
      const limit = clampLimit(opts.limit, 50);
      const rows = await memoryList({ health: opts.health }, { after: decodeCursor<number>("memory", opts.cursor, "number"), limit: limit + 1 });
      const page = toPage(rows, limit, (r) => encodeCursor("memory", r.key, r.test.id));
      return { rows: strip(page.rows), nextCursor: page.nextCursor };
    },

    /** One row per pull request — its latest check — unless `history` asks for every check. Every row: prefer `checkPage`. */
    async checks(filter: { verdict?: s.CheckVerdict; history?: boolean } = {}): Promise<CheckListRow[]> {
      return strip(await checkList(filter));
    },

    /**
     * One page of checks, newest first: the latest check per pull request, or every check with `history`.
     * `limit` is 1–200 (default 50).
     */
    async checkPage(opts: { cursor?: string | null; limit?: number; history?: boolean; verdict?: s.CheckVerdict } = {}): Promise<Page<CheckListRow>> {
      const limit = clampLimit(opts.limit, 50);
      const rows = await checkList({ history: opts.history, verdict: opts.verdict }, { after: decodeCursor<string>("check", opts.cursor, "string"), limit: limit + 1 });
      const page = toPage(rows, limit, (r) => encodeCursor("check", r.key, r.check.id));
      return { rows: strip(page.rows), nextCursor: page.nextCursor };
    },

    async verdictCounts() {
      const db = await getDb();
      const rows = await db.select({ v: s.prChecks.verdict, n: count() }).from(s.prChecks).where(and(mineCheck, latestPerPr)).groupBy(s.prChecks.verdict);
      const out: Record<string, number> = { all: 0 };
      for (const r of rows) {
        const k = r.v ?? "running";
        out[k] = (out[k] ?? 0) + r.n;
        out.all += r.n;
      }
      return out;
    },

    async check(prNumber: number, repoName?: string) {
      const db = await getDb();
      const where: SQL[] = [eq(s.prChecks.workspaceId, workspaceId), eq(s.prChecks.prNumber, prNumber)];
      if (repoName) where.push(eq(s.repositories.name, repoName));
      const [row] = await db
        .select({ check: s.prChecks, repo: s.repositories })
        .from(s.prChecks)
        .innerJoin(s.repositories, eq(s.repositories.id, s.prChecks.repoId))
        .where(and(...where))
        .orderBy(desc(s.prChecks.createdAt))
        .limit(1);
      if (!row) return null;
      const results = await db
        .select({ result: s.prCheckResults, test: s.memoryTests, incident: s.incidents })
        .from(s.prCheckResults)
        .innerJoin(s.memoryTests, eq(s.memoryTests.id, s.prCheckResults.memoryTestId))
        .innerJoin(s.incidents, eq(s.incidents.id, s.memoryTests.incidentId))
        .where(eq(s.prCheckResults.checkId, row.check.id));
      const skips = await db
        .select({ skip: s.prCheckSkips, incident: s.incidents })
        .from(s.prCheckSkips)
        .innerJoin(s.incidents, eq(s.incidents.id, s.prCheckSkips.incidentId))
        .where(eq(s.prCheckSkips.checkId, row.check.id));
      const [fix] = await db.select().from(s.suggestedFixes).where(eq(s.suggestedFixes.checkId, row.check.id)).orderBy(desc(s.suggestedFixes.createdAt)).limit(1);
      const overrides = await db
        .select({ o: s.overrides, user: s.users })
        .from(s.overrides)
        .leftJoin(s.users, eq(s.users.id, s.overrides.userId))
        .where(eq(s.overrides.checkId, row.check.id));
      const order: Record<string, number> = { recur: 0, inconclusive: 1, safe: 2, skipped: 3 };
      results.sort((a, b) => order[a.result.verdict] - order[b.result.verdict] || b.incident.number - a.incident.number);
      return { ...row, results, skips, fix: fix ?? null, overrides };
    },

    async integrations() {
      const db = await getDb();
      return db.select().from(s.integrations).where(eq(s.integrations.workspaceId, workspaceId));
    },

    async deliveries(kind: string, limit = 8) {
      const db = await getDb();
      return db
        .select()
        .from(s.deliveries)
        .where(and(eq(s.deliveries.workspaceId, workspaceId), eq(s.deliveries.kind, kind)))
        .orderBy(desc(s.deliveries.createdAt))
        .limit(limit);
    },

    async notificationTargets() {
      const db = await getDb();
      return db.select().from(s.notificationTargets).where(eq(s.notificationTargets.workspaceId, workspaceId)).orderBy(desc(s.notificationTargets.createdAt));
    },

    async notificationLog(limit = 20) {
      const db = await getDb();
      return db
        .select({ id: s.notifications.id, event: s.notifications.event, status: s.notifications.status, attempts: s.notifications.attempts, lastError: s.notifications.lastError, createdAt: s.notifications.createdAt, target: s.notificationTargets.name, title: sql<string>`${s.notifications.payload}->>'title'` })
        .from(s.notifications)
        .innerJoin(s.notificationTargets, eq(s.notificationTargets.id, s.notifications.targetId))
        .where(eq(s.notifications.workspaceId, workspaceId))
        .orderBy(desc(s.notifications.createdAt))
        .limit(limit);
    },

    async tokens() {
      const db = await getDb();
      return db.select().from(s.apiTokens).where(eq(s.apiTokens.workspaceId, workspaceId)).orderBy(desc(s.apiTokens.createdAt));
    },

    /** Distinct human pull request authors in the last 30 days (bots never count). */
    async activeCommitters() {
      const db = await getDb();
      const [row] = await db
        .select({ n: sql<number>`count(distinct ${s.prChecks.author})` })
        .from(s.prChecks)
        .where(and(eq(s.prChecks.workspaceId, workspaceId), eq(s.prChecks.authorIsBot, false), isNotNull(s.prChecks.author), gte(s.prChecks.createdAt, new Date(Date.now() - 30 * 86_400_000))));
      return Number(row?.n ?? 0);
    },

    async usage() {
      const db = await getDb();
      const [u] = await db.select().from(s.usage).where(and(eq(s.usage.workspaceId, workspaceId), eq(s.usage.month, month())));
      const [ws] = await db.select({ plan: s.workspaces.plan }).from(s.workspaces).where(eq(s.workspaces.id, workspaceId));
      const committers = await api.activeCommitters();
      const { allowanceMs } = await import("@/lib/billing/plans");
      return { sandboxCpuMs: u?.sandboxCpuMs ?? 0, drafts: u?.drafts ?? 0, allowanceMs: allowanceMs(ws?.plan ?? "free", committers), committers, plan: ws?.plan ?? "free" };
    },

    /** Sandbox time split by repository (pull request checks) plus time travel, for the usage bar. */
    async usageByRepo() {
      const db = await getDb();
      const since = new Date(month() + "-01T00:00:00Z");
      const checks = await db
        .select({ repo: s.repositories.name, ms: sql<number>`coalesce(sum(${s.prChecks.durationMs}), 0)` })
        .from(s.prChecks)
        .innerJoin(s.repositories, eq(s.repositories.id, s.prChecks.repoId))
        .where(and(eq(s.prChecks.workspaceId, workspaceId), eq(s.prChecks.runner, "sandbox"), gte(s.prChecks.createdAt, since)))
        .groupBy(s.repositories.name);
      const [travel] = await db
        .select({ ms: sql<number>`coalesce(sum(${s.timeTravelRuns.cpuMs}), 0)` })
        .from(s.timeTravelRuns)
        .innerJoin(s.incidents, eq(s.incidents.id, s.timeTravelRuns.incidentId))
        .where(and(mineInc, gte(s.timeTravelRuns.createdAt, since)));
      return { checks: checks.map((c) => ({ repo: c.repo, ms: Number(c.ms) })), travelMs: Number(travel?.ms ?? 0) };
    },

    async memoryCountByRepo() {
      const db = await getDb();
      const rows = await db.select({ repoId: s.memoryTests.repoId, n: count() }).from(s.memoryTests).where(eq(s.memoryTests.workspaceId, workspaceId)).groupBy(s.memoryTests.repoId);
      return Object.fromEntries(rows.map((r) => [r.repoId, r.n]));
    },

    async faultLines() {
      const incidents = await api.listIncidents({});
      return faultLines(incidents);
    },

    // ---------------------------------------------------------------------------------------------
    // Writes. Each one is limited to this workspace's rows, so a forged id from another workspace
    // changes nothing.
    // ---------------------------------------------------------------------------------------------

    async checkById(id: string): Promise<s.PrCheckRow | null> {
      const db = await getDb();
      const [c] = await db.select().from(s.prChecks).where(and(mineCheck, eq(s.prChecks.id, id)));
      return c ?? null;
    },

    /** Records an override and marks the check overridden, together or not at all. Null when the check is not in this workspace. */
    async overrideCheck(checkId: string, userId: string, reason: string): Promise<s.PrCheckRow | null> {
      const db = await getDb();
      return db.transaction(async (tx) => {
        const [check] = await tx.update(s.prChecks).set({ overridden: true }).where(and(mineCheck, eq(s.prChecks.id, checkId))).returning();
        if (!check) return null;
        await tx.insert(s.overrides).values({ checkId: check.id, userId, reason: reason.slice(0, 2000) });
        return check;
      });
    },

    async updateIncident(id: string, patch: Partial<Omit<typeof s.incidents.$inferInsert, "id" | "workspaceId" | "number">>): Promise<s.IncidentRow | null> {
      const db = await getDb();
      const [row] = await db.update(s.incidents).set(patch).where(and(mineInc, eq(s.incidents.id, id))).returning();
      return row ?? null;
    },

    /** Adds a note to one of this workspace's incidents. False when the incident is not here. */
    async addNote(incidentId: string, userId: string, text: string): Promise<boolean> {
      if (!(await api.getIncidentById(incidentId))) return false;
      const db = await getDb();
      await db.insert(s.notes).values({ incidentId, userId, text: text.slice(0, 4000) });
      return true;
    },

    async updateRepo(id: string, patch: Partial<Pick<s.RepositoryRow, "runner" | "checkMode" | "installCmd">>): Promise<void> {
      const db = await getDb();
      await db.update(s.repositories).set(patch).where(and(eq(s.repositories.workspaceId, workspaceId), eq(s.repositories.id, id)));
    },

    /** Updates the workspace; `settings` gets the current settings and returns the new ones (read and write in one transaction, so concurrent saves never drop a key). */
    async updateWorkspace(patch: { name?: string; incidentPrefix?: string }, settings?: (current: WorkspaceSettings) => WorkspaceSettings): Promise<void> {
      const db = await getDb();
      await db.transaction(async (tx) => {
        let next: WorkspaceSettings | undefined;
        if (settings) {
          const [cur] = await tx.select({ settings: s.workspaces.settings }).from(s.workspaces).where(eq(s.workspaces.id, workspaceId)).for("update");
          next = settings(cur?.settings ?? {});
        }
        if (!next && !Object.keys(patch).length) return;
        await tx.update(s.workspaces).set({ ...patch, ...(next ? { settings: next } : {}) }).where(eq(s.workspaces.id, workspaceId));
      });
    },

    async createToken(t: { name: string; prefix: string; hash: string; scope: "read" | "write" }): Promise<void> {
      const db = await getDb();
      await db.insert(s.apiTokens).values({ workspaceId, ...t });
    },

    async revokeToken(id: string): Promise<void> {
      const db = await getDb();
      await db.delete(s.apiTokens).where(and(eq(s.apiTokens.workspaceId, workspaceId), eq(s.apiTokens.id, id)));
    },

    /** Creates or replaces an integration's config; the secret is kept unless a new one is given. */
    async upsertIntegration(kind: s.IntakeKind | "model", config: Record<string, string>, secretCiphertext?: string): Promise<void> {
      const db = await getDb();
      await db
        .insert(s.integrations)
        .values({ workspaceId, kind, config, secretCiphertext: secretCiphertext ?? null })
        .onConflictDoUpdate({ target: [s.integrations.workspaceId, s.integrations.kind], set: { config, ...(secretCiphertext ? { secretCiphertext } : {}) } });
    },

    async setMemberRole(userId: string, role: "owner" | "admin" | "member" | "remove"): Promise<void> {
      const db = await getDb();
      const where = and(eq(s.memberships.workspaceId, workspaceId), eq(s.memberships.userId, userId));
      if (role === "remove") await db.delete(s.memberships).where(where);
      else await db.update(s.memberships).set({ role }).where(where);
    },

    async memoryTest(id: string): Promise<s.MemoryTestRow | null> {
      const db = await getDb();
      const [t] = await db.select().from(s.memoryTests).where(and(eq(s.memoryTests.workspaceId, workspaceId), eq(s.memoryTests.id, id)));
      return t ?? null;
    },

    async releaseQuarantine(id: string): Promise<s.MemoryTestRow | null> {
      const db = await getDb();
      const [t] = await db
        .update(s.memoryTests)
        .set({ quarantined: false, quarantineReason: null, quarantinedAt: null })
        .where(and(eq(s.memoryTests.workspaceId, workspaceId), eq(s.memoryTests.id, id)))
        .returning();
      return t ?? null;
    },

    async navCounts() {
      const db = await getDb();
      const [counts, verdicts, [{ n }]] = await Promise.all([
        api.statusCounts(),
        api.verdictCounts(),
        db.select({ n: count() }).from(s.memoryTests).where(eq(s.memoryTests.workspaceId, workspaceId)),
      ]);
      return { open: (counts.awaiting_fix ?? 0) + (counts.unproven ?? 0), memory: n, recur: verdicts.recur ?? 0 };
    },

    /**
     * Everything the Overview page needs (see OverviewSummary), as one parallel batch of bounded queries:
     * one row of counts, then short lists. Only the fault-line aggregate is one row per watched file
     * (sorted and cut to 5 here, to keep the page's tie order).
     */
    async overviewSummary(): Promise<OverviewSummary> {
      const db = await getDb();
      const week = new Date(Date.now() - 7 * 86_400_000);
      const n = (q: SQL) => sql<number>`(${q})::int`;
      const [workspace, [c], [recur], openTests, waiting, recentChecks, [traveling], faults, activity] = await Promise.all([
        api.workspace(),
        db
          .select({
            repositories: n(sql`select count(*) from ${s.repositories} where ${s.repositories.workspaceId} = ${workspaceId} and ${s.repositories.archivedAt} is null`),
            incidents: n(sql`select count(*) from ${s.incidents} where ${s.incidents.workspaceId} = ${workspaceId}`),
            awaitingFix: n(sql`select count(*) from ${s.incidents} where ${s.incidents.workspaceId} = ${workspaceId} and ${s.incidents.status} = 'awaiting_fix'`),
            unproven: n(sql`select count(*) from ${s.incidents} where ${s.incidents.workspaceId} = ${workspaceId} and ${s.incidents.status} = 'unproven'`),
            memory: n(sql`select count(*) from ${s.memoryTests} where ${s.memoryTests.workspaceId} = ${workspaceId}`),
            memoryRepositories: n(sql`select count(distinct ${s.memoryTests.repoId}) from ${s.memoryTests} where ${s.memoryTests.workspaceId} = ${workspaceId}`),
            openTestPrs: n(sql`select count(*) from ${s.memoryTests} where ${s.memoryTests.workspaceId} = ${workspaceId} and ${s.memoryTests.botPrState} = 'open'`),
            checksEver: n(sql`select count(*) from ${s.prChecks} where ${s.prChecks.workspaceId} = ${workspaceId}`),
            pullsChecked7d: n(sql`select count(distinct (${s.prChecks.repoId}, ${s.prChecks.prNumber})) from ${s.prChecks} where ${s.prChecks.workspaceId} = ${workspaceId} and ${s.prChecks.createdAt} > ${week}`),
          })
          .from(sql`(select 1) as one`),
        db
          .select({ prNumber: s.prChecks.prNumber, repoName: s.repositories.name, total: sql<number>`(count(*) over ())::int` })
          .from(s.prChecks)
          .innerJoin(s.repositories, eq(s.repositories.id, s.prChecks.repoId))
          .where(and(mineCheck, eq(s.prChecks.verdict, "recur")))
          .groupBy(s.prChecks.repoId, s.prChecks.prNumber, s.repositories.name)
          .orderBy(sql`max(${s.prChecks.createdAt}) desc`)
          .limit(1),
        db
          .select({ incidentNumber: s.incidents.number, botPr: s.memoryTests.botPr, path: s.memoryTests.path })
          .from(s.memoryTests)
          .innerJoin(s.incidents, eq(s.incidents.id, s.memoryTests.incidentId))
          .where(and(eq(s.memoryTests.workspaceId, workspaceId), eq(s.memoryTests.botPrState, "open")))
          .orderBy(desc(s.incidents.number), desc(s.memoryTests.id))
          .limit(3),
        // Unproven before awaiting fix, newest first within each: the page's order.
        db
          .select()
          .from(s.incidents)
          .where(and(mineInc, inArray(s.incidents.status, ["unproven", "awaiting_fix"])))
          .orderBy(sql`case when ${s.incidents.status} = 'unproven' then 0 else 1 end`, desc(s.incidents.number))
          .limit(3),
        checkList({}, { after: null, limit: 5 }),
        incidentList(and(mineInc, eq(s.incidents.status, "traveling"))!, 1),
        db
          .select({ file: sql<string>`f.file`, count: sql<number>`(count(distinct ${s.incidents.id}))::int` })
          .from(s.incidents)
          .innerJoin(sql`jsonb_array_elements_text(${s.incidents.watchedFiles}) as f(file)`, sql`true`)
          .where(mineInc)
          .groupBy(sql`f.file`),
        api.activity(5),
      ]);
      const { openTestPrs, ...counts } = c;
      const decisions: OverviewDecision[] = [
        ...openTests.map((t) => ({ kind: "merge_test" as const, ...t })),
        ...waiting.map((i) => ({ kind: i.status as "unproven" | "awaiting_fix", incident: i })),
      ];
      return {
        workspace,
        counts: { ...counts, recurrencesBlocked: recur?.total ?? 0 },
        latestRecurrence: recur ? { prNumber: recur.prNumber, repoName: recur.repoName } : null,
        decisions: decisions.slice(0, 3),
        decisionCount: openTestPrs + counts.unproven + counts.awaitingFix,
        recentChecks: strip(recentChecks),
        traveling: traveling ? strip([traveling])[0] : null,
        faults: faults.sort((a, b) => b.count - a.count || a.file.localeCompare(b.file)).slice(0, 5),
        activity,
      };
    },
  };
  return api;
}
export type Scoped = ReturnType<typeof scoped>;
