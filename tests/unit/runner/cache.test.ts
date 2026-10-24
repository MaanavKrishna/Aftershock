import { test, expect } from "vitest";
import { cacheKey, cachedRun, type CacheStore } from "@/lib/runner/cache";
import type { RunSpec, Runner } from "@/lib/runner/types";

const base = { framework: "pytest" as const, image: "vercel/sandbox/python:3.14", install: "pip install -r requirements.txt", workdir: "" };

test("the cache key changes with the lockfile, the install command or the image, and nothing else", () => {
  const k = cacheKey({ ...base, lockfiles: { "requirements.txt": "pytest==8" } });
  expect(k).toMatch(/^[0-9a-f]{32}$/);
  expect(cacheKey({ ...base, lockfiles: { "requirements.txt": "pytest==8" } })).toBe(k);
  expect(cacheKey({ ...base, lockfiles: { "requirements.txt": "pytest==9" } })).not.toBe(k);
  expect(cacheKey({ ...base, install: "pip install -e .", lockfiles: { "requirements.txt": "pytest==8" } })).not.toBe(k);
  expect(cacheKey({ ...base, image: "other", lockfiles: { "requirements.txt": "pytest==8" } })).not.toBe(k);
});

const spec = (trusted: boolean): RunSpec => ({ repoUrl: "https://github.com/o/r.git", sha: "abc1234", framework: "pytest", install: "pip install -r requirements.txt", testPath: "tests/aftershock/test_x.py", testCode: "x", runs: 1, timeoutMs: 1000, cache: { workspaceId: "w", repoId: "r", trusted } });

function store(enabled = true): CacheStore & { rows: { key: string; snapshotId: string }[]; deleted: string[] } {
  const rows: { key: string; snapshotId: string }[] = [];
  const deleted: string[] = [];
  return {
    rows, deleted,
    enabled: async () => enabled,
    lockfiles: async () => ({ "requirements.txt": "pytest==8" }),
    find: async (_repo, key) => rows.find((r) => r.key === key)?.snapshotId ?? null,
    save: async (_ws, _repo, key, snapshotId) => void rows.push({ key, snapshotId }),
    evict: async () => [],
    deleteSnapshot: async (id) => void deleted.push(id),
  };
}

const recording = () => {
  const specs: RunSpec[] = [];
  const runner: Runner = { kind: "sandbox", run: async (s) => (specs.push(s), { installOk: true, results: [{ outcome: "passed", durationMs: 1 }], log: "", cpuMs: 1, wallMs: 1, ...(s.saveSnapshot ? { snapshot: { id: "snap_1", sizeBytes: 10 } } : {}) }) };
  return { runner, specs };
};

test("a trusted run saves a snapshot; the next run of the same key restores it", async () => {
  const st = store();
  const r = recording();
  await cachedRun(r.runner, spec(true), st);
  expect(r.specs[0]).toMatchObject({ saveSnapshot: true });
  expect(r.specs[0].restoreSnapshotId).toBeUndefined();
  expect(st.rows).toHaveLength(1);
  await cachedRun(r.runner, spec(false), st);
  expect(r.specs[1]).toMatchObject({ restoreSnapshotId: "snap_1" });
  expect(r.specs[1].saveSnapshot).toBeFalsy();
});

test("pull request runs never create snapshots, so a branch cannot poison the cache", async () => {
  const st = store();
  const r = recording();
  await cachedRun(r.runner, spec(false), st);
  expect(r.specs[0].saveSnapshot).toBeFalsy();
  expect(st.rows).toHaveLength(0);
});

test("with the flag off, or on the Docker runner, nothing is cached", async () => {
  const r = recording();
  await cachedRun(r.runner, spec(true), store(false));
  expect(r.specs[0].saveSnapshot).toBeFalsy();
  const docker: Runner = { ...r.runner, kind: "docker" };
  await cachedRun(docker, spec(true), store(true));
  expect(r.specs[1].saveSnapshot).toBeFalsy();
});

test("evicted snapshots are deleted at the provider", async () => {
  const st = store();
  st.evict = async () => ["snap_old"];
  await cachedRun(recording().runner, spec(true), st);
  expect(st.deleted).toEqual(["snap_old"]);
});
