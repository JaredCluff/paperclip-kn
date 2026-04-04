import { and, gte, inArray, sql, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { documents, issues } from "@paperclipai/db";
import { documentService } from "./documents.js";
import { enqueueRunbookReview, type RunbookReviewSnapshot } from "./runbook-review.js";
import { logger } from "../middleware/logger.js";

const SIMILARITY_THRESHOLD = (() => {
  const v = parseFloat(process.env.RUNBOOK_SIMILARITY_THRESHOLD ?? "");
  return isNaN(v) ? 0.4 : v;
})();
const LOOKBACK_DAYS = (() => {
  const v = parseInt(process.env.RUNBOOK_SWEEP_LOOKBACK_DAYS ?? "", 10);
  return isNaN(v) ? 7 : v;
})();
const MIN_CLUSTER_SIZE = 2;

interface ClosedIssueRow {
  id: string;
  identifier: string;
  companyId: string;
  projectId: string | null;
  title: string;
  description: string | null;
  resolutionNotes: string;
  status: string;
  updatedAt: Date;
}

// Union-Find helpers for clustering
function makeFind(parent: Map<string, string>) {
  function find(id: string): string {
    if (!parent.has(id)) parent.set(id, id);
    if (parent.get(id) !== id) parent.set(id, find(parent.get(id)!));
    return parent.get(id)!;
  }
  return find;
}

export async function runRunbookPatternSweep(db: Db): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

    const closedIssues = (await db
      .select({
        id: issues.id,
        identifier: issues.identifier,
        companyId: issues.companyId,
        projectId: issues.projectId,
        title: issues.title,
        description: issues.description,
        resolutionNotes: issues.resolutionNotes,
        status: issues.status,
        updatedAt: issues.updatedAt,
      })
      .from(issues)
      .where(
        and(
          inArray(issues.status, ["done", "cancelled"]),
          gte(issues.updatedAt, cutoff),
          sql`${issues.resolutionNotes} IS NOT NULL AND ${issues.resolutionNotes} <> ''`,
        ),
      )) as ClosedIssueRow[];

    if (closedIssues.length < MIN_CLUSTER_SIZE) return;

    // Group by companyId + projectId (coarse filter)
    const groups = new Map<string, ClosedIssueRow[]>();
    for (const issue of closedIssues) {
      const key = `${issue.companyId}::${issue.projectId ?? "none"}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(issue);
    }

    const docSvc = documentService(db);

    for (const [, group] of groups) {
      if (group.length < MIN_CLUSTER_SIZE) continue;

      const issueIds = group.map((i) => i.id);

      // pg_trgm similarity query — requires pg_trgm extension (added in migration 0057)
      const pairsResult = await db.execute<{ id_a: string; id_b: string; sim: number }>(
        sql`
          SELECT a.id AS id_a, b.id AS id_b,
            similarity(
              a.title || ' ' || COALESCE(a.resolution_notes, ''),
              b.title || ' ' || COALESCE(b.resolution_notes, '')
            ) AS sim
          FROM issues a
          JOIN issues b ON a.id < b.id
          WHERE a.id = ANY(${issueIds}::uuid[])
            AND b.id = ANY(${issueIds}::uuid[])
            AND similarity(
              a.title || ' ' || COALESCE(a.resolution_notes, ''),
              b.title || ' ' || COALESCE(b.resolution_notes, '')
            ) >= ${SIMILARITY_THRESHOLD}
        `,
      );

      const pairs = pairsResult.rows ?? [];
      if (pairs.length === 0) continue;

      // Union-Find clustering
      const parent = new Map<string, string>();
      const find = makeFind(parent);
      const union = (a: string, b: string) => parent.set(find(a), find(b));

      for (const pair of pairs) {
        union(pair.id_a, pair.id_b);
      }

      // Build clusters by root
      const clusters = new Map<string, ClosedIssueRow[]>();
      for (const issue of group) {
        if (!parent.has(issue.id)) continue;
        const root = find(issue.id);
        if (!clusters.has(root)) clusters.set(root, []);
        clusters.get(root)!.push(issue);
      }

      for (const [, cluster] of clusters) {
        if (cluster.length < MIN_CLUSTER_SIZE) continue;

        // Sort ascending by updatedAt — earliest is canonical
        cluster.sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
        const canonical = cluster[0];

        try {
          // Check for existing runbook for this canonical issue
          const existingRunbook = await db
            .select({
              id: documents.id,
              latestBody: documents.latestBody,
            })
            .from(documents)
            .where(
              and(
                eq(documents.kind, "runbook"),
                eq(documents.sourceIssueId, canonical.id),
              ),
            )
            .then((rows) => rows[0] ?? null);

          if (existingRunbook) {
            // Append new evidence as a revision
            const additionalCases = cluster
              .slice(1)
              .map((i) => `- **${i.title}**: ${i.resolutionNotes}`)
              .join("\n");
            const newBody = `${existingRunbook.latestBody}\n\n## Additional Cases Detected (${new Date().toISOString().split("T")[0]})\n\n${additionalCases}`;
            await docSvc.updateRunbookRevision({
              documentId: existingRunbook.id,
              companyId: canonical.companyId,
              body: newBody,
              changeSummary: `Pattern sweep added ${cluster.length - 1} related case(s)`,
              updatedByAgentId: null,
            });
          } else {
            // Create review issue via agent
            const snapshot: RunbookReviewSnapshot = {
              issueId: canonical.id,
              identifier: canonical.identifier,
              title: canonical.title,
              description: canonical.description ?? null,
              resolutionNotes: canonical.resolutionNotes,
              status: canonical.status as "done" | "cancelled",
              projectId: canonical.projectId ?? null,
              companyId: canonical.companyId,
              closedAt: canonical.updatedAt.toISOString(),
              comments: [],
            };
            await enqueueRunbookReview(db, snapshot);
          }
        } catch (err) {
          logger.error({ err, canonicalIssueId: canonical.id }, "Pattern sweep failed for cluster — continuing");
        }
      }
    }
  } catch (err) {
    logger.error({ err }, "Runbook pattern sweep failed");
  }
}
