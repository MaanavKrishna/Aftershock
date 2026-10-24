ALTER TABLE "memory_tests" ADD COLUMN "guard_status" text;--> statement-breakpoint
ALTER TABLE "memory_tests" ADD COLUMN "guard_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "memory_tests" ADD COLUMN "guard_sha" text;--> statement-breakpoint
ALTER TABLE "memory_tests" ADD COLUMN "guard_detail" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "pr_checks" ADD COLUMN "merge_group_ref" text;