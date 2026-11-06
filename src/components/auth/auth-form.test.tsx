import { readFileSync } from "node:fs";
import path from "node:path";
import type { ReactElement, ReactNode } from "react";
import { isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const stateHarness = vi.hoisted(() => {
  let values: unknown[] = [];
  let cursor = 0;

  return {
    beginRender() {
      cursor = 0;
    },
    reset() {
      values = [];
      cursor = 0;
    },
    useState<T>(initialState: T | (() => T)) {
      const index = cursor++;
      if (index >= values.length) {
        values[index] = typeof initialState === "function"
          ? (initialState as () => T)()
          : initialState;
      }

      const setState = (next: T | ((previous: T) => T)) => {
        const previous = values[index] as T;
        values[index] = typeof next === "function"
          ? (next as (previous: T) => T)(previous)
          : next;
      };

      return [values[index] as T, setState] as const;
    },
  };
});

const mocks = vi.hoisted(() => ({
  createAuthClient: vi.fn((_options: unknown) => ({
    signIn: {
      magicLink: async () => ({ error: null }),
      social: async () => ({ error: null, data: null }),
    },
  })),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: stateHarness.useState,
  };
});

vi.mock("better-auth/client", () => ({
  createAuthClient: mocks.createAuthClient,
}));
vi.mock("better-auth/client/plugins", () => ({ magicLinkClient: () => ({}) }));

import {
  AuthForm,
  authErrorMessage,
  runAuthRequest,
  toAbsoluteAuthURL,
} from "./auth-form";

const authFormPath = path.resolve(process.cwd(), "src/components/auth/auth-form.tsx");
const source = readFileSync(authFormPath, "utf8");

function renderAuthForm(props: Parameters<typeof AuthForm>[0]) {
  stateHarness.beginRender();
  return AuthForm(props);
}

function nodeText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (!isValidElement(node)) return "";

  return nodeText((node.props as { children?: ReactNode }).children);
}

function findElement(
  root: ReactNode,
  predicate: (element: ReactElement<Record<string, unknown>>) => boolean,
): ReactElement<Record<string, unknown>> {
  let found: ReactElement<Record<string, unknown>> | null = null;

  function visit(node: ReactNode) {
    if (found || node === null || node === undefined || typeof node === "boolean") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!isValidElement(node)) return;

    const element = node as ReactElement<Record<string, unknown>>;
    if (predicate(element)) {
      found = element;
      return;
    }
    visit((element.props as { children?: ReactNode }).children);
  }

  visit(root);
  if (!found) throw new Error("Expected AuthForm element was not rendered");
  return found;
}

function findElementByText(root: ReactNode, text: string) {
  return findElement(root, (element) => {
    const children = (element.props as { children?: ReactNode }).children;
    return nodeText(children) === text;
  });
}

function findElementByType(root: ReactNode, type: string) {
  return findElement(root, (element) => element.type === type);
}

beforeEach(() => {
  stateHarness.reset();
});

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

  it("restores the normal sign-in form when Back to sign in is clicked from an invalid-token error", () => {
    const callbackURL = "/methods/three-coin?session=cast-1#reading-free";
    let view = renderAuthForm({
      mode: "signin",
      callbackURL,
      initialErrorCode: "invalid_token",
    });

    expect(nodeText(view)).toContain("This sign-in link is no longer valid");
    const backToSignIn = findElementByText(view, "Back to sign in");
    expect(backToSignIn.props.href).toBe(
      "/signin?callbackURL=" + encodeURIComponent(callbackURL),
    );
    expect(String(backToSignIn.props.href)).not.toContain("error=");
    expect(typeof backToSignIn.props.onClick).toBe("function");

    (backToSignIn.props.onClick as () => void)();
    view = renderAuthForm({
      mode: "signin",
      callbackURL,
      initialErrorCode: "invalid_token",
    });

    const restoredText = nodeText(view);
    expect(restoredText).not.toContain("This sign-in link is no longer valid");
    expect(restoredText).toContain("Sign in to Quick I Ching");
    expect(restoredText).toContain("Continue with Google");
    expect(restoredText).toContain("Email address");
    expect(restoredText).toContain("Send sign-in link");
    expect(restoredText).not.toContain("Send a new link");

    const emailInput = findElementByType(view, "input");
    expect(emailInput.props.id).toBe("signin-email");
    expect(emailInput.props.value).toBe("");
  });

  it("keeps Request a new sign-in link in explicit new-link recovery mode", () => {
    const callbackURL = "/account";
    let view = renderAuthForm({
      mode: "signin",
      callbackURL,
      initialErrorCode: "invalid_token",
    });

    const requestNewLink = findElementByText(view, "Request a new sign-in link");
    expect(typeof requestNewLink.props.onClick).toBe("function");
    (requestNewLink.props.onClick as () => void)();

    view = renderAuthForm({
      mode: "signin",
      callbackURL,
      initialErrorCode: "invalid_token",
    });

    const recoveryText = nodeText(view);
    expect(recoveryText).toContain("Sign in to Quick I Ching");
    expect(recoveryText).toContain("Email address");
    expect(recoveryText).toContain("Send a new link");
    expect(recoveryText).not.toContain("Send sign-in link");
    expect(findElementByType(view, "input").props.id).toBe("signin-email");
  });

  it("restores the localized Chinese sign-in form without an English fallback", () => {
    const callbackURL = "/zh/readings";
    let view = renderAuthForm({
      mode: "signin",
      callbackURL,
      initialErrorCode: "invalid_token",
      locale: "zh-Hans",
    });

    const backToSignIn = findElementByText(view, "返回登录");
    expect(backToSignIn.props.href).toBe(
      "/zh/signin?callbackURL=" + encodeURIComponent(callbackURL),
    );
    expect(String(backToSignIn.props.href)).not.toContain("error=");
    (backToSignIn.props.onClick as () => void)();

    view = renderAuthForm({
      mode: "signin",
      callbackURL,
      initialErrorCode: "invalid_token",
      locale: "zh-Hans",
    });

    const restoredText = nodeText(view);
    expect(restoredText).toContain("登录 Quick I Ching");
    expect(restoredText).toContain("邮箱地址");
    expect(restoredText).toContain("发送登录链接");
    expect(restoredText).not.toContain("Sign in to Quick I Ching");
    expect(restoredText).not.toContain("Send a new link");
    expect(findElementByType(view, "input").props.id).toBe("signin-email");
  });

  it("turns rejected and Better Auth error results into generic request failures", async () => {
    await expect(runAuthRequest(async () => {
      throw new Error("provider secret must not escape");
    })).resolves.toBe(false);
    await expect(runAuthRequest(async () => ({ error: { code: "SECRET" } }))).resolves.toBe(false);
    await expect(runAuthRequest(async () => ({ error: null }))).resolves.toBe(true);
  });

});
