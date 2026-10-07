import { NextResponse, type NextRequest } from "next/server";

type Bucket = { count: number; resetAt: number };
export type Limit = { ok: true } | { ok: false; retryAfterSeconds: number };

/**
 * Fixed-window limiter, per process. On Vercel each instance keeps its own window, so this is a
 * first line of defence; pair it with Vercel Firewall rate-limit rules for a global limit.
 */
export function createLimiter(opts: { limit: number; windowMs: number; now?: () => number }) {
  const buckets = new Map<string, Bucket>();
  const now = opts.now ?? Date.now;
  return (key: string): Limit => {
    const t = now();
    let b = buckets.get(key);
    if (!b || t >= b.resetAt) {
      b = { count: 0, resetAt: t + opts.windowMs };
      buckets.set(key, b);
      if (buckets.size > 10_000) for (const [k, v] of buckets) if (t >= v.resetAt) buckets.delete(k);
    }
    b.count++;
    return b.count <= opts.limit ? { ok: true } : { ok: false, retryAfterSeconds: Math.ceil((b.resetAt - t) / 1000) };
  };
}

const webhooks = createLimiter({ limit: 300, windowMs: 60_000 });
const api = createLimiter({ limit: 120, windowMs: 60_000 });

function clientKey(req: NextRequest): string {
  const auth = req.headers.get("authorization");
  if (auth) return `t:${auth.slice(-16)}`;
  return `ip:${req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? req.headers.get("x-real-ip") ?? "local"}`;
}

/** Returns a 429 response when the caller is over its limit, otherwise null. */
export function limited(req: NextRequest, kind: "webhook" | "api"): NextResponse | null {
  const r = (kind === "webhook" ? webhooks : api)(`${kind}:${req.nextUrl.pathname.split("/").slice(0, 4).join("/")}:${clientKey(req)}`);
  return r.ok ? null : NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "retry-after": String(r.retryAfterSeconds) } });
}
