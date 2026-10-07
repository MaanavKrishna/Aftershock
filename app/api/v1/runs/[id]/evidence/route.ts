import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { apiWorkspace, unauthorized } from "@/lib/auth/api";
import { scoped } from "@/lib/db/queries/scope";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ws = await apiWorkspace(req);
  if (!ws) return unauthorized();
  const { id } = await params;
  const db = await getDb();
  const [run] = await db.select().from(s.timeTravelRuns).where(eq(s.timeTravelRuns.id, id));
  const inc = run ? await scoped(ws).getIncidentById(run.incidentId) : null;
  if (!run || !inc) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  const evidence = {
    incident: { number: inc.number, title: inc.title, fixSha: inc.fixSha, parentSha: inc.parentSha },
    attempt: run.attempt, status: run.status, reason: run.reason,
    test: { path: run.testPath, code: run.testCode, model: run.model },
    beforeTheFix: { sha: inc.parentSha, results: run.beforeResults },
    onTheFix: { sha: inc.fixSha, results: run.fixResults },
    runner: run.runner, cpuMs: run.cpuMs, wallMs: run.wallMs, log: run.log, startedAt: run.createdAt, finishedAt: run.finishedAt,
  };
  return new NextResponse(JSON.stringify(evidence, null, 2), { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="evidence-inc-${inc.number}-attempt-${run.attempt}.json"` } });
}
