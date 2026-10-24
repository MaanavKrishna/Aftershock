import { NextResponse, type NextRequest } from "next/server";
import { limited } from "@/lib/http/rateLimit";
import { apiWorkspace, unauthorized } from "@/lib/auth/api";
import { buildEvidence } from "@/lib/evidence/bundle";
import { signBundle } from "@/lib/evidence/sign";

/** Signed evidence bundle for one incident. Verify with /.well-known/aftershock-jwks.json (see docs/evidence.md). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ number: string }> }) {
  const tooMany = limited(req, "api");
  if (tooMany) return tooMany;
  const ws = await apiWorkspace(req);
  if (!ws) return unauthorized();
  const { number } = await params;
  const n = /^\d{1,9}$/.test(number) ? Number(number) : NaN;
  const payload = Number.isFinite(n) ? await buildEvidence(ws, n) : null;
  if (!payload) return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  const bundle = signBundle(payload);
  return new NextResponse(JSON.stringify(bundle, null, 2), {
    headers: { "content-type": "application/json", "cache-control": "no-store", "content-disposition": `attachment; filename="aftershock-evidence-${payload.incident.key}.json"` },
  });
}
