import { NextResponse, type NextRequest } from "next/server";
import { absolute } from "@/lib/http/url";
import { SESSION_COOKIE } from "@/lib/auth/token";
import { THEME_SCRIPT_HASH } from "@/lib/theme";

/**
 * The strict policy for signed-in pages: scripts run only with this request's nonce (Next.js adds it to its
 * own scripts) or as the one hashed theme script. Injected inline scripts are refused.
 */
export function appCsp(nonce: string, dev = process.env.NODE_ENV !== "production"): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${THEME_SCRIPT_HASH}${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://avatars.githubusercontent.com",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self' https://github.com",
    "object-src 'none'",
  ].join("; ");
}

// Optimistic check only: pages verify the session themselves (lib/auth/scope.ts).
export function proxy(req: NextRequest) {
  if (!req.cookies.get(SESSION_COOKIE)) return NextResponse.redirect(absolute(req, "/signin"));
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = appCsp(nonce);
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("content-security-policy", csp);
  return res;
}

export const config = {
  matcher: ["/overview/:path*", "/incidents/:path*", "/memory/:path*", "/pulls/:path*", "/insights/:path*", "/repositories/:path*", "/integrations/:path*", "/settings/:path*", "/onboarding/:path*"],
};
