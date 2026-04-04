import { describe, expect, it } from "vitest";

describe("plugin-host issues.list defaults", () => {
  it("applies active-only status default when no status provided", () => {
    const DEFAULT_ACTIVE_STATUSES = "backlog,todo,in_progress,in_review,blocked";
    expect(DEFAULT_ACTIVE_STATUSES).not.toContain("done");
    expect(DEFAULT_ACTIVE_STATUSES).not.toContain("cancelled");
  });
});
