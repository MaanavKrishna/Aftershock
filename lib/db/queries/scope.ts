import { and, asc, count, desc, eq, gte, inArray, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { faultLines } from "@/lib/domain/faultlines";

export type IncidentFilter = { status?: s.IncidentStatus; source?: s.IncidentSource };

const month = () => new Date().toISOString().slice(0, 7);
export const SANDBOX_ALLOWANCE_MS = 5 * 3_600_000;

/**
 * Every read and write for a signed-in request goes through here, so no query can
 * forget the workspace filter.
 */
export function scoped(workspaceId: string) {
  const mineInc = eq(s.incidents.workspaceId, workspaceId);

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
      return db.select().from(s.repositories).where(eq(s.repositories.workspaceId, workspaceId)).orderBy(asc(s.repositories.name));
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
      const where: SQL[] = [mineInc];
      if (filter.status) where.push(eq(s.incidents.status, filter.status));
      if (filter.source) where.push(eq(s.incidents.source, filter.source));
      return db.select().from(s.incidents).where(and(...where)).orderBy(desc(s.incidents.number));
    },

    /** Incidents with their repo name and the latest attempt's results, for the list page. */
    async incidentRows(filter: IncidentFilter) {
      const db = await getDb();
      const rows = await api.listIncidents(filter);
      const repos = Object.fromEntries((await api.repos()).map((r) => [r.id, r]));
      const ids = rows.map((r) => r.id);
      const runs = ids.length ? await db.select().from(s.timeTravelRuns).where(inArray(s.timeTravelRuns.incidentId, ids)).orderBy(asc(s.timeTravelRuns.attempt)) : [];
      const latest = new Map<string, s.TimeTravelRunRow>();
      for (const r of runs) latest.set(r.incidentId, r);
      return rows.map((i) => ({ incident: i, repo: i.repoId ? repos[i.repoId] : undefined, run: latest.get(i.id) }));
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
        .innerJoin(s.users, eq(s.users.id, s.notes.userId))
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

    async memory() {
      const db = await getDb();
      const rows = await db
        .select({ test: s.memoryTests, incident: s.incidents, repo: s.repositories })
        .from(s.memoryTests)
        .innerJoin(s.incidents, eq(s.incidents.id, s.memoryTests.incidentId))
        .innerJoin(s.repositories, eq(s.repositories.id, s.memoryTests.repoId))
        .where(eq(s.memoryTests.workspaceId, workspaceId))
        .orderBy(desc(s.incidents.number));
      const stats = await db
        .select({ id: s.prCheckResults.memoryTestId, guarded: count(), blocked: sql<number>`count(*) filter (where ${s.prCheckResults.verdict} = 'recur')` })
        .from(s.prCheckResults)
        .innerJoin(s.prChecks, eq(s.prChecks.id, s.prCheckResults.checkId))
        .where(eq(s.prChecks.workspaceId, workspaceId))
        .groupBy(s.prCheckResults.memoryTestId);
      const by = Object.fromEntries(stats.map((x) => [x.id, x]));
      return rows.map((r) => ({ ...r, guarded: Number(by[r.test.id]?.guarded ?? 0), blocked: Number(by[r.test.id]?.blocked ?? 0) }));
    },

    /** One row per pull request — its latest check — unless `history` asks for every check. */
    async checks(filter: { verdict?: s.CheckVerdict; history?: boolean } = {}) {
      const db = await getDb();
      const all = await db
        .select({ check: s.prChecks, repo: s.repositories })
        .from(s.prChecks)
        .innerJoin(s.repositories, eq(s.repositories.id, s.prChecks.repoId))
        .where(eq(s.prChecks.workspaceId, workspaceId))
        .orderBy(desc(s.prChecks.createdAt));
      const seen = new Set<string>();
      const latest = filter.history ? all : all.filter((r) => !seen.has(`${r.check.repoId}#${r.check.prNumber}`) && seen.add(`${r.check.repoId}#${r.check.prNumber}`));
      const rows = filter.verdict ? latest.filter((r) => r.check.verdict === filter.verdict) : latest;
      const ids = rows.map((r) => r.check.id);
      const results = ids.length ? await db.select().from(s.prCheckResults).where(inArray(s.prCheckResults.checkId, ids)) : [];
      const skips = ids.length ? await db.select({ checkId: s.prCheckSkips.checkId, n: count() }).from(s.prCheckSkips).where(inArray(s.prCheckSkips.checkId, ids)).groupBy(s.prCheckSkips.checkId) : [];
      const skipBy = Object.fromEntries(skips.map((x) => [x.checkId, x.n]));
      return rows.map((r) => ({ ...r, results: results.filter((x) => x.checkId === r.check.id), skipped: skipBy[r.check.id] ?? 0 }));
    },

    async verdictCounts() {
      const db = await getDb();
      const rows = await db
        .select({ repoId: s.prChecks.repoId, pr: s.prChecks.prNumber, v: s.prChecks.verdict })
        .from(s.prChecks)
        .where(eq(s.prChecks.workspaceId, workspaceId))
        .orderBy(desc(s.prChecks.createdAt));
      const seen = new Set<string>();
      const out: Record<string, number> = { all: 0 };
      for (const r of rows) {
        if (seen.has(`${r.repoId}#${r.pr}`)) continue;
        seen.add(`${r.repoId}#${r.pr}`);
        const k = r.v ?? "running";
        out[k] = (out[k] ?? 0) + 1;
        out.all += 1;
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
        .innerJoin(s.users, eq(s.users.id, s.overrides.userId))
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

    async tokens() {
      const db = await getDb();
      return db.select().from(s.apiTokens).where(eq(s.apiTokens.workspaceId, workspaceId)).orderBy(desc(s.apiTokens.createdAt));
    },

    async usage() {
      const db = await getDb();
      const [u] = await db.select().from(s.usage).where(and(eq(s.usage.workspaceId, workspaceId), eq(s.usage.month, month())));
      return { sandboxCpuMs: u?.sandboxCpuMs ?? 0, drafts: u?.drafts ?? 0, allowanceMs: SANDBOX_ALLOWANCE_MS };
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

    async navCounts() {
      const counts = await api.statusCounts();
      const verdicts = await api.verdictCounts();
      const db = await getDb();
      const [{ n }] = await db.select({ n: count() }).from(s.memoryTests).where(eq(s.memoryTests.workspaceId, workspaceId));
      return { open: (counts.awaiting_fix ?? 0) + (counts.unproven ?? 0), memory: n, recur: verdicts.recur ?? 0 };
    },
  };
  return api;
}
export type Scoped = ReturnType<typeof scoped>;
