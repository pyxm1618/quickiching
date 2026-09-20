import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appRoot = new URL(".", import.meta.url).pathname;
const signinSource = readFileSync(`${appRoot}signin/page.tsx`, "utf8");
const signupSource = readFileSync(`${appRoot}signup/page.tsx`, "utf8");
const sharedAuthSource = readFileSync(
  new URL("../../components/auth/auth-form.tsx", import.meta.url),
  "utf8",
);

describe("Authentication intent pages", () => {
  it("keeps Sign in and Sign up as UI intents over the same shared AuthForm", () => {
    expect(signinSource).toContain('<AuthForm mode="signin"');
    expect(signupSource).toContain('<AuthForm mode="signup"');
    expect(signinSource).toContain("Sign in to Quick I Ching");
    expect(signupSource).toContain("Sign up for Quick I Ching");
  });

  it("provides reciprocal Sign in and Sign up navigation while preserving callback context", () => {
    expect(signinSource).toContain("New to Quick I Ching?");
    expect(signinSource).toContain("/signup?callbackURL=");
    expect(signupSource).toContain("Already have an account?");
    expect(signupSource).toContain("/signin?callbackURL=");
  });

  it("uses only Google and email Magic Link, with Google presented first", () => {
    const googleIndex = sharedAuthSource.indexOf("Continue with Google");
    const emailIndex = sharedAuthSource.indexOf("Continue with email");
    expect(googleIndex).toBeGreaterThanOrEqual(0);
    expect(emailIndex).toBeGreaterThan(googleIndex);
    expect(sharedAuthSource).not.toMatch(/type="password"|forgot password|reset password|confirm password/i);
  });

  it("contains explicit loading, sent, and visible error states", () => {
    expect(sharedAuthSource).toContain("Connecting to Google…");
    expect(sharedAuthSource).toContain("Sending…");
    expect(sharedAuthSource).toContain("Check your email");
    expect(sharedAuthSource).toContain("The link expires in 10 minutes.");
    expect(sharedAuthSource).toContain('role="alert"');
    expect(sharedAuthSource).toContain('aria-live="polite"');
  });

  it("uses existing Terms and Privacy routes only on Sign up", () => {
    expect(signupSource).toContain('href="/terms"');
    expect(signupSource).toContain('href="/privacy"');
  });
});
