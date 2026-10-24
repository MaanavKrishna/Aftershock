import { isFramework, type Framework } from "@/lib/runner/frameworks";
import type { GitSource } from "@/lib/git/types";

export type RepoSettings = {
  framework: Framework;
  installCmd: string;
  testDir: string;
  runner: "sandbox" | "actions";
  checkMode: "blocking" | "advisory";
};
export type PackageConfig = { path: string; framework?: Framework; installCmd?: string; testDir?: string };
export type RepoConfig = Partial<RepoSettings> & { issueLabel?: string; packages?: PackageConfig[] };

const safeDir = (d: string | undefined) => {
  const dir = d?.replace(/\/+$/, "");
  return dir && /^[\w.-]+(\/[\w.-]+)*$/.test(dir) && !dir.split("/").includes("..") ? dir : undefined;
};

/** The `packages:` list of a monorepo: "- path: …" items with indented keys. Invalid items are dropped. */
function parsePackages(lines: string[]): PackageConfig[] {
  const items: Record<string, string>[] = [];
  for (const raw of lines) {
    const line = raw.replace(/\s+#.*$/, "");
    const m = line.match(/^\s*(-\s+)?([A-Za-z_]+):\s*(.*)$/);
    if (!m) continue;
    if (m[1]) items.push({});
    if (!items.length) continue;
    items[items.length - 1][m[2]] = unquote(m[3].trim());
  }
  const out: PackageConfig[] = [];
  for (const it of items) {
    const path = safeDir(it.path);
    if (!path) continue;
    const pkg: PackageConfig = { path };
    if (isFramework(it.framework)) pkg.framework = it.framework;
    if (it.install && it.install.length <= 300) pkg.installCmd = it.install;
    const td = safeDir(it.test_dir);
    if (td) pkg.testDir = td;
    out.push(pkg);
  }
  return out.slice(0, 50);
}

export const CONFIG_PATH = ".aftershock/config.yaml";

const unquote = (v: string) => v.replace(/^(["'])(.*)\1$/, "$2");

/** Parses the small, fixed schema of .aftershock/config.yaml. Unknown keys and invalid values are ignored. */
export function parseRepoConfig(text: string): RepoConfig {
  // Pull the packages: block out first; the rest is a flat, one-level schema.
  const all = text.split("\n");
  const start = all.findIndex((l) => /^packages:\s*$/.test(l));
  let packageLines: string[] = [];
  if (start >= 0) {
    let end = start + 1;
    while (end < all.length && (/^\s/.test(all[end]) || all[end].trim() === "")) end++;
    packageLines = all.slice(start + 1, end);
    text = [...all.slice(0, start), ...all.slice(end)].join("\n");
  }
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
  if (isFramework(flat.framework)) out.framework = flat.framework;
  if (["sandbox", "actions"].includes(flat.runner)) out.runner = flat.runner as RepoSettings["runner"];
  if (["blocking", "advisory"].includes(flat["check.mode"])) out.checkMode = flat["check.mode"] as RepoSettings["checkMode"];
  if (flat.install && flat.install.length <= 300) out.installCmd = flat.install;
  const dir = flat.test_dir?.replace(/\/+$/, "");
  if (dir && /^[\w.-]+(\/[\w.-]+)*$/.test(dir) && !dir.split("/").includes("..")) out.testDir = dir;
  if (flat["incidents.issue_label"] && /^[\w .:-]{1,50}$/.test(flat["incidents.issue_label"])) out.issueLabel = flat["incidents.issue_label"];
  const packages = parsePackages(packageLines);
  if (packages.length) out.packages = packages;
  return out;
}

export function applyRepoConfig<T extends RepoSettings>(repo: T, cfg: RepoConfig): T {
  const { issueLabel: _ignored, packages: _packages, ...settings } = cfg;
  return { ...repo, ...settings };
}

/** Reads the config from the repository's default branch, if present. */
export async function loadRepoConfig(src: GitSource, defaultBranch: string): Promise<RepoConfig> {
  const head = (await src.revParse(defaultBranch)) ?? (await src.revParse("HEAD"));
  if (!head) return {};
  const text = await src.readFileAt(head, CONFIG_PATH, 8_000);
  return text ? parseRepoConfig(text) : {};
}
