import { limited } from "@/lib/http/rateLimit";
import { NextResponse, type NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { apiWorkspace, unauthorized } from "@/lib/auth/api";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { incidentKey } from "@/lib/domain/ids";
import { finalizeCheck } from "@/lib/workflows/prCheck";

const run = z.object({ outcome: z.enum(["passed", "failed", "error"]), durationMs: z.number().nonnegative(), message: z.string().max(2000).optional() });
const body = z.object({
  repository: z.string().min(3),
  pr: z.number().int().positive(),
  head: z.string().regex(/^[0-9a-f]{7,40}$/i),
  results: z.array(z.object({ path: z.string().max(300), runs: z.array(run).max(10) })).max(200),
});

/** Results from a team's own GitHub Actions runner (`aftershock check --in-place --report`). */
export async function POST(req: NextRequest) {
  const tooMany = limited(req, "api");
  if (tooMany) return tooMany;
  const ws = await apiWorkspace(req);
  if (!ws) return unauthorized();
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 });
  const d = parsed.data;
  const db = await getDb();
  const [repo] = await db.select().from(s.repositories).where(and(eq(s.repositories.workspaceId, ws), eq(s.repositories.fullName, d.repository)));
  if (!repo) return NextResponse.json({ error: "Unknown repository" }, { status: 404 });
  const [w] = await db.select().from(s.workspaces).where(eq(s.workspaces.id, ws));
  let [check] = await db.select().from(s.prChecks).where(and(eq(s.prChecks.repoId, repo.id), eq(s.prChecks.prNumber, d.pr))).orderBy(desc(s.prChecks.createdAt)).limit(1);
  if (!check || check.status === "done" || !check.headSha.startsWith(d.head.slice(0, 7))) {
    [check] = await db.insert(s.prChecks).values({ workspaceId: ws, repoId: repo.id, prNumber: d.pr, title: check?.title ?? `PR #${d.pr}`, headSha: d.head, baseSha: check?.baseSha ?? "", changedFiles: check?.changedFiles ?? [], status: "running", runner: "actions", checkRunId: check?.checkRunId ?? null, commentId: check?.commentId ?? null }).returning();
  }
  const tests = await db.select({ t: s.memoryTests, i: s.incidents }).from(s.memoryTests).innerJoin(s.incidents, eq(s.incidents.id, s.memoryTests.incidentId)).where(eq(s.memoryTests.repoId, repo.id));
  const byPath = new Map(tests.map((x) => [x.t.path, x]));
  const results = d.results.flatMap((r) => {
    const x = byPath.get(r.path);
    if (!x) return [];
    const touched = check.changedFiles.find((f) => x.i.watchedFiles.includes(f));
    return [{ selected: { memoryTestId: x.t.id, incidentId: x.i.id, key: incidentKey(w.incidentPrefix, x.i.number), title: x.i.title, path: x.t.path, code: x.t.code, selectedBy: "files" as const, why: touched ? `Touches ${touched}` : "Run on your GitHub Actions runner" }, runs: r.runs }];
  });
  const reported = new Set(results.map((r) => r.selected.memoryTestId));
  const skips = tests.filter((x) => !reported.has(x.t.id)).map((x) => ({ incidentId: x.i.id, reason: "Not part of this run" }));
  await finalizeCheck(check.id, results, skips, "actions", 0);
  const [after] = await db.select().from(s.prChecks).where(eq(s.prChecks.id, check.id));
  return NextResponse.json({ verdict: after.verdict, check: after.id });
}
