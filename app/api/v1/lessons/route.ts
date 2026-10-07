import { NextResponse, type NextRequest } from "next/server";
import { apiWorkspace, unauthorized } from "@/lib/auth/api";
import { scoped } from "@/lib/db/queries/scope";
import { renderLessons } from "@/lib/domain/lessons";
import { incidentKey } from "@/lib/domain/ids";

export async function GET(req: NextRequest) {
  const ws = await apiWorkspace(req);
  if (!ws) return unauthorized();
  const sc = scoped(ws);
  const w = await sc.workspace();
  const rows = await sc.memory();
  const md = renderLessons(rows.map((r) => ({ key: incidentKey(w!.incidentPrefix, r.incident.number), title: r.incident.title, files: r.incident.watchedFiles, expected: r.incident.expected, testPath: r.test.path })));
  return new NextResponse(md, { headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": 'attachment; filename="LESSONS.md"' } });
}
