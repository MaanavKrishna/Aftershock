import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const config: NextConfig = {
  agentRules: false,
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*"] },
};

// Durable workflows are compiled for production builds and Vercel. In `next dev` they run
// in-process (lib/workflows/start.ts), so the plugin's generated routes would only cause reloads.
const durable = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL) || process.env.AFTERSHOCK_WORKFLOWS === "durable";

export default durable ? withWorkflow(config) : config;
