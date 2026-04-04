CREATE TABLE "issue_agent_archives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"archived_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issue_agent_archives" ADD CONSTRAINT "issue_agent_archives_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_agent_archives" ADD CONSTRAINT "issue_agent_archives_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_agent_archives" ADD CONSTRAINT "issue_agent_archives_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_agent_archives_company_issue_idx" ON "issue_agent_archives" USING btree ("company_id","issue_id");--> statement-breakpoint
CREATE INDEX "issue_agent_archives_company_agent_idx" ON "issue_agent_archives" USING btree ("company_id","agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "issue_agent_archives_company_issue_agent_idx" ON "issue_agent_archives" USING btree ("company_id","issue_id","agent_id");
