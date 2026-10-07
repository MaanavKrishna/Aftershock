import type { NextRequest } from "next/server";

/** Absolute URL on the host the browser actually used (dev servers normalise req.url to localhost). */
export function absolute(req: NextRequest, path: string): URL {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  return new URL(path, `${proto}://${host}`);
}
