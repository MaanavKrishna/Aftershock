import { NextResponse, type NextRequest } from "next/server";
import { absolute } from "@/lib/http/url";
import { authorizeUrl, STATE_COOKIE } from "@/lib/auth/github-oauth";

export async function GET(req: NextRequest) {
  if (!process.env.AUTH_GITHUB_ID) {
    return NextResponse.redirect(absolute(req, "/signin?error=github_not_configured"));
  }
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(authorizeUrl(state, absolute(req, "/").origin));
  res.cookies.set(STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
  return res;
}
