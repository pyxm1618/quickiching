import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAuthClient: vi.fn((_options: unknown) => ({
    signIn: {
      magicLink: async () => ({ error: null }),
      social: async () => ({ error: null, data: null }),
    },
  })),
}));

vi.mock("better-auth/client", () => ({
  createAuthClient: mocks.createAuthClient,
}));
vi.mock("better-auth/client/plugins", () => ({ magicLinkClient: () => ({}) }));

import { authErrorMessage, runAuthRequest } from "./sign-in-form";

describe("sign-in network boundary", () => {
  it("uses a client base path that is safe during server module evaluation", () => {
    expect(mocks.createAuthClient).toHaveBeenCalledWith(expect.objectContaining({
      basePath: "/api/auth",
    }));
    expect(mocks.createAuthClient.mock.calls[0]?.[0]).not.toHaveProperty("baseURL");
  });

  it("maps internal auth failures to user-facing recovery copy", () => {
    expect(authErrorMessage("INVALID_TOKEN")).toEqual({
      message: "For your security, sign-in links are only valid for a limited time.",
      requestNewLink: true,
    });
    expect(authErrorMessage("account_not_linked")).toEqual({
      message: "We couldn't connect that Google account to this Quick I Ching account. Try another sign-in method.",
      requestNewLink: false,
    });
  });

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
