import { describe, expect, it } from "vitest";

describe("resolution notes enforcement", () => {
  it("badRequest error has status 400 with correct message", async () => {
    const { badRequest } = await import("../errors.js");
    const err = badRequest("Resolution notes are required when closing or cancelling an issue.");
    expect(err.status).toBe(400);
    expect(err.message).toBe("Resolution notes are required when closing or cancelling an issue.");
  });
});
