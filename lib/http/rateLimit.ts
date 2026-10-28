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
  const hit = (key: string): Limit => {
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
  /** Like hit, without counting: is this key already over the limit? */
  const peek = (key: string): Limit => {
    const t = now();
    const b = buckets.get(key);
    return !b || t >= b.resetAt || b.count < opts.limit ? { ok: true } : { ok: false, retryAfterSeconds: Math.ceil((b.resetAt - t) / 1000) };
  };
  return Object.assign(hit, { peek });
}

const webhooks = createLimiter({ limit: 300, windowMs: 60_000 });
const api = createLimiter({ limit: 120, windowMs: 60_000 });

const ipOf = (req: NextRequest) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? req.headers.get("x-real-ip") ?? "local";

/** API callers are limited per token. Webhooks are limited per address: their Authorization header is caller-chosen. */
function clientKey(req: NextRequest, kind: "webhook" | "api"): string {
  const auth = req.headers.get("authorization");
  if (auth && kind === "api") return `t:${auth.slice(-16)}`;
  return `ip:${ipOf(req)}`;
}

const tooMany = (r: Limit) => (r.ok ? null : NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "retry-after": String(r.retryAfterSeconds) } }));

/**
 * Webhook senders (GitHub, Sentry, PagerDuty...) deliver for every customer from shared addresses, so
 * valid deliveries are never limited by address. Only failed attempts (bad signature, unknown workspace)
 * count against the sender's address; valid alerts are limited per workspace instead.
 */
const rejections = createLimiter({ limit: 20, windowMs: 60_000 });
const perWorkspace = createLimiter({ limit: 300, windowMs: 60_000 });
export function blockedForRejections(req: NextRequest): NextResponse | null {
  return tooMany(rejections.peek(`rej:${ipOf(req)}`));
}
export function recordRejection(req: NextRequest): void {
  rejections(`rej:${ipOf(req)}`);
}
export function limitedWorkspace(key: string): NextResponse | null {
  return tooMany(perWorkspace(key));
}

/** Returns a 429 response when the caller is over its limit, otherwise null. */
export function limited(req: NextRequest, kind: "webhook" | "api"): NextResponse | null {
  const r = (kind === "webhook" ? webhooks : api)(`${kind}:${req.nextUrl.pathname.split("/").slice(0, 4).join("/")}:${clientKey(req, kind)}`);
  return r.ok ? null : NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "retry-after": String(r.retryAfterSeconds) } });
}
