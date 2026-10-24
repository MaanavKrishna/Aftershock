import type { RunResult } from "@/lib/domain/verdict";

import type { Framework } from "./frameworks";

export type { Framework };

export type RunSpec = {
  /** Git URL, or an absolute local path to a git repository. */
  repoUrl: string;
  /** Short-lived token for private GitHub repos. Never written to logs. */
  token?: string;
  sha: string;
  framework: Framework;
  install: string;
  testPath: string;
  testCode: string;
  runs: number;
  timeoutMs: number;
  /** Files written over the checkout before the test runs (a suggested fix). */
  overlay?: { path: string; content: string }[];
  /** Monorepo package folder (repository-relative) where install and tests run; testPath stays repository-relative. */
  workdir?: string;
  /** Install caching: who owns the run, and whether its commit is trusted (default-branch history). */
  cache?: { workspaceId: string; repoId: string; trusted: boolean };
  /** Set by the cache: start from this snapshot instead of installing. */
  restoreSnapshotId?: string;
  /** Set by the cache: snapshot the installed environment for later runs. */
  saveSnapshot?: boolean;
};

export type RunReport = { results: RunResult[]; installOk: boolean; log: string; cpuMs: number; wallMs: number; snapshot?: { id: string; sizeBytes: number } };

export interface Runner {
  kind: "docker" | "sandbox";
  run(spec: RunSpec): Promise<RunReport>;
}
