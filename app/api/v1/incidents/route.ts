import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiWorkspace, unauthorized } from "@/lib/auth/api";
import { scoped } from "@/lib/db/queries/scope";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { incidentKey } from "@/lib/domain/ids";

export async function GET(req: NextRequest) {
  const ws = await apiWorkspace(req);
  if (!ws) return unauthorized();
  const sc = scoped(ws);
  const w = await sc.workspace();
  const rows = await sc.listIncidents({});
  return NextResponse.json({
    incidents: rows.map((i) => ({ key: incidentKey(w!.incidentPrefix, i.number), number: i.number, title: i.title, status: i.status, source: i.source, fixSha: i.fixSha, parentSha: i.parentSha, createdAt: i.createdAt })),
  });
}

const body = z.object({
  title: z.string().trim().min(3).max(200),
  repository: z.string().min(1),
  trigger: z.string().max(4000).default(""),
  observed: z.string().max(4000).default(""),
  expected: z.string().max(4000).default(""),
  fix: z.string().regex(/^[0-9a-f]{7,40}$/i).optional(),
});

export async function POST(req: NextRequest) {
  const ws = await apiWorkspace(req);
  if (!ws) return unauthorized();
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 });
  const sc = scoped(ws);
  const repo = (await sc.repos()).find((r) => r.name === parsed.data.repository || r.fullName === parsed.data.repository);
  if (!repo) return NextResponse.json({ error: "Unknown repository" }, { status: 404 });
  const db = await getDb();
  const [inc] = await db
    .insert(s.incidents)
    .values({ workspaceId: ws, repoId: repo.id, number: await sc.nextIncidentNumber(), title: parsed.data.title, trigger: parsed.data.trigger, observed: parsed.data.observed, expected: parsed.data.expected, fixSha: parsed.data.fix ?? null, source: "form", status: "awaiting_fix" })
    .returning();
  const w = await sc.workspace();
  return NextResponse.json({ key: incidentKey(w!.incidentPrefix, inc.number), number: inc.number, status: inc.status }, { status: 201 });
}
