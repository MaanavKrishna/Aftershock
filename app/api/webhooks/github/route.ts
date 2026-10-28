import { blockedForRejections, recordRejection } from "@/lib/http/rateLimit";
import { NextResponse, type NextRequest } from "next/server";
import { verifyGithubSignature } from "@/lib/github/signature";
import { handleGithubEvent } from "@/lib/github/webhook";
import { log, requestId } from "@/lib/obs/log";

const MAX_BODY = 25 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const blocked = blockedForRejections(req);
  if (blocked) return blocked;
  // GitHub caps payloads at 25 MB; anything larger is not from GitHub.
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const body = await req.text();
  if (Buffer.byteLength(body) > MAX_BODY) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  if (!verifyGithubSignature(body, req.headers.get("x-hub-signature-256"), process.env.GITHUB_WEBHOOK_SECRET ?? "")) {
    recordRejection(req);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  const event = req.headers.get("x-github-event") ?? "";
  // GitHub redelivers on timeouts and on request; the delivery id makes handling idempotent.
  const delivery = req.headers.get("x-github-delivery");
  if (delivery && /^[\w-]{8,64}$/.test(delivery)) {
    const { getDb } = await import("@/lib/db/client");
    const s = await import("@/lib/db/schema");
    const fresh = await (await getDb()).insert(s.webhookDeliveries).values({ id: delivery }).onConflictDoNothing().returning({ id: s.webhookDeliveries.id });
    if (!fresh.length) return NextResponse.json({ ok: true, note: "duplicate delivery" });
  }
  const l = log.with({ requestId: requestId(req.headers), event, delivery: req.headers.get("x-github-delivery") ?? undefined });
  try {
    const { note } = await handleGithubEvent(event, JSON.parse(body));
    l.info("github webhook handled", { note });
    return NextResponse.json({ ok: true, note });
  } catch (err) {
    l.error("github webhook failed", { err });
    // Let GitHub's redelivery try again.
    if (delivery) {
      const { getDb } = await import("@/lib/db/client");
      const s = await import("@/lib/db/schema");
      const { eq } = await import("drizzle-orm");
      await (await getDb()).delete(s.webhookDeliveries).where(eq(s.webhookDeliveries.id, delivery)).catch(() => undefined);
    }
    return NextResponse.json({ error: "Webhook handling failed" }, { status: 500 });
  }
}
