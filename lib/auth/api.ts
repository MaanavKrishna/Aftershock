import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { hashToken } from "@/lib/crypto";
import { SESSION_COOKIE, verifySession } from "./token";

/** Bearer workspace token, or the browser session. Returns the workspace or null. */
export async function apiWorkspace(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (!token.startsWith("as_live_")) return null;
    const db = await getDb();
    const [row] = await db.select().from(s.apiTokens).where(eq(s.apiTokens.hash, hashToken(token)));
    if (!row) return null;
    await db.update(s.apiTokens).set({ lastUsedAt: new Date() }).where(eq(s.apiTokens.id, row.id));
    return row.workspaceId;
  }
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  return session?.workspaceId ?? null;
}

export const unauthorized = () => NextResponse.json({ error: "Missing or invalid token. Create one in Settings → API tokens." }, { status: 401 });
