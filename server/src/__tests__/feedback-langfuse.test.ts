import { describe, expect, it, vi, afterEach } from "vitest";

const { mockTrace, mockLf } = vi.hoisted(() => {
  const mockTrace = { event: vi.fn() };
  const mockLf = {
    trace: vi.fn().mockReturnValue(mockTrace),
    flushAsync: vi.fn().mockResolvedValue(undefined),
  };
  return { mockTrace, mockLf };
});

vi.mock("../langfuse.js", () => ({
  getLangfuseClient: vi.fn().mockReturnValue(mockLf),
}));

import { mirrorFeedbackBundleToLangfuse } from "../services/feedback-langfuse.js";
import { getLangfuseClient } from "../langfuse.js";

describe("mirrorFeedbackBundleToLangfuse", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when Langfuse is not configured", async () => {
    vi.mocked(getLangfuseClient).mockReturnValue(null);
    // Build a minimal bundle — use actual FeedbackTraceBundle field names
    mirrorFeedbackBundleToLangfuse({ traceId: "t1" } as any);
    await new Promise((r) => setTimeout(r, 10));
    expect(mockLf.trace).not.toHaveBeenCalled();
  });

  it("creates a trace and event when Langfuse is configured", async () => {
    vi.mocked(getLangfuseClient).mockReturnValue(mockLf as any);
    mirrorFeedbackBundleToLangfuse({ traceId: "t2", captureStatus: "full" } as any);
    await new Promise((r) => setTimeout(r, 10));
    expect(mockLf.trace).toHaveBeenCalled();
    expect(mockTrace.event).toHaveBeenCalled();
  });

  it("does not throw when lf.trace throws", async () => {
    vi.mocked(getLangfuseClient).mockReturnValue(mockLf as any);
    mockLf.trace.mockImplementationOnce(() => { throw new Error("lf crash"); });
    expect(() => mirrorFeedbackBundleToLangfuse({ traceId: "t3" } as any)).not.toThrow();
    await new Promise((r) => setTimeout(r, 10));
  });
});
