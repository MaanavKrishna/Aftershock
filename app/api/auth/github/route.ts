import { NextResponse, type NextRequest } from "next/server";
import { authorizeUrl, STATE_COOKIE } from "@/lib/auth/github-oauth";

export async function GET(req: NextRequest) {
  if (!process.env.AUTH_GITHUB_ID) {
    return NextResponse.redirect(new URL("/signin?error=github_not_configured", req.url));
  }
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(authorizeUrl(state, req.nextUrl.origin));
  res.cookies.set(STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
  return res;
}
