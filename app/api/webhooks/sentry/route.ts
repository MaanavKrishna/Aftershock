import { NextResponse, type NextRequest } from "next/server";
import { verifySentry } from "@/lib/integrations/signatures";
import { integrationFor, intakeAlert, logDelivery, parseMapping } from "@/lib/integrations/intake";

export async function POST(req: NextRequest) {
  const login = req.nextUrl.searchParams.get("workspace") ?? "";
  const body = await req.text();
  const found = await integrationFor(login, "sentry");
  if (!found) return NextResponse.json({ error: "Unknown workspace" }, { status: 404 });
  if (!verifySentry(body, req.headers.get("sentry-hook-signature"), found.secret)) {
    await logDelivery(found.ws.id, "sentry", "rejected delivery", "invalid or missing signature · 401", false);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  const p = JSON.parse(body) as { action?: string; data?: { issue?: { id?: string; title?: string; culprit?: string; level?: string; project?: { slug?: string }; permalink?: string } } };
  const issue = p.data?.issue;
  if (p.action !== "created" || !issue?.id) {
    await logDelivery(found.ws.id, "sentry", `issue.${p.action ?? "unknown"}`, "ignored", true);
    return NextResponse.json({ ok: true, note: "ignored" });
  }
  const r = await intakeAlert(found.ws, "sentry", parseMapping(found.integ?.config.projects), {
    fingerprint: `sentry-${issue.id}`, title: issue.title ?? "Sentry issue", observed: [issue.title, issue.culprit].filter(Boolean).join(" — "), target: issue.project?.slug ?? "", link: issue.permalink, event: "issue.created",
  });
  await logDelivery(found.ws.id, "sentry", `issue.created · ${(issue.title ?? "").slice(0, 60)}`, r.created ? `→ ${r.key}` : `duplicate of ${r.key}`, true);
  return NextResponse.json({ ok: true, incident: r.key, created: r.created });
}
