import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { hashToken } from "@/lib/crypto";
import { SESSION_COOKIE, verifySession } from "./token";

export type ApiScope = "read" | "write";

/** Bearer workspace token, or the browser session (full access). Null when neither is valid. */
export async function apiAuth(req: NextRequest): Promise<{ workspaceId: string; scope: ApiScope; tokenId?: string } | null> {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (!token.startsWith("as_live_")) return null;
    const db = await getDb();
    const [row] = await db.select().from(s.apiTokens).where(eq(s.apiTokens.hash, hashToken(token)));
    if (!row) return null;
    await db.update(s.apiTokens).set({ lastUsedAt: new Date() }).where(eq(s.apiTokens.id, row.id));
    return { workspaceId: row.workspaceId, scope: row.scope, tokenId: row.id };
  }
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  return session ? { workspaceId: session.workspaceId, scope: "write" } : null;
}

/** For read endpoints: the caller's workspace, or null. */
export async function apiWorkspace(req: NextRequest): Promise<string | null> {
  return (await apiAuth(req))?.workspaceId ?? null;
}

/** For endpoints that change something: the workspace, or a 401/403 response to return. */
export async function apiWriteWorkspace(req: NextRequest): Promise<string | NextResponse> {
  const a = await apiAuth(req);
  if (!a) return unauthorized();
  if (a.scope !== "write") return forbidden();
  return a.workspaceId;
}

export const forbidden = () => NextResponse.json({ error: "This token is read-only. Create a token with write access in Settings → API tokens." }, { status: 403 });
export const unauthorized = () => NextResponse.json({ error: "Missing or invalid token. Create one in Settings → API tokens." }, { status: 401 });
