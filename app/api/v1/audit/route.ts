import { limited } from "@/lib/http/rateLimit";
import { NextResponse, type NextRequest } from "next/server";
import { apiAdminWorkspace } from "@/lib/auth/api";
import { scoped } from "@/lib/db/queries/scope";

/** The workspace's audit log as a download: `?format=csv` (default) or `?format=json`. Owners, admins and write tokens only. */
export async function GET(req: NextRequest) {
  const tooMany = limited(req, "api");
  if (tooMany) return tooMany;
  const who = await apiAdminWorkspace(req);
  if (who instanceof NextResponse) return who;
  const format = req.nextUrl.searchParams.get("format") ?? "csv";
  if (format !== "csv" && format !== "json") return NextResponse.json({ error: "format must be csv or json" }, { status: 400 });
  const body = await scoped(who.workspaceId).auditExport(format);
  const { audit } = await import("@/lib/data/lifecycle");
  await audit(who.workspaceId, who.userId, "audit.exported", format);
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    headers: {
      "content-type": format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="aftershock-audit-${day}.${format}"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
