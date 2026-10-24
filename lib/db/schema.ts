import type { Framework } from "@/lib/runner/frameworks";
import { pgTable, text, integer, boolean, jsonb, timestamp, uniqueIndex, primaryKey, bigint, index } from "drizzle-orm/pg-core";
import type { RunResult } from "@/lib/domain/verdict";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const workspaces = pgTable("workspaces", {
  id: id(),
  login: text("login").notNull().unique(),
  name: text("name").notNull(),
  plan: text("plan").notNull().default("free"),
  /** Set when the GitHub App is uninstalled; the workspace is purged 30 days later unless it is reinstalled. */
  uninstalledAt: timestamp("uninstalled_at", { withTimezone: true }),
  incidentPrefix: text("incident_prefix").notNull().default("INC"),
  installationId: bigint("installation_id", { mode: "number" }),
  settings: jsonb("settings").$type<{ autoImportIssues?: boolean; autoTravelOnMerge?: boolean; issueLabel?: string; flags?: Partial<Record<string, boolean>> }>().notNull().default({}),
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
  framework: text("framework").$type<Framework>().notNull(),
  installCmd: text("install_cmd").notNull(),
  testDir: text("test_dir").notNull().default("tests/aftershock"),
  runner: text("runner").$type<"sandbox" | "actions">().notNull().default("sandbox"),
  checkMode: text("check_mode").$type<"blocking" | "advisory">().notNull().default("blocking"),
  lastCheckAt: timestamp("last_check_at", { withTimezone: true }),
  /** Set when the GitHub App loses access; the repository is purged 30 days later unless access returns. */
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: created(),
});

export type IncidentStatus = "awaiting_fix" | "traveling" | "proven" | "rejected" | "unproven";
/** Alert and ticket sources that deliver over webhooks (lib/integrations/sources.ts). */
export type IntakeKind = "sentry" | "pagerduty" | "incidentio" | "linear" | "rootly" | "opsgenie" | "datadog" | "jira" | "webhook";
export type IncidentSource = "issue" | "postmortem" | "form" | IntakeKind;
export type Epicenter = { sha: string; prNumber?: number; title?: string; testedCommits: number; arrivedWithCode?: boolean } | { unavailable: string };

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
  /** Flaky on main: skipped on pull requests (when enforcement is on) until seven green nights. */
  /** Monorepo package the test runs in ("" = repository root), and its framework and install (null = the repository's). */
  workdir: text("workdir").notNull().default(""),
  framework: text("framework").$type<Framework>(),
  installCmd: text("install_cmd"),
  quarantined: boolean("quarantined").notNull().default(false),
  quarantinedAt: timestamp("quarantined_at", { withTimezone: true }),
  quarantineReason: text("quarantine_reason"),
  /** Weekly re-proof: does the test still fail when the fix is undone on today's default branch? */
  guardStatus: text("guard_status").$type<GuardStatus>(),
  guardCheckedAt: timestamp("guard_checked_at", { withTimezone: true }),
  guardSha: text("guard_sha"),
  guardDetail: text("guard_detail").notNull().default(""),
});

/** guarding: fails with the fix undone. weak: passes anyway. drifted: the fix can no longer be undone on the current code. */
export type GuardStatus = "guarding" | "weak" | "drifted";

export type CheckVerdict = "recur" | "safe" | "inconclusive" | "skipped";

export const prChecks = pgTable("pr_checks", {
  id: id(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  repoId: text("repo_id").notNull().references(() => repositories.id, { onDelete: "cascade" }),
  prNumber: integer("pr_number").notNull(),
  title: text("title").notNull(),
  headSha: text("head_sha").notNull(),
  baseSha: text("base_sha").notNull(),
  /** The commit the tests ran on: GitHub's test merge of head into base, or the head when the PR conflicts. */
  testedSha: text("tested_sha"),
  /** Set for merge queue checks: the merge group's head ref (gh-readonly-queue/...). No PR comment is posted for these. */
  mergeGroupRef: text("merge_group_ref"),
  /** Pull request author, for active-committer counts. Bots are recorded but never counted. */
  author: text("author"),
  authorIsBot: boolean("author_is_bot").notNull().default(false),
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
  /** Null once the author deletes their account; the record of the override stays. */
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  reason: text("reason").notNull(),
  createdAt: created(),
});

export const notes = pgTable("notes", {
  id: id(),
  incidentId: text("incident_id").notNull().references(() => incidents.id, { onDelete: "cascade" }),
  /** Null once the author deletes their account; the note stays on the trail. */
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  text: text("text").notNull(),
  createdAt: created(),
});

export const integrations = pgTable(
  "integrations",
  {
    id: id(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    kind: text("kind").$type<IntakeKind | "model">().notNull(),
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

/** Installed-dependency snapshots for trusted commits, at most a few per repository. */
export const envSnapshots = pgTable(
  "env_snapshots",
  {
    id: id(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    repoId: text("repo_id").notNull().references(() => repositories.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    snapshotId: text("snapshot_id").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull().default(0),
    createdAt: created(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("env_snapshots_repo_key").on(t.repoId, t.key)],
);

/** Who deleted or changed what. Not tied to the workspace row, so it outlives the workspace. */
export const auditLog = pgTable("audit_log", {
  id: id(),
  workspaceId: text("workspace_id").notNull(),
  actorUserId: text("actor_user_id"),
  action: text("action").notNull(),
  target: text("target").notNull().default(""),
  detail: text("detail").notNull().default(""),
  createdAt: created(),
});

/** Events a notification target can subscribe to (lib/notify). */
export type NotifyEvent = "incident.opened" | "incident.proven" | "incident.unproven" | "pr.blocked" | "epicenter.found" | "nightly.failing" | "test.quarantined" | "check.overridden" | "test.weakened";

export const notificationTargets = pgTable("notification_targets", {
  id: id(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  kind: text("kind").$type<"slack" | "webhook">().notNull(),
  name: text("name").notNull(),
  /** Slack webhook URLs are bearer secrets, so every URL is stored encrypted. */
  urlCiphertext: text("url_ciphertext").notNull(),
  urlHint: text("url_hint").notNull().default(""),
  secretCiphertext: text("secret_ciphertext"),
  events: jsonb("events").$type<NotifyEvent[]>().notNull().default([]),
  enabled: boolean("enabled").notNull().default(true),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  disabledReason: text("disabled_reason"),
  lastStatus: text("last_status").notNull().default(""),
  lastDeliveryAt: timestamp("last_delivery_at", { withTimezone: true }),
  createdAt: created(),
});

/** Outbox: one row per (event, target). Delivered with back-off by lib/workflows/notify.ts. */
export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    targetId: text("target_id").notNull().references(() => notificationTargets.id, { onDelete: "cascade" }),
    event: text("event").$type<NotifyEvent>().notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").$type<"pending" | "sending" | "sent" | "failed">().notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    lastError: text("last_error").notNull().default(""),
    createdAt: created(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [index("notifications_due").on(t.status, t.nextAttemptAt)],
);
