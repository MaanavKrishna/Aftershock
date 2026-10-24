import { createHash } from "node:crypto";
import type { RunReport, RunSpec, Runner } from "./types";
import type { Framework } from "./frameworks";

/** Everything that decides the installed environment; nothing else (so commits that only change code share a cache). */
export function cacheKey(k: { framework: Framework; image: string; install: string; workdir: string; lockfiles: Record<string, string | null> }): string {
  const files = Object.keys(k.lockfiles).sort().map((f) => `${f}\0${k.lockfiles[f] ?? ""}`);
  return createHash("sha256").update([k.framework, k.image, k.install, k.workdir, ...files].join("\n")).digest("hex").slice(0, 32);
}

export type CacheStore = {
  enabled(workspaceId: string): Promise<boolean>;
  lockfiles(spec: RunSpec): Promise<Record<string, string | null>>;
  find(repoId: string, key: string): Promise<string | null>;
  save(workspaceId: string, repoId: string, key: string, snapshotId: string, sizeBytes: number): Promise<void>;
  /** Removes rows beyond the per-repository cap; returns their snapshot ids. */
  evict(repoId: string): Promise<string[]>;
  deleteSnapshot(snapshotId: string): Promise<void>;
};

/**
 * Reuses installed dependencies between sandbox runs. Only trusted commits (default-branch history)
 * ever create snapshots: a pull request runs its own install scripts and must not poison the cache.
 */
export async function cachedRun(runner: Runner, spec: RunSpec, store: CacheStore): Promise<RunReport> {
  if (runner.kind !== "sandbox" || !spec.cache || !(await store.enabled(spec.cache.workspaceId))) return runner.run(spec);
  const { frameworkDef } = await import("./frameworks");
  const key = cacheKey({ framework: spec.framework, image: frameworkDef(spec.framework).sandboxImage, install: spec.install, workdir: "", lockfiles: await store.lockfiles(spec) });
  const hit = await store.find(spec.cache.repoId, key);
  const report = await runner.run({ ...spec, ...(hit ? { restoreSnapshotId: hit } : { saveSnapshot: spec.cache.trusted }) });
  if (!hit && report.snapshot) {
    await store.save(spec.cache.workspaceId, spec.cache.repoId, key, report.snapshot.id, report.snapshot.sizeBytes);
    for (const old of await store.evict(spec.cache.repoId)) await store.deleteSnapshot(old).catch(() => undefined);
  }
  return report;
}
