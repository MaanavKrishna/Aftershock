CREATE TABLE "activity" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"incident_id" text,
	"title" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"tone" text DEFAULT 'neutral' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"prefix" text NOT NULL,
	"hash" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_tokens_hash_unique" UNIQUE("hash")
);
--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"kind" text NOT NULL,
	"event" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"ok" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"repo_id" text,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"trigger" text DEFAULT '' NOT NULL,
	"observed" text DEFAULT '' NOT NULL,
	"expected" text DEFAULT '' NOT NULL,
	"severity" text DEFAULT 'SEV-2' NOT NULL,
	"source" text NOT NULL,
	"source_ref" text,
	"fingerprint" text,
	"fix_sha" text,
	"parent_sha" text,
	"fix_pr" integer,
	"fix_title" text,
	"status" text NOT NULL,
	"status_reason" text,
	"watched_files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"epicenter" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"kind" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"secret_ciphertext" text,
	"enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	CONSTRAINT "memberships_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "memory_tests" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"incident_id" text NOT NULL,
	"repo_id" text NOT NULL,
	"run_id" text,
	"path" text NOT NULL,
	"fn" text NOT NULL,
	"code" text DEFAULT '' NOT NULL,
	"bot_pr" integer,
	"bot_pr_state" text,
	"health" text DEFAULT 'healthy' NOT NULL,
	"nights" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"proven_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" text PRIMARY KEY NOT NULL,
	"incident_id" text NOT NULL,
	"user_id" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "overrides" (
	"id" text PRIMARY KEY NOT NULL,
	"check_id" text NOT NULL,
	"user_id" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pr_check_results" (
	"id" text PRIMARY KEY NOT NULL,
	"check_id" text NOT NULL,
	"memory_test_id" text NOT NULL,
	"selected_by" text NOT NULL,
	"why" text DEFAULT '' NOT NULL,
	"runs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"verdict" text NOT NULL,
	"failure_excerpt" text,
	"trace" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pr_check_skips" (
	"id" text PRIMARY KEY NOT NULL,
	"check_id" text NOT NULL,
	"incident_id" text NOT NULL,
	"reason" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pr_checks" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"repo_id" text NOT NULL,
	"pr_number" integer NOT NULL,
	"title" text NOT NULL,
	"head_sha" text NOT NULL,
	"base_sha" text NOT NULL,
	"files_changed" integer DEFAULT 0 NOT NULL,
	"changed_files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"diff" text DEFAULT '' NOT NULL,
	"status" text NOT NULL,
	"verdict" text,
	"runner" text,
	"duration_ms" integer,
	"check_run_id" bigint,
	"comment_id" bigint,
	"overridden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repositories" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"github_repo_id" text,
	"full_name" text NOT NULL,
	"name" text NOT NULL,
	"clone_url" text NOT NULL,
	"default_branch" text DEFAULT 'main' NOT NULL,
	"language" text DEFAULT 'Python' NOT NULL,
	"framework" text NOT NULL,
	"install_cmd" text NOT NULL,
	"test_dir" text DEFAULT 'tests/aftershock' NOT NULL,
	"runner" text DEFAULT 'sandbox' NOT NULL,
	"check_mode" text DEFAULT 'blocking' NOT NULL,
	"last_check_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suggested_fixes" (
	"id" text PRIMARY KEY NOT NULL,
	"check_id" text NOT NULL,
	"patch" text NOT NULL,
	"explanation" text DEFAULT '' NOT NULL,
	"results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_travel_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"incident_id" text NOT NULL,
	"attempt" integer NOT NULL,
	"status" text NOT NULL,
	"reason" text,
	"feedback" text,
	"test_path" text,
	"test_code" text,
	"before_results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fix_results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"log" text DEFAULT '' NOT NULL,
	"inputs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" text,
	"tokens" integer,
	"runner" text DEFAULT 'sandbox' NOT NULL,
	"cpu_ms" integer DEFAULT 0 NOT NULL,
	"wall_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "usage" (
	"workspace_id" text NOT NULL,
	"month" text NOT NULL,
	"sandbox_cpu_ms" integer DEFAULT 0 NOT NULL,
	"drafts" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "usage_workspace_id_month_pk" PRIMARY KEY("workspace_id","month")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"github_id" text,
	"login" text NOT NULL,
	"name" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_github_id_unique" UNIQUE("github_id")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"login" text NOT NULL,
	"name" text NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"incident_prefix" text DEFAULT 'INC' NOT NULL,
	"installation_id" bigint,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_login_unique" UNIQUE("login")
);
--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_repo_id_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repositories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_tests" ADD CONSTRAINT "memory_tests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_tests" ADD CONSTRAINT "memory_tests_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_tests" ADD CONSTRAINT "memory_tests_repo_id_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_tests" ADD CONSTRAINT "memory_tests_run_id_time_travel_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."time_travel_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overrides" ADD CONSTRAINT "overrides_check_id_pr_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "public"."pr_checks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overrides" ADD CONSTRAINT "overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_check_results" ADD CONSTRAINT "pr_check_results_check_id_pr_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "public"."pr_checks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_check_results" ADD CONSTRAINT "pr_check_results_memory_test_id_memory_tests_id_fk" FOREIGN KEY ("memory_test_id") REFERENCES "public"."memory_tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_check_skips" ADD CONSTRAINT "pr_check_skips_check_id_pr_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "public"."pr_checks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_check_skips" ADD CONSTRAINT "pr_check_skips_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_checks" ADD CONSTRAINT "pr_checks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_checks" ADD CONSTRAINT "pr_checks_repo_id_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggested_fixes" ADD CONSTRAINT "suggested_fixes_check_id_pr_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "public"."pr_checks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_travel_runs" ADD CONSTRAINT "time_travel_runs_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage" ADD CONSTRAINT "usage_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "incidents_workspace_number" ON "incidents" USING btree ("workspace_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "integrations_workspace_kind" ON "integrations" USING btree ("workspace_id","kind");