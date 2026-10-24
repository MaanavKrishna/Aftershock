// Vercel build: apply migrations (and, outside demo mode, remove demo data), then build.
import { execSync } from "node:child_process";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });
// Only production builds touch the database: a preview of an unfinished change must never migrate production.
const production = !process.env.VERCEL || process.env.VERCEL_ENV === "production";
if (process.env.DATABASE_URL && !production) {
  console.warn(`VERCEL_ENV=${process.env.VERCEL_ENV}: skipping migrations and demo cleanup.`);
} else if (process.env.DATABASE_URL) {
  run("node --experimental-strip-types scripts/migrate.mts");
  if (process.env.AFTERSHOCK_DEMO !== "1") run("node --experimental-strip-types scripts/remove-demo-data.mts");
} else {
  console.warn("DATABASE_URL is not set: skipping migrations. Add a Neon database before using the app.");
}
run("next build");
