import { sql } from "drizzle-orm";
import type { Db } from "./client";
import { DELETE_DEMO_WORKSPACE, DELETE_ORPHAN_SEEDED_USERS } from "./demoSql";

const count = (r: unknown) => ((r as { rows?: unknown[] }).rows ?? (r as unknown[])).length;

/** Deletes the demo workspace (everything in it cascades) and seeded users that now belong to no workspace. */
export async function removeDemoData(db: Db): Promise<{ workspaces: number; users: number }> {
  const ws = await db.execute(sql.raw(DELETE_DEMO_WORKSPACE));
  const users = await db.execute(sql.raw(DELETE_ORPHAN_SEEDED_USERS));
  return { workspaces: count(ws), users: count(users) };
}
