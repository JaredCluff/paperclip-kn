-- Add FK constraint on routine_runs.coalesced_into_run_id
ALTER TABLE "routine_runs"
  ADD CONSTRAINT "routine_runs_coalesced_into_run_id_fkey"
  FOREIGN KEY ("coalesced_into_run_id")
  REFERENCES "routine_runs"("id")
  ON DELETE SET NULL;

--> statement-breakpoint

-- Add index on goals.parent_id for hierarchical queries and FK cascade performance
CREATE INDEX IF NOT EXISTS "goals_parent_idx" ON "goals" ("parent_id");
