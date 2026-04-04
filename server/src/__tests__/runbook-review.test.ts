import { describe, expect, it, vi } from "vitest";

vi.mock("../middleware/logger.js", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("../services/issues.js", () => ({
  issueService: vi.fn(() => ({
    create: vi.fn().mockResolvedValue({}),
  })),
}));

vi.mock("@paperclipai/db", () => ({
  agents: {},
  projects: {},
  and: vi.fn(),
  eq: vi.fn(),
  or: vi.fn(),
}));

describe("enqueueRunbookReview", () => {
  it("is exported from runbook-review.ts", async () => {
    const mod = await import("../services/runbook-review.js");
    expect(typeof mod.enqueueRunbookReview).toBe("function");
  });
});
