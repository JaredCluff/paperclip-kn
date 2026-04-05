import { describe, expect, it, vi, afterEach } from "vitest";

const mockTrace = vi.hoisted(() => ({ event: vi.fn() }));
const mockLf = vi.hoisted(() => ({
  trace: vi.fn().mockReturnValue(mockTrace),
  flushAsync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../langfuse.js", () => ({
  getLangfuseClient: vi.fn().mockReturnValue(mockLf),
}));

import { trackIssueStateTransition } from "../services/issue-lifecycle-langfuse.js";
import { getLangfuseClient } from "../langfuse.js";

describe("trackIssueStateTransition", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when Langfuse is not configured", async () => {
    vi.mocked(getLangfuseClient).mockReturnValue(null);
    trackIssueStateTransition({
      issueId: "i1", companyId: "c1",
      fromStatus: "todo", toStatus: "in_progress",
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(mockLf.trace).not.toHaveBeenCalled();
  });

  it("emits a trace event on status transition", async () => {
    vi.mocked(getLangfuseClient).mockReturnValue(mockLf as any);
    trackIssueStateTransition({
      issueId: "i2", companyId: "c2",
      fromStatus: "todo", toStatus: "done",
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(mockLf.trace).toHaveBeenCalledWith(
      expect.objectContaining({ id: "i2", name: "paperclip.issue" })
    );
    expect(mockTrace.event).toHaveBeenCalledWith(
      expect.objectContaining({ name: "issue.done" })
    );
  });

  it("does not throw when lf.trace throws", async () => {
    vi.mocked(getLangfuseClient).mockReturnValue(mockLf as any);
    mockLf.trace.mockImplementationOnce(() => { throw new Error("crash"); });
    expect(() => trackIssueStateTransition({
      issueId: "i3", companyId: "c3",
      fromStatus: "in_progress", toStatus: "cancelled",
    })).not.toThrow();
    await new Promise((r) => setTimeout(r, 10));
  });
});
