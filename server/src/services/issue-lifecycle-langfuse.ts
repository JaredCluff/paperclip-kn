/**
 * Emit Langfuse spans when a Paperclip issue transitions lifecycle state.
 * Fire-and-forget — never throws, never blocks the route handler.
 */
import { getLangfuseClient } from "../langfuse.js";

interface IssueStateTransitionInput {
  issueId: string;
  companyId: string;
  fromStatus: string;
  toStatus: string;
  assigneeAgentId?: string | null;
}

export function trackIssueStateTransition(input: IssueStateTransitionInput): void {
  const lf = getLangfuseClient();
  if (lf === null) return;

  void (async () => {
    try {
      const trace = lf.trace({
        id: input.issueId,
        name: "paperclip.issue",
        metadata: {
          companyId: input.companyId,
          assigneeAgentId: input.assigneeAgentId ?? null,
        },
      });
      trace.event({
        name: `issue.${input.toStatus}`,
        input: { fromStatus: input.fromStatus },
        output: { toStatus: input.toStatus },
        metadata: { issueId: input.issueId },
      });
      await lf.flushAsync();
    } catch {
      // Langfuse is non-critical — silent failure
    }
  })();
}
