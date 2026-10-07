// Vercel build: apply migrations when a database is attached, then build.
import { execSync } from "node:child_process";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });
if (process.env.DATABASE_URL) run("node --experimental-strip-types scripts/migrate.ts");
else console.warn("DATABASE_URL is not set: skipping migrations. Add a Neon database before using the app.");
run("next build");
