import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { nightly } from "@/lib/workflows/nightly";

/** Vercel Cron calls this with Authorization: Bearer $CRON_SECRET. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDb();
  const tests = await db.select({ id: s.memoryTests.id }).from(s.memoryTests);
  const { startNightly } = await import("@/lib/workflows/start");
  for (const t of tests) await startNightly(t.id);
  return NextResponse.json({ queued: tests.length, workflow: nightly.name });
}
