import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useEffect: () => {},
  useRef: () => ({ current: null }),
  useState: (initial: unknown) => [initial, vi.fn()],
}));
vi.mock("swr", () => ({ default: () => ({ isLoading: false }) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/account" }));

import { UserNavControl } from "./user-nav-control";

function signOutHandler(node: React.ReactNode): (() => Promise<void>) | undefined {
  if (!React.isValidElement<{
    children?: React.ReactNode;
    role?: string;
    onClick?: () => Promise<void>;
  }>(node)) return;
  if (node.type === "button" && node.props.role === "menuitem") return node.props.onClick;
  for (const child of React.Children.toArray(node.props.children)) {
    const handler = signOutHandler(child);
    if (handler) return handler;
  }
}

describe("UserNavControl sign out request", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(["en", "zh-Hans"] as const)("sends valid JSON accepted by auth and returns to the %s home", async (locale) => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ success: true }));
    const assign = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("window", { location: { assign } });
    const handler = signOutHandler(UserNavControl({
      initialUser: { id: "staging-test-user", email: "test@example.com" },
      initialOpen: true,
      locale,
    }));
    expect(handler).toBeTypeOf("function");
    await handler!();
    const [url, request] = fetch.mock.calls[0];
    expect(url).toBe("/api/auth/sign-out");
    expect(request.method).toBe("POST");
    expect(request.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(request.body)).toEqual({});
    expect(assign).toHaveBeenCalledWith(locale === "en" ? "/" : "/zh");
  });
});
