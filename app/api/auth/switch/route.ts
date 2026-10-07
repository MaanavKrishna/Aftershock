import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { readSession, sessionCookie } from "@/lib/auth/session";
import { absolute } from "@/lib/http/url";

/** Switch the session to another workspace the user is a member of. */
export async function POST(req: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.redirect(absolute(req, "/signin"), 303);
  const target = String((await req.formData()).get("workspaceId") ?? "");
  const db = await getDb();
  const [m] = await db.select().from(s.memberships).where(and(eq(s.memberships.userId, session.userId), eq(s.memberships.workspaceId, target)));
  if (!m) return NextResponse.json({ error: "You are not a member of that workspace." }, { status: 403 });
  const res = NextResponse.redirect(absolute(req, "/overview"), 303);
  res.cookies.set(await sessionCookie({ userId: session.userId, workspaceId: target }));
  return res;
}
