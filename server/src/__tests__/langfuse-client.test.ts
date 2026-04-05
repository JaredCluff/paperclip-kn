import { afterEach, describe, expect, it } from "vitest";
import { _resetLangfuseClient, getLangfuseClient } from "../langfuse.js";

describe("getLangfuseClient", () => {
  afterEach(() => {
    _resetLangfuseClient();
    delete process.env.LANGFUSE_HOST;
    delete process.env.LANGFUSE_SECRET_KEY;
    delete process.env.LANGFUSE_PUBLIC_KEY;
  });

  it("returns null when env vars are not set", () => {
    const client = getLangfuseClient();
    expect(client).toBeNull();
  });

  it("returns null when only some env vars are set", () => {
    process.env.LANGFUSE_HOST = "http://localhost:3000";
    process.env.LANGFUSE_SECRET_KEY = "sk-test";
    // LANGFUSE_PUBLIC_KEY missing
    const client = getLangfuseClient();
    expect(client).toBeNull();
  });

  it("returns a client instance when all env vars are set", () => {
    process.env.LANGFUSE_HOST = "http://localhost:3000";
    process.env.LANGFUSE_SECRET_KEY = "sk-test";
    process.env.LANGFUSE_PUBLIC_KEY = "pk-test";
    const client = getLangfuseClient();
    expect(client).not.toBeNull();
  });

  it("returns the same singleton on repeated calls", () => {
    process.env.LANGFUSE_HOST = "http://localhost:3000";
    process.env.LANGFUSE_SECRET_KEY = "sk-test";
    process.env.LANGFUSE_PUBLIC_KEY = "pk-test";
    const a = getLangfuseClient();
    const b = getLangfuseClient();
    expect(a).toBe(b);
  });
});
