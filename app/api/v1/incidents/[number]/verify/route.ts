import { limited } from "@/lib/http/rateLimit";
import { NextResponse, type NextRequest } from "next/server";
import { apiWriteWorkspace } from "@/lib/auth/api";
import { scoped } from "@/lib/db/queries/scope";
import { startTimeTravel } from "@/lib/workflows/start";

export async function POST(req: NextRequest, { params }: { params: Promise<{ number: string }> }) {
  const tooMany = limited(req, "api");
  if (tooMany) return tooMany;
  const ws = await apiWriteWorkspace(req);
  if (typeof ws !== "string") return ws;
  const { number } = await params;
  const inc = await scoped(ws).getIncident(Number(number));
  if (!inc) return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  if (!inc.fixSha && !inc.fixPr) return NextResponse.json({ error: "Link the fix commit or PR first" }, { status: 409 });
  if (inc.status === "traveling") return NextResponse.json({ error: "Time travel is already running" }, { status: 409 });
  await startTimeTravel(inc.id);
  return NextResponse.json({ status: "traveling", url: `${process.env.APP_URL ?? ""}/incidents/${inc.number}/travel` }, { status: 202 });
}
