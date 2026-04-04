CREATE EXTENSION IF NOT EXISTS pg_trgm;

--> statement-breakpoint

ALTER TABLE "issues" ADD COLUMN "resolution_notes" text;

--> statement-breakpoint

ALTER TABLE "documents"
  ADD COLUMN "kind" text NOT NULL DEFAULT 'general',
  ADD COLUMN "source_issue_id" uuid REFERENCES "issues"("id") ON DELETE SET NULL;

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "documents_kind_idx" ON "documents" ("company_id", "kind");

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "documents_source_issue_idx" ON "documents" ("source_issue_id");
