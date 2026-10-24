ALTER TABLE "incidents" ADD COLUMN "related" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "suggested_fix" jsonb;--> statement-breakpoint
ALTER TABLE "pr_checks" ADD COLUMN "risk" jsonb;