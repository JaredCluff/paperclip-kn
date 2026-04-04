import { and, eq, or } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, projects } from "@paperclipai/db";
import { logger } from "../middleware/logger.js";
import { issueService } from "./issues.js";

export interface RunbookReviewSnapshot {
  issueId: string;
  identifier: string;
  title: string;
  description: string | null;
  resolutionNotes: string;
  status: "done" | "cancelled";
  projectId: string | null;
  companyId: string;
  closedAt: string;
  comments: Array<{
    authorAgentId: string | null;
    authorUserId: string | null;
    body: string;
    createdAt: string;
  }>;
}

function buildReviewIssueDescription(snapshot: RunbookReviewSnapshot): string {
  const commentLines = snapshot.comments
    .map(
      (c) =>
        `- [${c.createdAt}] ${c.authorAgentId ?? c.authorUserId ?? "unknown"}: ${c.body}`,
    )
    .join("\n");

  return [
    `## Runbook Review Request`,
    ``,
    `**Original Issue:** ${snapshot.identifier} — ${snapshot.title}`,
    `**Closed At:** ${snapshot.closedAt}`,
    `**Status:** ${snapshot.status}`,
    ``,
    `### Description`,
    snapshot.description ?? "_No description_",
    ``,
    `### Resolution Notes`,
    snapshot.resolutionNotes,
    ``,
    `### Comments`,
    commentLines || "_No comments_",
    ``,
    `---`,
    ``,
    `Please evaluate whether this issue is likely to recur.`,
    `If yes, create a runbook document using \`documents.create\` with \`kind: "runbook"\` and \`sourceIssueId: "${snapshot.issueId}"\`.`,
    `The runbook should cover: symptoms, root cause, resolution steps, and prevention.`,
    `If the issue is unlikely to recur, close this review issue with a note explaining why.`,
  ].join("\n");
}

export async function enqueueRunbookReview(
  db: Db,
  snapshot: RunbookReviewSnapshot,
): Promise<void> {
  try {
    // Find first active agent (prefer idle or active status, fall back to any)
    const primaryAgent = await db
      .select({ id: agents.id })
      .from(agents)
      .where(
        and(
          eq(agents.companyId, snapshot.companyId),
          or(eq(agents.status, "idle"), eq(agents.status, "active")),
        ),
      )
      .orderBy(agents.createdAt)
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!primaryAgent) {
      logger.warn(
        { companyId: snapshot.companyId, issueId: snapshot.issueId },
        "[runbook-review] No active agent found — skipping review",
      );
      return;
    }

    // Use provided projectId or find company's first project
    const project = snapshot.projectId
      ? { id: snapshot.projectId }
      : await db
          .select({ id: projects.id })
          .from(projects)
          .where(eq(projects.companyId, snapshot.companyId))
          .orderBy(projects.createdAt)
          .limit(1)
          .then((rows) => rows[0] ?? null);

    if (!project) {
      logger.warn(
        { companyId: snapshot.companyId, issueId: snapshot.issueId },
        "[runbook-review] No project found — skipping review",
      );
      return;
    }

    const svc = issueService(db);
    await svc.create(snapshot.companyId, {
      projectId: project.id,
      title: `Runbook Review: ${snapshot.title}`,
      description: buildReviewIssueDescription(snapshot),
      status: "todo",
      priority: "low",
      assigneeAgentId: primaryAgent.id,
      originKind: "runbook_review",
      originId: snapshot.issueId,
    });
  } catch (err) {
    logger.error(
      { err, issueId: snapshot.issueId },
      "[runbook-review] Failed to enqueue review issue",
    );
  }
}
