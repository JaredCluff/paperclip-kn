import { describe, expect, it } from "vitest";
import { documents } from "@paperclipai/db";

describe("documents schema", () => {
  it("has kind column", () => {
    expect(documents.kind).toBeDefined();
  });

  it("has sourceIssueId column", () => {
    expect(documents.sourceIssueId).toBeDefined();
  });
});
