import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const config: NextConfig = {
  agentRules: false,
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*"] },
};

export default withWorkflow(config);
