import { NextResponse, type NextRequest } from "next/server";
import { absolute } from "@/lib/http";
import { SESSION_COOKIE } from "@/lib/auth/token";

// Optimistic check only: pages verify the session themselves via requireSession().
export function proxy(req: NextRequest) {
  if (!req.cookies.get(SESSION_COOKIE)) return NextResponse.redirect(absolute(req, "/signin"));
  return NextResponse.next();
}

export const config = {
  matcher: ["/overview/:path*", "/incidents/:path*", "/memory/:path*", "/pulls/:path*", "/repositories/:path*", "/integrations/:path*", "/settings/:path*", "/onboarding/:path*"],
};
