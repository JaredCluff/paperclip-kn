import { describe, expect, it, vi, afterEach } from "vitest";

// We need to test createBetterAuthInstance behavior without actually
// connecting to a database. Use vi.mock for the betterAuth library.

const mockBetterAuth = vi.hoisted(() => vi.fn().mockReturnValue({}));
vi.mock("better-auth", () => ({ betterAuth: mockBetterAuth }));
vi.mock("better-auth/adapters/drizzle", () => ({ drizzleAdapter: vi.fn().mockReturnValue({}) }));
vi.mock("better-auth/node", () => ({ toNodeHandler: vi.fn() }));
vi.mock("@paperclipai/db", () => ({
  authAccounts: {}, authSessions: {}, authUsers: {}, authVerifications: {},
}));

import { createBetterAuthInstance } from "../auth/better-auth.js";
import type { Config } from "../config.js";

const localConfig = {
  deploymentMode: "local_trusted",
  deploymentExposure: "private",
  authBaseUrlMode: "detect",
  authPublicBaseUrl: undefined,
  authDisableSignUp: false,
  allowedHostnames: [],
} as unknown as Config;

const authConfig = {
  deploymentMode: "authenticated",
  deploymentExposure: "public",
  authBaseUrlMode: "explicit",
  authPublicBaseUrl: "https://example.com",
  authDisableSignUp: false,
  allowedHostnames: [],
} as unknown as Config;

describe("createBetterAuthInstance secret enforcement", () => {
  afterEach(() => {
    delete process.env.BETTER_AUTH_SECRET;
    delete process.env.PAPERCLIP_AGENT_JWT_SECRET;
  });

  it("allows dev fallback in local_trusted mode without BETTER_AUTH_SECRET", () => {
    expect(() => createBetterAuthInstance({} as any, localConfig)).not.toThrow();
  });

  it("throws in authenticated mode when BETTER_AUTH_SECRET is not set", () => {
    expect(() => createBetterAuthInstance({} as any, authConfig)).toThrow("BETTER_AUTH_SECRET");
  });

  it("does not throw in authenticated mode when BETTER_AUTH_SECRET is set", () => {
    process.env.BETTER_AUTH_SECRET = "super-secret-prod-key";
    expect(() => createBetterAuthInstance({} as any, authConfig)).not.toThrow();
  });

  it("does not throw in authenticated mode when PAPERCLIP_AGENT_JWT_SECRET is set", () => {
    process.env.PAPERCLIP_AGENT_JWT_SECRET = "legacy-secret";
    expect(() => createBetterAuthInstance({} as any, authConfig)).not.toThrow();
  });
});
