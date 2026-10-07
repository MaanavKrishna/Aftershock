// Removes the demo workspace and its seeded users from DATABASE_URL. Runs on Vercel builds unless AFTERSHOCK_DEMO=1.
import { Pool } from "@neondatabase/serverless";
import { DELETE_DEMO_WORKSPACE, DELETE_ORPHAN_SEEDED_USERS } from "../lib/db/demoSql.ts";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const pool = new Pool({ connectionString: url });
const ws = await pool.query(DELETE_DEMO_WORKSPACE);
const users = await pool.query(DELETE_ORPHAN_SEEDED_USERS);
await pool.end();
console.log(`demo data removed: ${ws.rowCount} workspace(s), ${users.rowCount} user(s)`);
