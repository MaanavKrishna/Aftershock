import { NextResponse, type NextRequest } from "next/server";
import { limited } from "@/lib/http/rateLimit";
import { apiAuth } from "@/lib/auth/api";
import { scoped } from "@/lib/db/queries/scope";
import { flagEnabled } from "@/lib/flags";
import { handleMessage } from "@/lib/mcp/server";

const MAX_BODY = 64 * 1024;

/** MCP over Streamable HTTP, stateless: each POST is one JSON-RPC message answered with JSON. */
export async function POST(req: NextRequest) {
  const tooMany = limited(req, "api");
  if (tooMany) return tooMany;
  const auth = await apiAuth(req);
  if (!auth) return NextResponse.json({ error: "Missing or invalid token. Create one in Settings → API tokens." }, { status: 401, headers: { "www-authenticate": 'Bearer realm="aftershock"' } });
  const ws = await scoped(auth.workspaceId).workspace();
  if (!flagEnabled("mcp", ws?.settings)) return NextResponse.json({ error: "The MCP server is in Labs. Turn it on in Settings → Labs." }, { status: 403 });
  const body = await req.text();
  if (Buffer.byteLength(body) > MAX_BODY) return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Request too large" } }, { status: 413 });
  let msg: unknown;
  try {
    msg = JSON.parse(body);
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }
  const reply = await handleMessage(msg, { workspaceId: auth.workspaceId, scope: auth.scope });
  if (!reply) return new NextResponse(null, { status: 202 });
  return NextResponse.json(reply);
}

/** No server-initiated stream: clients only POST. */
export function GET() {
  return new NextResponse(null, { status: 405, headers: { allow: "POST" } });
}

export function DELETE() {
  return new NextResponse(null, { status: 405, headers: { allow: "POST" } });
}
