import { NextResponse, type NextRequest } from "next/server";
import { blockedForRejections, limitedWorkspace, recordRejection } from "@/lib/http/rateLimit";
import { flagEnabled } from "@/lib/flags";
import { log } from "@/lib/obs/log";
import { integrationFor, intakeAlert, logDelivery, parseMapping } from "./intake";
import { isSource, SOURCES } from "./sources";

/** Larger bodies are refused before they are read into memory or verified. */
export const MAX_BODY_BYTES = 256 * 1024;

const json = (status: number, body: object) => NextResponse.json(body, { status });

/**
 * One path for every inbound source: rejection limit → size cap → workspace and Labs gate → verify → per-workspace limit → parse → open
 * an incident (deduplicated by fingerprint). Unknown sources, unknown workspaces and flagged-off sources all
 * answer the same 404, so the endpoint does not reveal which workspaces or sources exist.
 */
export async function receive(source: string, req: NextRequest, now = Date.now()): Promise<NextResponse> {
  const blocked = blockedForRejections(req);
  if (blocked) return blocked;
  if (!isSource(source)) {
    recordRejection(req);
    return json(404, { error: "Unknown source" });
  }
  const def = SOURCES[source];
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return json(413, { error: "Payload too large" });
  const body = await req.text();
  if (Buffer.byteLength(body) > MAX_BODY_BYTES) return json(413, { error: "Payload too large" });

  const found = await integrationFor(req.nextUrl.searchParams.get("workspace") ?? "", source);
  if (!found || (def.labs && !flagEnabled("intakeExtra", found.ws.settings))) {
    recordRejection(req);
    return json(404, { error: "Unknown workspace" });
  }
  if (!def.verify({ body, headers: req.headers, url: req.nextUrl }, found.secret, now)) {
    recordRejection(req);
    await logDelivery(found.ws.id, source, "rejected delivery", def.auth === "token" ? "invalid or missing token · 401" : "invalid, missing or expired signature · 401", false);
    return json(401, { error: def.auth === "token" ? "Invalid token" : "Invalid signature" });
  }
  const busy = limitedWorkspace(`intake:${found.ws.id}`);
  if (busy) return busy;
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    await logDelivery(found.ws.id, source, "rejected delivery", "body is not JSON · 400", false);
    return json(400, { error: "Body must be JSON" });
  }
  const parsed = def.parse(payload);
  if ("ignored" in parsed) {
    await logDelivery(found.ws.id, source, parsed.ignored.slice(0, 80), "ignored", true);
    return NextResponse.json({ ok: true, note: "ignored" });
  }
  const a = parsed.alert;
  const r = await intakeAlert(found.ws, source, parseMapping(found.integ?.config[def.mapping.key]), a);
  await logDelivery(found.ws.id, source, `${a.event} · ${a.title.slice(0, 60)}`, r.created ? `→ ${r.key}` : `duplicate of ${r.key}`, true);
  log.info("intake.delivery", { source, workspaceId: found.ws.id, incident: r.key, created: r.created });
  return NextResponse.json({ ok: true, incident: r.key, created: r.created });
}
