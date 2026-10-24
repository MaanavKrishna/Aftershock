/** Features that ship dark and are switched on per workspace (settings.flags) or for everyone by env. */
export const FLAGS = {
  installCache: "Reuse installed dependencies between runs (sandbox snapshots)",
  langGo: "Go (go test)",
  langJunit: "Java and Kotlin (JUnit via Maven or Gradle)",
  langRspec: "Ruby (RSpec)",
  langPlaywright: "Frontend incidents (Playwright)",
  intakeExtra: "incident.io, Rootly, Opsgenie, Datadog, Linear, Jira and generic webhooks",
  notifications: "Slack and outbound webhooks",
  mcp: "MCP server for coding agents",
  badge: "Public README badge",
  reproof: "Weekly still-guarding re-proof",
  testStrength: "Test strength by mutation after each proof",
  mergeQueue: "Merge queue checks",
  quarantineEnforce: "Skip quarantined tests on pull requests",
  planEnforce: "Enforce plan limits",
} as const;

export type Flag = keyof typeof FLAGS;
type Env = Record<string, string | undefined>;

const envName = (f: Flag) => `AFTERSHOCK_FLAG_${f.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`;

export function flagEnabled(flag: Flag, settings: { flags?: Partial<Record<string, boolean>> } | null | undefined, env: Env = process.env): boolean {
  const forced = env[envName(flag)]?.toLowerCase();
  if (forced === "on" || forced === "1" || forced === "true") return true;
  if (forced === "off" || forced === "0" || forced === "false") return false;
  return settings?.flags?.[flag] === true;
}

/** Operator kill switch: no sandbox or Docker runs start while set. */
export function runsDisabled(env: Env = process.env): boolean {
  return env.AFTERSHOCK_RUNS_DISABLED === "1";
}
