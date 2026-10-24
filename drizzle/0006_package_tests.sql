ALTER TABLE "memory_tests" ADD COLUMN "workdir" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "memory_tests" ADD COLUMN "framework" text;--> statement-breakpoint
ALTER TABLE "memory_tests" ADD COLUMN "install_cmd" text;