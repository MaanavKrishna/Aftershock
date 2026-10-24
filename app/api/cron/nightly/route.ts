import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

function authorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Vercel Cron calls this daily with Authorization: Bearer $CRON_SECRET; it only starts the durable daily workflow. */
export async function GET(req: NextRequest) {
  if (!authorized(req.headers.get("authorization"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const day = new Date().toISOString().slice(0, 10);
  const { startDaily } = await import("@/lib/workflows/start");
  await startDaily(day);
  return NextResponse.json({ started: "daily", day });
}
