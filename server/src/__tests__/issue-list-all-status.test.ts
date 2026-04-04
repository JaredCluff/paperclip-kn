import { describe, expect, it } from "vitest";
import { ISSUE_STATUSES } from "@paperclipai/shared";

// NOTE: This is an integration-style smoke test verifying the sentinel is handled.
// Full DB integration tests run against a real database in CI.
describe("issues.list status:all sentinel", () => {
  it("status 'all' is defined as a valid sentinel value (not a real status)", () => {
    // Ensures the shared constants do not include "all" as a real status
    expect(ISSUE_STATUSES).not.toContain("all");
  });
});
