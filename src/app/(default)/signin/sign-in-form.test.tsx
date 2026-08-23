import { describe, expect, it, vi } from "vitest";

vi.mock("better-auth/client", () => ({
  createAuthClient: () => ({
    signIn: {
      magicLink: async () => ({ error: null }),
      social: async () => ({ error: null, data: null }),
    },
  }),
}));
vi.mock("better-auth/client/plugins", () => ({ magicLinkClient: () => ({}) }));

import { runAuthRequest } from "./sign-in-form";

describe("sign-in network boundary", () => {
  it("turns a rejected client request into a generic failure result", async () => {
    await expect(runAuthRequest(async () => {
      throw new Error("provider token and API key must not escape");
    })).resolves.toBe(false);
  });

  it("treats Better Auth error responses as generic failures", async () => {
    await expect(runAuthRequest(async () => ({ error: { message: "internal secret" } }))).resolves.toBe(false);
    await expect(runAuthRequest(async () => ({ error: null }))).resolves.toBe(true);
  });
});
