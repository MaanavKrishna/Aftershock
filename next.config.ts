import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

/** Security headers for every response. Scripts are limited to this origin (plus Next's inline bootstrap). */
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"),
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://avatars.githubusercontent.com",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self' https://github.com",
      "object-src 'none'",
    ].join("; "),
  },
];

const config: NextConfig = {
  agentRules: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*", "./docs/**/*.md", "./CHANGELOG.md"] },
};

// Durable workflows are compiled for production builds and Vercel. In `next dev` they run
// in-process (lib/workflows/start.ts), so the plugin's generated routes would only cause reloads.
const durable = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL) || process.env.AFTERSHOCK_WORKFLOWS === "durable";

export default durable ? withWorkflow(config) : config;
