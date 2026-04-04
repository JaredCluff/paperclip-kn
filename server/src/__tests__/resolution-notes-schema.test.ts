import { describe, expect, it } from "vitest";
import { issues } from "@paperclipai/db";

describe("issues schema", () => {
  it("has resolutionNotes column", () => {
    expect(issues.resolutionNotes).toBeDefined();
  });
});
