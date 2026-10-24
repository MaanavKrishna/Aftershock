import { test, expect } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { dbCacheStore, CACHE_PER_REPO } from "@/lib/runner/cacheStore";
import { ledgerWorld } from "../support/world";

test("snapshots are found by key, capped per repository, and only enabled by the workspace flag", async () => {
  const w = await ledgerWorld();
  const db = await getDb();
  const store = dbCacheStore();
  expect(await store.enabled(w.ws.id)).toBe(false);
  await db.update(s.workspaces).set({ settings: { ...w.ws.settings, flags: { installCache: true } } }).where(eq(s.workspaces.id, w.ws.id));
  expect(await store.enabled(w.ws.id)).toBe(true);

  for (let i = 0; i < CACHE_PER_REPO + 2; i++) {
    await store.save(w.ws.id, w.repo.id, `k${i}`, `snap_${i}`, 100);
    await new Promise((r) => setTimeout(r, 5));
  }
  const evicted = await store.evict(w.repo.id);
  expect(evicted).toEqual(["snap_0", "snap_1"]);
  expect(await store.find(w.repo.id, "k0")).toBeNull();
  expect(await store.find(w.repo.id, `k${CACHE_PER_REPO + 1}`)).toBe(`snap_${CACHE_PER_REPO + 1}`);
  await store.save(w.ws.id, w.repo.id, "k2", "snap_2b", 100);
  expect(await store.find(w.repo.id, "k2")).toBe("snap_2b");
});
