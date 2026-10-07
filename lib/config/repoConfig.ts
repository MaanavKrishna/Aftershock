import type { GitSource } from "@/lib/git/types";

export type RepoSettings = {
  framework: "pytest" | "vitest" | "jest";
  installCmd: string;
  testDir: string;
  runner: "sandbox" | "actions";
  checkMode: "blocking" | "advisory";
};
export type RepoConfig = Partial<RepoSettings> & { issueLabel?: string };

export const CONFIG_PATH = ".aftershock/config.yaml";

const unquote = (v: string) => v.replace(/^(["'])(.*)\1$/, "$2");

/** Parses the small, fixed schema of .aftershock/config.yaml. Unknown keys and invalid values are ignored. */
export function parseRepoConfig(text: string): RepoConfig {
  const flat: Record<string, string> = {};
  let section = "";
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+#.*$/, "").replace(/^#.*$/, "");
    if (!line.trim()) continue;
    const m = line.match(/^(\s*)([A-Za-z_]+):\s*(.*)$/);
    if (!m) continue;
    const [, indent, key, value] = m;
    if (!indent && !value) {
      section = key;
      continue;
    }
    flat[indent ? `${section}.${key}` : key] = unquote(value.trim());
    if (!indent) section = "";
  }
  const out: RepoConfig = {};
  if (["pytest", "vitest", "jest"].includes(flat.framework)) out.framework = flat.framework as RepoSettings["framework"];
  if (["sandbox", "actions"].includes(flat.runner)) out.runner = flat.runner as RepoSettings["runner"];
  if (["blocking", "advisory"].includes(flat["check.mode"])) out.checkMode = flat["check.mode"] as RepoSettings["checkMode"];
  if (flat.install && flat.install.length <= 300) out.installCmd = flat.install;
  const dir = flat.test_dir?.replace(/\/+$/, "");
  if (dir && /^[\w.-]+(\/[\w.-]+)*$/.test(dir) && !dir.split("/").includes("..")) out.testDir = dir;
  if (flat["incidents.issue_label"] && /^[\w .:-]{1,50}$/.test(flat["incidents.issue_label"])) out.issueLabel = flat["incidents.issue_label"];
  return out;
}

export function applyRepoConfig<T extends RepoSettings>(repo: T, cfg: RepoConfig): T {
  const { issueLabel: _ignored, ...settings } = cfg;
  return { ...repo, ...settings };
}

/** Reads the config from the repository's default branch, if present. */
export async function loadRepoConfig(src: GitSource, defaultBranch: string): Promise<RepoConfig> {
  const head = (await src.revParse(defaultBranch)) ?? (await src.revParse("HEAD"));
  if (!head) return {};
  const text = await src.readFileAt(head, CONFIG_PATH, 8_000);
  return text ? parseRepoConfig(text) : {};
}
