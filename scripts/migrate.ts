// Applies drizzle/ migrations to DATABASE_URL (Neon). Run on deploy: `npm run db:migrate`.
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const pool = new Pool({ connectionString: url });
await migrate(drizzle({ client: pool }), { migrationsFolder: "drizzle" });
await pool.end();
console.log("migrations applied");
