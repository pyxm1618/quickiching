import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const signinPath = path.resolve(process.cwd(), "src/app/(default)/signin/page.tsx");
const signupPath = path.resolve(process.cwd(), "src/app/(default)/signup/page.tsx");
const zhSigninPath = path.resolve(process.cwd(), "src/app/(localized)/zh/signin/page.tsx");
const zhSignupPath = path.resolve(process.cwd(), "src/app/(localized)/zh/signup/page.tsx");
const sharedAuthPath = path.resolve(process.cwd(), "src/components/auth/auth-form.tsx");
const sharedShellPath = path.resolve(process.cwd(), "src/components/auth/auth-shell.tsx");

const signinSource = readFileSync(signinPath, "utf8");
const signupSource = readFileSync(signupPath, "utf8");
const zhSigninSource = readFileSync(zhSigninPath, "utf8");
const zhSignupSource = readFileSync(zhSignupPath, "utf8");
const sharedAuthSource = readFileSync(sharedAuthPath, "utf8");
const sharedShellSource = readFileSync(sharedShellPath, "utf8");

describe("Authentication intent pages", () => {
  it("keeps Sign in and Sign up as UI intents over the same shared AuthForm and shell", () => {
    expect(signinSource).toContain('<AuthForm mode="signin"');
    expect(signupSource).toContain('<AuthForm mode="signup"');
    expect(signinSource).toContain("<AuthShell>");
    expect(signupSource).toContain("<AuthShell>");
    expect(sharedAuthSource).toContain("Sign in to Quick I Ching");
    expect(sharedAuthSource).toContain("Sign up for Quick I Ching");
  });

  it("keeps Chinese Sign in and Sign up on the same localized shared shell", () => {
    expect(zhSigninSource).toContain('<AuthShell locale="zh-Hans">');
    expect(zhSignupSource).toContain('<AuthShell locale="zh-Hans">');
    expect(zhSigninSource).toContain('locale="zh-Hans"');
    expect(zhSignupSource).toContain('locale="zh-Hans"');
  });

  it("provides reciprocal Sign in and Sign up navigation while preserving callback context", () => {
    expect(sharedAuthSource).toContain('const oppositeMode: AuthMode = formMode === "signin" ? "signup" : "signin"');
    expect(sharedAuthSource).toContain("authPageURL(oppositeMode, callbackURL, locale)");
  });

  it("uses only Google and email Magic Link, with Google presented first", () => {
    const googleIndex = sharedAuthSource.indexOf("copy.continueGoogle");
    const emailIndex = sharedAuthSource.indexOf("copy.continueEmail");
    expect(googleIndex).toBeGreaterThanOrEqual(0);
    expect(emailIndex).toBeGreaterThan(googleIndex);
    expect(sharedAuthSource).not.toMatch(/type="password"|forgot password|reset password|confirm password/i);
  });

  it("contains explicit loading, sent, and full-page error states", () => {
    expect(sharedAuthSource).toContain("copy.connectingGoogle");
    expect(sharedAuthSource).toContain("copy.sending");
    expect(sharedAuthSource).toContain("copy.checkEmail");
    expect(sharedAuthSource).toContain('role="alert"');
    expect(sharedAuthSource).toContain('aria-live="polite"');
    expect(sharedAuthSource).toContain("Request a new sign-in link");
  });

  it("keeps Terms and Privacy in Sign up while using existing routes", () => {
    expect(sharedAuthSource).toContain('prefix + "/terms"');
    expect(sharedAuthSource).toContain('prefix + "/privacy"');
  });

  it("uses the real project BrandMark and capability unavailable state", () => {
    expect(sharedShellSource).toContain("BrandMark");
    expect(sharedShellSource).toContain("Sign in is temporarily unavailable");
    expect(sharedShellSource).toContain("Sign up is temporarily unavailable");
  });
});
