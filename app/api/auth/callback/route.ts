import { NextResponse, type NextRequest } from "next/server";
import { absolute } from "@/lib/http/url";
import { exchangeCode, fetchUser, STATE_COOKIE } from "@/lib/auth/github-oauth";
import { upsertGithubAccount } from "@/lib/auth/accounts";
import { sessionCookie } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expected = req.cookies.get(STATE_COOKIE)?.value;
  if (!code || !state || !expected || state !== expected) {
    return NextResponse.json({ error: "Sign-in state did not match. Start again from the sign-in page." }, { status: 400 });
  }
  try {
    const user = await fetchUser(await exchangeCode(code));
    const session = await upsertGithubAccount(user);
    const res = NextResponse.redirect(absolute(req, "/overview"));
    res.cookies.set(await sessionCookie(session));
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch {
    return NextResponse.redirect(absolute(req, "/signin?error=github_failed"));
  }
}
