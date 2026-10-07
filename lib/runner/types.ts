import type { RunResult } from "@/lib/domain/verdict";

export type Framework = "pytest" | "vitest" | "jest";

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
};

export type RunReport = { results: RunResult[]; installOk: boolean; log: string; cpuMs: number; wallMs: number };

export interface Runner {
  kind: "docker" | "sandbox";
  run(spec: RunSpec): Promise<RunReport>;
}
