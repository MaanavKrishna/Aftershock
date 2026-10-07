import { NextResponse, type NextRequest } from "next/server";
import { verifyGithubSignature } from "@/lib/github/signature";
import { handleGithubEvent } from "@/lib/github/webhook";

export async function POST(req: NextRequest) {
  const body = await req.text();
  if (!verifyGithubSignature(body, req.headers.get("x-hub-signature-256"), process.env.GITHUB_WEBHOOK_SECRET ?? "")) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  const event = req.headers.get("x-github-event") ?? "";
  try {
    const { note } = await handleGithubEvent(event, JSON.parse(body));
    return NextResponse.json({ ok: true, note });
  } catch (err) {
    console.error("[aftershock] github webhook failed", err);
    return NextResponse.json({ error: "Webhook handling failed" }, { status: 500 });
  }
}
