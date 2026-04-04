import { pgTable, uuid, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { issues } from "./issues.js";
import { agents } from "./agents.js";

export const issueAgentArchives = pgTable(
  "issue_agent_archives",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    issueId: uuid("issue_id").notNull().references(() => issues.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    archivedAt: timestamp("archived_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIssueIdx: index("issue_agent_archives_company_issue_idx").on(table.companyId, table.issueId),
    companyAgentIdx: index("issue_agent_archives_company_agent_idx").on(table.companyId, table.agentId),
    companyIssueAgentUnique: uniqueIndex("issue_agent_archives_company_issue_agent_idx").on(
      table.companyId,
      table.issueId,
      table.agentId,
    ),
  }),
);
