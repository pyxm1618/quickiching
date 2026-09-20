import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
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

import {
  AuthForm,
  authErrorMessage,
  maskAuthEmail,
  runAuthRequest,
} from "./auth-form";

describe("shared passwordless AuthForm", () => {
  it("uses the existing Better Auth API surface without a separate registration backend", () => {
    expect(mocks.createAuthClient).toHaveBeenCalledWith(expect.objectContaining({
      basePath: "/api/auth",
    }));
  });

  it("renders Google first, then email, with no password UI", () => {
    const html = renderToStaticMarkup(
      <AuthForm mode="signin" callbackURL="/history" />,
    );
    const googleIndex = html.indexOf("Continue with Google");
    const emailIndex = html.indexOf("Continue with email");

    expect(googleIndex).toBeGreaterThanOrEqual(0);
    expect(emailIndex).toBeGreaterThan(googleIndex);
    expect(html).toContain("you@example.com");
    expect(html).not.toMatch(/password/i);
  });

  it("uses the same provider UI for the sign-up intent", () => {
    const html = renderToStaticMarkup(
      <AuthForm mode="signup" callbackURL="/account" />,
    );
    expect(html).toContain("Continue with Google");
    expect(html).toContain("Continue with email");
    expect(html).not.toMatch(/create password|confirm password|forgot password/i);
  });

  it("maps internal Magic Link errors to a human recovery state", () => {
    const html = renderToStaticMarkup(
      <AuthForm mode="signin" callbackURL="/" initialErrorCode="INVALID_TOKEN" />,
    );
    expect(html).toContain("This sign-in link is no longer valid.");
    expect(html).toContain("Send a new link");
    expect(html).not.toContain("INVALID_TOKEN");
  });

  it("maps OAuth linking conflicts without exposing an internal error code", () => {
    const mapped = authErrorMessage("account_not_linked");
    expect(mapped?.message).toContain("Quick I Ching account");
    expect(mapped?.message).not.toContain("account_not_linked");
  });

  it("masks the email shown in the sent state", () => {
    expect(maskAuthEmail(" User.Name@Example.COM ")).toBe("u***@example.com");
  });

  it("turns rejected and Better Auth error results into generic request failures", async () => {
    await expect(runAuthRequest(async () => {
      throw new Error("provider secret must not escape");
    })).resolves.toBe(false);
    await expect(runAuthRequest(async () => ({ error: { code: "SECRET" } }))).resolves.toBe(false);
    await expect(runAuthRequest(async () => ({ error: null }))).resolves.toBe(true);
  });
});
