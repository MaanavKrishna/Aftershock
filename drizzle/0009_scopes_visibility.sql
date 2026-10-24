ALTER TABLE "api_tokens" ADD COLUMN "scope" text DEFAULT 'write' NOT NULL;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "is_private" boolean;