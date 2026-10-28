import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import pkg from "@/package.json";

/** For uptime monitors: is the app up, and can it reach its database? No details beyond that. */
export async function GET() {
  const started = Date.now();
  let db = { ok: false, ms: 0 };
  try {
    await (await getDb()).execute(sql`select 1`);
    db = { ok: true, ms: Date.now() - started };
  } catch {
    db = { ok: false, ms: Date.now() - started };
  }
  return NextResponse.json({ ok: db.ok, version: pkg.version, db }, { status: db.ok ? 200 : 503, headers: { "cache-control": "no-store" } });
}
