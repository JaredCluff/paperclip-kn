import { describe, expect, it, vi } from "vitest";

vi.mock("../middleware/logger.js", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@paperclipai/db", () => ({
  documents: {},
  issues: {},
  and: vi.fn(),
  eq: vi.fn(),
  gte: vi.fn(),
  inArray: vi.fn(),
  sql: vi.fn(),
}));

vi.mock("../services/documents.js", () => ({
  documentService: vi.fn(() => ({
    updateRunbookRevision: vi.fn().mockResolvedValue({}),
  })),
}));

vi.mock("../services/runbook-review.js", () => ({
  enqueueRunbookReview: vi.fn().mockResolvedValue(undefined),
}));

describe("runbook-pattern-sweep", () => {
  it("exports runRunbookPatternSweep", async () => {
    const mod = await import("../services/runbook-pattern-sweep.js");
    expect(typeof mod.runRunbookPatternSweep).toBe("function");
  });
});
