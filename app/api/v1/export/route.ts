import { limited } from "@/lib/http/rateLimit";
import { NextResponse, type NextRequest } from "next/server";
import { apiWorkspace, unauthorized } from "@/lib/auth/api";
import { scoped } from "@/lib/db/queries/scope";

/** Everything a workspace owns, as one JSON file. */
export async function GET(req: NextRequest) {
  const tooMany = limited(req, "api");
  if (tooMany) return tooMany;
  const ws = await apiWorkspace(req);
  if (!ws) return unauthorized();
  const sc = scoped(ws);
  const incidents = await sc.listIncidents({});
  const data = {
    exportedAt: new Date().toISOString(),
    workspace: await sc.workspace(),
    repositories: await sc.repos(),
    incidents: await Promise.all(incidents.map(async (i) => ({ ...i, runs: await sc.runs(i.id), notes: (await sc.notes(i.id)).map((n) => n.note) }))),
    memory: (await sc.memory()).map((m) => m.test),
    checks: await sc.checks(),
  };
  return new NextResponse(JSON.stringify(data, null, 2), { headers: { "content-type": "application/json", "content-disposition": 'attachment; filename="aftershock-export.json"' } });
}
