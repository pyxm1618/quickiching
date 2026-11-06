import { readFileSync } from "node:fs";
import path from "node:path";
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
  authErrorMessage,
  runAuthRequest,
  toAbsoluteAuthURL,
} from "./auth-form";

const authFormPath = path.resolve(process.cwd(), "src/components/auth/auth-form.tsx");
const source = readFileSync(authFormPath, "utf8");

describe("shared passwordless AuthForm", () => {
  it("uses the existing Better Auth API surface without a separate registration backend", () => {
    expect(mocks.createAuthClient).toHaveBeenCalledWith(expect.objectContaining({
      basePath: "/api/auth",
    }));
    expect(source).toContain('provider: "google"');
    expect(source).toContain("authClient.signIn.magicLink");
    expect(source).not.toMatch(/signUp\.social|signUp\.magicLink|signUpGoogle|signUpMagicLink/);
  });

  it("converts validated same-origin callbacks to absolute URLs for Better Auth", () => {
    expect(toAbsoluteAuthURL(
      "/methods/mei-hua-yi-shu?session=cast-1#reading-free",
      "https://staging.quickiching.com",
    )).toBe("https://staging.quickiching.com/methods/mei-hua-yi-shu?session=cast-1#reading-free");
    expect(() => toAbsoluteAuthURL(
      "https://example.com/escape",
      "https://staging.quickiching.com",
    )).toThrow("AUTH_CALLBACK_INVALID");
  });

  it("renders Google first, then email, with no password UI", () => {
    const googleIndex = source.indexOf("copy.continueGoogle");
    const emailIndex = source.indexOf("copy.continueEmail");

    expect(googleIndex).toBeGreaterThanOrEqual(0);
    expect(emailIndex).toBeGreaterThan(googleIndex);
    expect(source).toContain("Enter your email address");
    expect(source).not.toMatch(/type="password"|forgot password|reset password|confirm password/i);
  });

  it("contains explicit loading, sent, accessibility, and recovery states", () => {
    expect(source).toContain("copy.connectingGoogle");
    expect(source).toContain("copy.sending");
    expect(source).toContain("copy.checkEmail");
    expect(source).toContain('role="alert"');
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain("Request a new sign-in link");
    expect(source).toContain("copy.sendNewLink");
  });

  it("maps internal Magic Link errors without exposing internal codes", () => {
    const mapped = authErrorMessage("INVALID_TOKEN");
    expect(mapped).toEqual({
      message: "For your security, sign-in links are only valid for a limited time.",
      requestNewLink: true,
    });
    expect(mapped?.message).not.toContain("INVALID_TOKEN");
  });

  it("maps OAuth linking conflicts without exposing an internal error code", () => {
    const mapped = authErrorMessage("account_not_linked");
    expect(mapped?.message).toContain("Quick I Ching account");
    expect(mapped?.message).not.toContain("account_not_linked");
    expect(mapped?.requestNewLink).toBe(false);
  });

  it("shows the full email from the immediately preceding successful form submission", () => {
    expect(source).toContain("setSentEmail(email.trim())");
    expect(source).not.toContain("maskAuthEmail");
  });

  it("does not add an automatic resend-email capability", () => {
    expect(source).not.toMatch(/resend email/i);
    expect(source).toContain("setNewLinkMode(true)");
    expect(source).toContain("authClient.signIn.magicLink");
  });

  it("turns rejected and Better Auth error results into generic request failures", async () => {
    await expect(runAuthRequest(async () => {
      throw new Error("provider secret must not escape");
    })).resolves.toBe(false);
    await expect(runAuthRequest(async () => ({ error: { code: "SECRET" } }))).resolves.toBe(false);
    await expect(runAuthRequest(async () => ({ error: null }))).resolves.toBe(true);
  });
});
