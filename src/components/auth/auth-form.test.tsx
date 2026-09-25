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
  maskAuthEmail,
  runAuthRequest,
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

  it("renders Google first, then email, with no password UI", () => {
    const googleIndex = source.indexOf("copy.continueGoogle") !== -1
      ? source.indexOf("copy.continueGoogle")
      : source.indexOf("Continue with Google");
    const emailIndex = source.indexOf("copy.continueEmail") !== -1
      ? source.indexOf("copy.continueEmail")
      : source.indexOf("Continue with email");

    expect(googleIndex).toBeGreaterThanOrEqual(0);
    expect(emailIndex).toBeGreaterThan(googleIndex);
    expect(source).toContain("you@example.com");
    expect(source).not.toMatch(/type="password"|forgot password|reset password|confirm password/i);
  });

  it("contains explicit loading, sent, accessibility, and recovery states", () => {
    expect(source.includes("Connecting to Google…") || source.includes("copy.connectingGoogle")).toBe(true);
    expect(source.includes("Sending…") || source.includes("copy.sending")).toBe(true);
    expect(source.includes("Check your email") || source.includes("copy.checkEmail")).toBe(true);
    expect(source.includes("The link expires in 10 minutes.") || source.includes("copy.expires")).toBe(true);
    expect(source).toContain('role="alert"');
    expect(source).toContain('aria-live="polite"');
    expect(source.includes("Send a new link") || source.includes("copy.sendNewLink")).toBe(true);
  });

  it("maps internal Magic Link errors without exposing internal codes", () => {
    const mapped = authErrorMessage("INVALID_TOKEN");
    expect(mapped).toEqual({
      message: "This sign-in link is no longer valid. Request a new link and try again.",
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
