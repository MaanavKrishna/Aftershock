import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { flagEnabled } from "@/lib/flags";
import type { CacheStore } from "./cache";
import { frameworkDef } from "./frameworks";

/** Snapshots kept per repository (Hobby plans have little snapshot storage). */
export const CACHE_PER_REPO = 2;

export function dbCacheStore(): CacheStore {
  return {
    async enabled(workspaceId) {
      const db = await getDb();
      const [ws] = await db.select({ settings: s.workspaces.settings }).from(s.workspaces).where(eq(s.workspaces.id, workspaceId));
      return flagEnabled("installCache", ws?.settings);
    },
    async lockfiles(spec) {
      if (!spec.cache) return {};
      const db = await getDb();
      const [repo] = await db.select().from(s.repositories).where(eq(s.repositories.id, spec.cache.repoId));
      const { sourceFor } = await import("@/lib/git/source");
      const src = await sourceFor(repo, spec.token);
      const out: Record<string, string | null> = {};
      for (const f of frameworkDef(spec.framework).lockfiles) out[f] = await src.readFileAt(spec.sha, f, 2_000_000);
      return out;
    },
    async find(repoId, key) {
      const db = await getDb();
      const [row] = await db.update(s.envSnapshots).set({ lastUsedAt: new Date() }).where(and(eq(s.envSnapshots.repoId, repoId), eq(s.envSnapshots.key, key))).returning();
      return row?.snapshotId ?? null;
    },
    async save(workspaceId, repoId, key, snapshotId, sizeBytes) {
      const db = await getDb();
      await db
        .insert(s.envSnapshots)
        .values({ workspaceId, repoId, key, snapshotId, sizeBytes })
        .onConflictDoUpdate({ target: [s.envSnapshots.repoId, s.envSnapshots.key], set: { snapshotId, sizeBytes, lastUsedAt: new Date() } });
    },
    async evict(repoId) {
      const db = await getDb();
      const rows = await db.select().from(s.envSnapshots).where(eq(s.envSnapshots.repoId, repoId)).orderBy(desc(s.envSnapshots.lastUsedAt));
      const old = rows.slice(CACHE_PER_REPO);
      if (old.length) await db.delete(s.envSnapshots).where(inArray(s.envSnapshots.id, old.map((r) => r.id)));
      return old.map((r) => r.snapshotId).reverse();
    },
    async deleteSnapshot(snapshotId) {
      const { Snapshot } = await import("@vercel/sandbox");
      await (await Snapshot.get({ snapshotId })).delete();
    },
  };
}
