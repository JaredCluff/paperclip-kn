/**
 * Mirror a feedback trace bundle to Langfuse for observability.
 * Fire-and-forget — never throws, never blocks the primary export path.
 */
import type { FeedbackTraceBundle } from "@paperclipai/shared";
import { getLangfuseClient } from "../langfuse.js";

export function mirrorFeedbackBundleToLangfuse(bundle: FeedbackTraceBundle): void {
  const lf = getLangfuseClient();
  if (lf === null) return;

  void (async () => {
    try {
      const trace = lf.trace({
        id: bundle.traceId,
        name: "paperclip.feedback",
        metadata: {
          issueId: bundle.issueId,
          issueIdentifier: bundle.issueIdentifier ?? null,
          exportId: bundle.exportId ?? null,
          companyId: bundle.companyId,
          adapterType: bundle.adapterType ?? null,
          captureStatus: bundle.captureStatus,
        },
      });
      trace.event({
        name: "feedback.exported",
        input: {
          traceId: bundle.traceId,
          adapterType: bundle.adapterType ?? null,
        },
        output: { captureStatus: bundle.captureStatus },
      });
      await lf.flushAsync();
    } catch {
      // Langfuse is non-critical — silent failure
    }
  })();
}
