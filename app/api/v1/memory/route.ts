import { NextResponse, type NextRequest } from "next/server";
import { apiWorkspace, unauthorized } from "@/lib/auth/api";
import { scoped } from "@/lib/db/queries/scope";

export async function GET(req: NextRequest) {
  const ws = await apiWorkspace(req);
  if (!ws) return unauthorized();
  const rows = await scoped(ws).memory();
  return NextResponse.json({ tests: rows.map((r) => ({ incident: r.incident.number, title: r.incident.title, repository: r.repo.fullName, path: r.test.path, health: r.test.health, guarded: r.guarded, blocked: r.blocked, provenAt: r.test.provenAt })) });
}
