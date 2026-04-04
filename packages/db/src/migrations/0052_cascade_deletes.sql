-- agent_api_keys: cascade on agent_id
ALTER TABLE "agent_api_keys" DROP CONSTRAINT "agent_api_keys_agent_id_agents_id_fk";
ALTER TABLE "agent_api_keys" ADD CONSTRAINT "agent_api_keys_agent_id_agents_id_fk"
  FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE;

-- agent_task_sessions: cascade on agent_id
ALTER TABLE "agent_task_sessions" DROP CONSTRAINT "agent_task_sessions_agent_id_agents_id_fk";
ALTER TABLE "agent_task_sessions" ADD CONSTRAINT "agent_task_sessions_agent_id_agents_id_fk"
  FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE;

-- agent_wakeup_requests: cascade on agent_id
ALTER TABLE "agent_wakeup_requests" DROP CONSTRAINT "agent_wakeup_requests_agent_id_agents_id_fk";
ALTER TABLE "agent_wakeup_requests" ADD CONSTRAINT "agent_wakeup_requests_agent_id_agents_id_fk"
  FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE;

-- agent_runtime_state: cascade on agent_id (PK)
ALTER TABLE "agent_runtime_state" DROP CONSTRAINT "agent_runtime_state_agent_id_agents_id_fk";
ALTER TABLE "agent_runtime_state" ADD CONSTRAINT "agent_runtime_state_agent_id_agents_id_fk"
  FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE;

-- issue_comments: cascade on issue_id, set null on author_agent_id
ALTER TABLE "issue_comments" DROP CONSTRAINT "issue_comments_issue_id_issues_id_fk";
ALTER TABLE "issue_comments" ADD CONSTRAINT "issue_comments_issue_id_issues_id_fk"
  FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE;

ALTER TABLE "issue_comments" DROP CONSTRAINT "issue_comments_author_agent_id_agents_id_fk";
ALTER TABLE "issue_comments" ADD CONSTRAINT "issue_comments_author_agent_id_agents_id_fk"
  FOREIGN KEY ("author_agent_id") REFERENCES "agents"("id") ON DELETE SET NULL;

-- issue_read_states: cascade on issue_id
ALTER TABLE "issue_read_states" DROP CONSTRAINT "issue_read_states_issue_id_issues_id_fk";
ALTER TABLE "issue_read_states" ADD CONSTRAINT "issue_read_states_issue_id_issues_id_fk"
  FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE;

-- issue_inbox_archives: cascade on issue_id
ALTER TABLE "issue_inbox_archives" DROP CONSTRAINT "issue_inbox_archives_issue_id_issues_id_fk";
ALTER TABLE "issue_inbox_archives" ADD CONSTRAINT "issue_inbox_archives_issue_id_issues_id_fk"
  FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE;

-- issue_agent_archives: cascade on issue_id and agent_id
ALTER TABLE "issue_agent_archives" DROP CONSTRAINT "issue_agent_archives_issue_id_issues_id_fk";
ALTER TABLE "issue_agent_archives" ADD CONSTRAINT "issue_agent_archives_issue_id_issues_id_fk"
  FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE;

ALTER TABLE "issue_agent_archives" DROP CONSTRAINT "issue_agent_archives_agent_id_agents_id_fk";
ALTER TABLE "issue_agent_archives" ADD CONSTRAINT "issue_agent_archives_agent_id_agents_id_fk"
  FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE;

-- issues: set null on assignee_agent_id and created_by_agent_id
ALTER TABLE "issues" DROP CONSTRAINT "issues_assignee_agent_id_agents_id_fk";
ALTER TABLE "issues" ADD CONSTRAINT "issues_assignee_agent_id_agents_id_fk"
  FOREIGN KEY ("assignee_agent_id") REFERENCES "agents"("id") ON DELETE SET NULL;

ALTER TABLE "issues" DROP CONSTRAINT "issues_created_by_agent_id_agents_id_fk";
ALTER TABLE "issues" ADD CONSTRAINT "issues_created_by_agent_id_agents_id_fk"
  FOREIGN KEY ("created_by_agent_id") REFERENCES "agents"("id") ON DELETE SET NULL;
