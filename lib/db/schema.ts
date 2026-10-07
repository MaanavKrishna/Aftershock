import { pgTable, text, integer, boolean, jsonb, timestamp, uniqueIndex, primaryKey, bigint } from "drizzle-orm/pg-core";
import type { RunResult } from "@/lib/domain/verdict";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const workspaces = pgTable("workspaces", {
  id: id(),
  login: text("login").notNull().unique(),
  name: text("name").notNull(),
  plan: text("plan").notNull().default("free"),
  incidentPrefix: text("incident_prefix").notNull().default("INC"),
  installationId: bigint("installation_id", { mode: "number" }),
  settings: jsonb("settings").$type<{ autoImportIssues?: boolean; autoTravelOnMerge?: boolean; issueLabel?: string }>().notNull().default({}),
  createdAt: created(),
});

export const users = pgTable("users", {
  id: id(),
  githubId: text("github_id").unique(),
  login: text("login").notNull(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  createdAt: created(),
});

export const memberships = pgTable(
  "memberships",
  {
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<"owner" | "admin" | "member">().notNull().default("member"),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] })],
);

export const repositories = pgTable("repositories", {
  id: id(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  githubRepoId: text("github_repo_id"),
  fullName: text("full_name").notNull(),
  name: text("name").notNull(),
  cloneUrl: text("clone_url").notNull(),
  defaultBranch: text("default_branch").notNull().default("main"),
  language: text("language").notNull().default("Python"),
  framework: text("framework").$type<"pytest" | "vitest" | "jest">().notNull(),
  installCmd: text("install_cmd").notNull(),
  testDir: text("test_dir").notNull().default("tests/aftershock"),
  runner: text("runner").$type<"sandbox" | "actions">().notNull().default("sandbox"),
  checkMode: text("check_mode").$type<"blocking" | "advisory">().notNull().default("blocking"),
  lastCheckAt: timestamp("last_check_at", { withTimezone: true }),
  createdAt: created(),
});

export type IncidentStatus = "awaiting_fix" | "traveling" | "proven" | "rejected" | "unproven";
export type IncidentSource = "issue" | "postmortem" | "form" | "sentry" | "pagerduty";
export type Epicenter = { sha: string; prNumber?: number; title?: string; testedCommits: number } | { unavailable: string };

export const incidents = pgTable(
  "incidents",
  {
    id: id(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    repoId: text("repo_id").references(() => repositories.id, { onDelete: "set null" }),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    trigger: text("trigger").notNull().default(""),
    observed: text("observed").notNull().default(""),
    expected: text("expected").notNull().default(""),
    severity: text("severity").notNull().default("SEV-2"),
    source: text("source").$type<IncidentSource>().notNull(),
    sourceRef: text("source_ref"),
    fingerprint: text("fingerprint"),
    fixSha: text("fix_sha"),
    parentSha: text("parent_sha"),
    fixPr: integer("fix_pr"),
    fixTitle: text("fix_title"),
    status: text("status").$type<IncidentStatus>().notNull(),
    statusReason: text("status_reason"),
    watchedFiles: jsonb("watched_files").$type<string[]>().notNull().default([]),
    epicenter: jsonb("epicenter").$type<Epicenter>(),
    createdAt: created(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("incidents_workspace_number").on(t.workspaceId, t.number)],
);

export type RunStep = { key: string; label: string; detail: string; state: "ok" | "bad" | "skip" | "running" | "pending"; ms?: number };

export const timeTravelRuns = pgTable("time_travel_runs", {
  id: id(),
  incidentId: text("incident_id").notNull().references(() => incidents.id, { onDelete: "cascade" }),
  attempt: integer("attempt").notNull(),
  status: text("status").$type<"running" | "proven" | "rejected" | "unproven">().notNull(),
  reason: text("reason"),
  feedback: text("feedback"),
  testPath: text("test_path"),
  testCode: text("test_code"),
  beforeResults: jsonb("before_results").$type<RunResult[]>().notNull().default([]),
  fixResults: jsonb("fix_results").$type<RunResult[]>().notNull().default([]),
  steps: jsonb("steps").$type<RunStep[]>().notNull().default([]),
  log: text("log").notNull().default(""),
  inputs: jsonb("inputs").$type<{ name: string; note: string }[]>().notNull().default([]),
  model: text("model"),
  tokens: integer("tokens"),
  runner: text("runner").notNull().default("sandbox"),
  cpuMs: integer("cpu_ms").notNull().default(0),
  wallMs: integer("wall_ms").notNull().default(0),
  createdAt: created(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const memoryTests = pgTable("memory_tests", {
  id: id(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  incidentId: text("incident_id").notNull().references(() => incidents.id, { onDelete: "cascade" }),
  repoId: text("repo_id").notNull().references(() => repositories.id, { onDelete: "cascade" }),
  runId: text("run_id").references(() => timeTravelRuns.id, { onDelete: "set null" }),
  path: text("path").notNull(),
  fn: text("fn").notNull(),
  code: text("code").notNull().default(""),
  botPr: integer("bot_pr"),
  botPrState: text("bot_pr_state").$type<"open" | "merged" | "closed">(),
  health: text("health").$type<"healthy" | "flaky" | "failing">().notNull().default("healthy"),
  nights: jsonb("nights").$type<boolean[]>().notNull().default([]),
  provenAt: timestamp("proven_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CheckVerdict = "recur" | "safe" | "inconclusive" | "skipped";

export const prChecks = pgTable("pr_checks", {
  id: id(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  repoId: text("repo_id").notNull().references(() => repositories.id, { onDelete: "cascade" }),
  prNumber: integer("pr_number").notNull(),
  title: text("title").notNull(),
  headSha: text("head_sha").notNull(),
  baseSha: text("base_sha").notNull(),
  filesChanged: integer("files_changed").notNull().default(0),
  changedFiles: jsonb("changed_files").$type<string[]>().notNull().default([]),
  diff: text("diff").notNull().default(""),
  status: text("status").$type<"queued" | "running" | "done">().notNull(),
  verdict: text("verdict").$type<CheckVerdict>(),
  runner: text("runner"),
  durationMs: integer("duration_ms"),
  checkRunId: bigint("check_run_id", { mode: "number" }),
  commentId: bigint("comment_id", { mode: "number" }),
  overridden: boolean("overridden").notNull().default(false),
  createdAt: created(),
});

export type TraceStep = { head: string; sub: string; bad?: boolean };

export const prCheckResults = pgTable("pr_check_results", {
  id: id(),
  checkId: text("check_id").notNull().references(() => prChecks.id, { onDelete: "cascade" }),
  memoryTestId: text("memory_test_id").notNull().references(() => memoryTests.id, { onDelete: "cascade" }),
  selectedBy: text("selected_by").$type<"files" | "triage">().notNull(),
  why: text("why").notNull().default(""),
  runs: jsonb("runs").$type<RunResult[]>().notNull().default([]),
  verdict: text("verdict").$type<CheckVerdict>().notNull(),
  failureExcerpt: text("failure_excerpt"),
  trace: jsonb("trace").$type<TraceStep[]>().notNull().default([]),
});

export const prCheckSkips = pgTable("pr_check_skips", {
  id: id(),
  checkId: text("check_id").notNull().references(() => prChecks.id, { onDelete: "cascade" }),
  incidentId: text("incident_id").notNull().references(() => incidents.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
});

export const suggestedFixes = pgTable("suggested_fixes", {
  id: id(),
  checkId: text("check_id").notNull().references(() => prChecks.id, { onDelete: "cascade" }),
  patch: text("patch").notNull(),
  explanation: text("explanation").notNull().default(""),
  results: jsonb("results").$type<{ memoryTestId: string; verdict: CheckVerdict }[]>().notNull().default([]),
  status: text("status").$type<"running" | "passed" | "failed">().notNull(),
  createdAt: created(),
});

export const overrides = pgTable("overrides", {
  id: id(),
  checkId: text("check_id").notNull().references(() => prChecks.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id),
  reason: text("reason").notNull(),
  createdAt: created(),
});

export const notes = pgTable("notes", {
  id: id(),
  incidentId: text("incident_id").notNull().references(() => incidents.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id),
  text: text("text").notNull(),
  createdAt: created(),
});

export const integrations = pgTable(
  "integrations",
  {
    id: id(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"sentry" | "pagerduty" | "model">().notNull(),
    config: jsonb("config").$type<Record<string, string>>().notNull().default({}),
    secretCiphertext: text("secret_ciphertext"),
    enabled: boolean("enabled").notNull().default(true),
  },
  (t) => [uniqueIndex("integrations_workspace_kind").on(t.workspaceId, t.kind)],
);

export const deliveries = pgTable("deliveries", {
  id: id(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  event: text("event").notNull(),
  detail: text("detail").notNull().default(""),
  ok: boolean("ok").notNull(),
  createdAt: created(),
});

export const apiTokens = pgTable("api_tokens", {
  id: id(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  prefix: text("prefix").notNull(),
  hash: text("hash").notNull().unique(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: created(),
});

export const activity = pgTable("activity", {
  id: id(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  incidentId: text("incident_id").references(() => incidents.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  detail: text("detail").notNull().default(""),
  tone: text("tone").$type<"pass" | "fail" | "neutral" | "pending">().notNull().default("neutral"),
  createdAt: created(),
});

export const usage = pgTable(
  "usage",
  {
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    sandboxCpuMs: integer("sandbox_cpu_ms").notNull().default(0),
    drafts: integer("drafts").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.month] })],
);

export type IncidentRow = typeof incidents.$inferSelect;
export type TimeTravelRunRow = typeof timeTravelRuns.$inferSelect;
export type RepositoryRow = typeof repositories.$inferSelect;
export type PrCheckRow = typeof prChecks.$inferSelect;
export type MemoryTestRow = typeof memoryTests.$inferSelect;
