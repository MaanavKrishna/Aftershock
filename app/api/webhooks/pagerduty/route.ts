import { limited } from "@/lib/http/rateLimit";
import { NextResponse, type NextRequest } from "next/server";
import { verifyPagerDuty } from "@/lib/integrations/signatures";
import { integrationFor, intakeAlert, logDelivery, parseMapping } from "@/lib/integrations/intake";

const ACCEPTED = new Set(["incident.resolved", "incident.triggered"]);

export async function POST(req: NextRequest) {
  const tooMany = limited(req, "webhook");
  if (tooMany) return tooMany;
  const login = req.nextUrl.searchParams.get("workspace") ?? "";
  const body = await req.text();
  const found = await integrationFor(login, "pagerduty");
  if (!found) return NextResponse.json({ error: "Unknown workspace" }, { status: 404 });
  if (!verifyPagerDuty(body, req.headers.get("x-pagerduty-signature"), found.secret)) {
    await logDelivery(found.ws.id, "pagerduty", "rejected delivery", "invalid or missing signature · 401", false);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  const p = JSON.parse(body) as { event?: { event_type?: string; data?: { id?: string; title?: string; service?: { summary?: string }; html_url?: string } } };
  const e = p.event;
  if (!e?.event_type || !ACCEPTED.has(e.event_type) || !e.data?.id) {
    await logDelivery(found.ws.id, "pagerduty", e?.event_type ?? "unknown", "ignored", true);
    return NextResponse.json({ ok: true, note: "ignored" });
  }
  const r = await intakeAlert(found.ws, "pagerduty", parseMapping(found.integ?.config.services), {
    fingerprint: `pd-${e.data.id}`, title: e.data.title ?? "PagerDuty incident", observed: e.data.title ?? "", target: e.data.service?.summary ?? "", link: e.data.html_url, event: e.event_type,
  });
  await logDelivery(found.ws.id, "pagerduty", `${e.event_type} · ${(e.data.title ?? "").slice(0, 60)}`, r.created ? `→ ${r.key}` : `duplicate of ${r.key}`, true);
  return NextResponse.json({ ok: true, incident: r.key, created: r.created });
}
