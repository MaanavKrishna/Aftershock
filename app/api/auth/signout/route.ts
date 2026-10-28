import { NextResponse, type NextRequest } from "next/server";
import { absolute } from "@/lib/http/url";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/token";

/** Signing out ends the session on the server too, not only in this browser. */
export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session?.sid) await (await import("@/lib/auth/sessions")).revokeSession(session.userId, session.sid);
  const res = NextResponse.redirect(absolute(req, "/"), 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
