CREATE INDEX "heartbeat_runs_status_active_idx" ON "heartbeat_runs" USING btree ("status") WHERE status IN ('running', 'queued');--> statement-breakpoint
CREATE INDEX "cost_events_company_project_occurred_idx" ON "cost_events" USING btree ("company_id","project_id","occurred_at");
