import { describe, expect, it } from "vitest";
import { LIVE_EVENT_TYPES } from "@paperclipai/shared/constants";

describe("runbook live event types", () => {
  it("includes document.runbook.created", () => {
    expect(LIVE_EVENT_TYPES).toContain("document.runbook.created");
  });

  it("includes document.runbook.updated", () => {
    expect(LIVE_EVENT_TYPES).toContain("document.runbook.updated");
  });
});
