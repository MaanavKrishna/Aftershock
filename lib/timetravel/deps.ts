import type { Runner } from "@/lib/runner/types";
import type { Framework } from "@/lib/runner/types";

export type DraftInput = {
  key: string;
  incident: { title: string; trigger: string; observed: string; expected: string };
  framework: Framework;
  testDir: string;
  fixTitle: string;
  diff: string;
  changedFiles: string[];
  context: { name: string; note: string; content: string }[];
  feedback?: string;
  hint?: string;
  previous?: string;
};
export type Draft = { path: string; code: string; model: string; tokens?: number };
export interface Drafter {
  draft(input: DraftInput): Promise<Draft>;
}
export type BotPrInput = { workspaceId: string; repoId: string; incidentId: string; key: string; title: string; path: string; code: string; parentSha: string; fixSha: string };

export type Deps = {
  runner: () => Runner;
  drafter: () => Drafter;
  openBotPr: (input: BotPrInput) => Promise<number | null>;
  /** Short-lived token for cloning a private repo (GitHub App installation token). */
  tokenFor: (repo: { workspaceId: string; fullName: string }) => Promise<string | undefined>;
};

let override: Partial<Deps> = {};

/** Tests swap in fakes; production resolves real implementations lazily. */
export function setDeps(d: Partial<Deps>) {
  override = d;
}

async function defaultRunner(): Promise<Runner> {
  const which = process.env.AFTERSHOCK_RUNNER ?? (process.env.VERCEL || process.env.VERCEL_OIDC_TOKEN ? "sandbox" : "docker");
  if (which === "sandbox") return new (await import("@/lib/runner/sandbox")).SandboxRunner();
  return new (await import("@/lib/runner/docker")).DockerRunner();
}

export async function deps(): Promise<Deps> {
  const runner = override.runner ? override.runner() : await defaultRunner();
  const drafter = override.drafter ? override.drafter() : (await import("@/lib/model/draft")).modelDrafter();
  return {
    runner: () => runner,
    drafter: () => drafter,
    openBotPr: override.openBotPr ?? (async (i) => (await import("@/lib/github/botPr")).openBotPr(i)),
    tokenFor: override.tokenFor ?? (async (r) => (await import("@/lib/github/app")).installationTokenFor(r.workspaceId, r.fullName)),
  };
}
