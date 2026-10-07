import path from "node:path";
import fs from "node:fs";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS = path.join(process.cwd(), "drizzle");

type Holder = { promise?: Promise<Db> };
const holder: Holder = ((globalThis as unknown as { __aftershockDb?: Holder }).__aftershockDb ??= {});

async function open(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-serverless");
    // WebSocket pool (not HTTP) so transactions work. Migrations run at deploy time (`npm run db:migrate`).
    return drizzle({ client: new Pool({ connectionString: url }), schema }) as unknown as Db;
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const memory = process.env.AFTERSHOCK_DB === "memory";
  const dir = path.join(process.cwd(), "data", "pglite");
  if (!memory) fs.mkdirSync(dir, { recursive: true });
  const client = new PGlite(memory ? undefined : dir);
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as Db;
}

/** One database per process. Local and demo use embedded PGlite; production uses Neon. */
export function getDb(): Promise<Db> {
  holder.promise ??= open().catch((err) => {
    holder.promise = undefined;
    throw err;
  });
  return holder.promise;
}
