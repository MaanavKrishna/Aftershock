-- Keep the oldest incident per alert fingerprint, so the unique index below can always be created.
UPDATE "incidents" AS i SET "fingerprint" = NULL WHERE i."fingerprint" IS NOT NULL AND EXISTS (SELECT 1 FROM "incidents" AS j WHERE j."workspace_id" = i."workspace_id" AND j."fingerprint" = i."fingerprint" AND (j."created_at", j."id") < (i."created_at", i."id"));--> statement-breakpoint
CREATE INDEX "activity_workspace_created" ON "activity" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_incident" ON "activity" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "audit_log_workspace_created" ON "audit_log" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "deliveries_workspace_kind_created" ON "deliveries" USING btree ("workspace_id","kind","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "incidents_workspace_fingerprint" ON "incidents" USING btree ("workspace_id","fingerprint") WHERE "incidents"."fingerprint" is not null;--> statement-breakpoint
CREATE INDEX "incidents_repo" ON "incidents" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "memberships_user" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "memory_tests_workspace" ON "memory_tests" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "memory_tests_repo" ON "memory_tests" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "memory_tests_incident" ON "memory_tests" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "notes_incident" ON "notes" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "overrides_check" ON "overrides" USING btree ("check_id");--> statement-breakpoint
CREATE INDEX "pr_check_results_check" ON "pr_check_results" USING btree ("check_id");--> statement-breakpoint
CREATE INDEX "pr_check_results_memory_test" ON "pr_check_results" USING btree ("memory_test_id");--> statement-breakpoint
CREATE INDEX "pr_check_skips_check" ON "pr_check_skips" USING btree ("check_id");--> statement-breakpoint
CREATE INDEX "pr_checks_workspace_created" ON "pr_checks" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "pr_checks_repo_pr" ON "pr_checks" USING btree ("repo_id","pr_number");--> statement-breakpoint
CREATE INDEX "repositories_workspace" ON "repositories" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "suggested_fixes_check" ON "suggested_fixes" USING btree ("check_id");--> statement-breakpoint
CREATE INDEX "time_travel_runs_incident" ON "time_travel_runs" USING btree ("incident_id");