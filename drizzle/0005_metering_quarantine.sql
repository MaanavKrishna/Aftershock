ALTER TABLE "memory_tests" ADD COLUMN "quarantined" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "memory_tests" ADD COLUMN "quarantined_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "memory_tests" ADD COLUMN "quarantine_reason" text;--> statement-breakpoint
ALTER TABLE "pr_checks" ADD COLUMN "author" text;--> statement-breakpoint
ALTER TABLE "pr_checks" ADD COLUMN "author_is_bot" boolean DEFAULT false NOT NULL;