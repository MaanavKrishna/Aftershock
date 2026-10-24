import { createHash } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { incidentKey } from "@/lib/domain/ids";

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);
const results = (rs: { outcome: string; durationMs: number; message?: string }[]) => ({ outcomes: rs.map((r) => r.outcome), durationsMs: rs.map((r) => r.durationMs), firstFailure: rs.find((r) => r.outcome !== "passed")?.message?.slice(0, 500) ?? null });

export type EvidencePayload = Awaited<ReturnType<typeof buildEvidence>>;

/**
 * Everything an auditor needs to check that an incident fed back into a control: what happened, the fix,
 * every proof attempt with the commits and outcomes, the test as admitted (by hash), its health and
 * re-proofs, and each pull request it guarded, including overrides. Scoped to one workspace.
 */
export async function buildEvidence(workspaceId: string, number: number) {
  const db = await getDb();
  const [inc] = await db.select().from(s.incidents).where(and(eq(s.incidents.workspaceId, workspaceId), eq(s.incidents.number, number)));
  if (!inc) return null;
  const [ws] = await db.select().from(s.workspaces).where(eq(s.workspaces.id, workspaceId));
  const [repo] = inc.repoId ? await db.select().from(s.repositories).where(eq(s.repositories.id, inc.repoId)) : [];
  const runs = await db.select().from(s.timeTravelRuns).where(eq(s.timeTravelRuns.incidentId, inc.id)).orderBy(asc(s.timeTravelRuns.attempt));
  const mems = await db.select().from(s.memoryTests).where(eq(s.memoryTests.incidentId, inc.id));
  const guarded = mems.length
    ? await db.select({ r: s.prCheckResults, c: s.prChecks }).from(s.prCheckResults).innerJoin(s.prChecks, eq(s.prChecks.id, s.prCheckResults.checkId)).where(inArray(s.prCheckResults.memoryTestId, mems.map((m) => m.id))).orderBy(asc(s.prChecks.createdAt))
    : [];
  const overrides = guarded.length ? await db.select().from(s.overrides).where(inArray(s.overrides.checkId, guarded.map((g) => g.c.id))) : [];
  const key = incidentKey(ws.incidentPrefix, inc.number);
  return {
    schema: "aftershock.evidence/v1" as const,
    issuedAt: new Date().toISOString(),
    issuer: (process.env.APP_URL ?? "http://127.0.0.1:3000").replace(/\/$/, ""),
    workspace: ws.login,
    repository: repo?.fullName ?? null,
    incident: { key, title: inc.title, severity: inc.severity, source: inc.source, sourceRef: inc.sourceRef, status: inc.status, statusReason: inc.statusReason, trigger: inc.trigger, observed: inc.observed, expected: inc.expected, openedAt: iso(inc.createdAt) },
    fix: { sha: inc.fixSha, parentSha: inc.parentSha, pr: inc.fixPr, title: inc.fixTitle },
    proof: runs.map((r) => ({
      attempt: r.attempt, status: r.status, reason: r.reason, runner: r.runner, model: r.model,
      testPath: r.testPath, testSha256: r.testCode ? sha256(r.testCode) : null,
      beforeTheFix: { sha: inc.parentSha, ...results(r.beforeResults) },
      onTheFix: { sha: inc.fixSha, ...results(r.fixResults) },
      logSha256: r.log ? sha256(r.log) : null, logRetained: Boolean(r.log),
      startedAt: iso(r.createdAt), finishedAt: iso(r.finishedAt),
    })),
    memoryTests: mems.map((mem) => ({ path: mem.path, codeSha256: sha256(mem.code), provenAt: iso(mem.provenAt), health: mem.health, recentNights: mem.nights, quarantined: mem.quarantined, guardStatus: mem.guardStatus, guardCheckedAt: iso(mem.guardCheckedAt), guardSha: mem.guardSha })),
    guard: guarded.map(({ r, c }) => {
      const o = overrides.find((x) => x.checkId === c.id);
      return { test: mems.find((m) => m.id === r.memoryTestId)?.path ?? null, prNumber: c.prNumber, mergeQueue: Boolean(c.mergeGroupRef), headSha: c.headSha, testedSha: c.testedSha ?? c.headSha, verdict: r.verdict, outcomes: r.runs.map((x) => x.outcome), at: iso(c.createdAt), overridden: c.overridden, overrideReason: o?.reason ?? null, overriddenAt: iso(o?.createdAt) };
    }),
    epicenter: inc.epicenter ?? null,
  };
}
