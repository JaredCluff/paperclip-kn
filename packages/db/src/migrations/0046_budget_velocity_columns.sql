ALTER TABLE "budget_policies" ADD COLUMN "velocity_window_minutes" integer;--> statement-breakpoint
ALTER TABLE "budget_policies" ADD COLUMN "velocity_warn_cents" integer;--> statement-breakpoint
ALTER TABLE "budget_policies" ADD COLUMN "velocity_hard_cents" integer;
