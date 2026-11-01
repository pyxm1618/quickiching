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
    const googleIndex = source.indexOf("copy.continueGoogle") !== -1
      ? source.indexOf("copy.continueGoogle")
      : source.indexOf("Continue with Google");
    const emailIndex = source.indexOf(...[truncated]