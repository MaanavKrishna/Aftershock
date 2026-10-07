// Vercel build: apply migrations (and, outside demo mode, remove demo data), then build.
import { execSync } from "node:child_process";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });
if (process.env.DATABASE_URL) {
  run("node --experimental-strip-types scripts/migrate.mts");
  if (process.env.AFTERSHOCK_DEMO !== "1") run("node --experimental-strip-types scripts/remove-demo-data.mts");
} else {
  console.warn("DATABASE_URL is not set: skipping migrations. Add a Neon database before using the app.");
}
run("next build");
