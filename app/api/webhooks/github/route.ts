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
  const l = log.with({ requestId: requestId(req.headers), event, delivery: req.headers.get("x-github-delivery") ?? undefined });
  try {
    const { note } = await handleGithubEvent(event, JSON.parse(body));
    l.info("github webhook handled", { note });
    return NextResponse.json({ ok: true, note });
  } catch (err) {
    l.error("github webhook failed", { err });
    return NextResponse.json({ error: "Webhook handling failed" }, { status: 500 });
  }
}
