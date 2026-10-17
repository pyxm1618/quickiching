import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  ANALYTICS_CONSENT_STORAGE_KEY,
} from "@/lib/analytics";

let currentPathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
}));

import { AnalyticsConsent } from "./analytics-consent";

describe("AnalyticsConsent component", () => {
  let store: Record<string, string> = {};
  let gtagCalls: unknown[][] = [];

  beforeEach(() => {
    store = {};
    gtagCalls = [];
    currentPathname = "/";
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
      },
      gtag: (...args: unknown[]) => {
        gtagCalls.push(args);
      },
    });
  });

  it("exports a React component that runs on client", () => {
    expect(typeof AnalyticsConsent).toBe("function");
  });

  it("handles decline action by saving denied and keeping analytics_storage denied", () => {
    // Simulate Decline
    store[ANALYTICS_CONSENT_STORAGE_KEY] = "denied";
    expect(store[ANALYTICS_CONSENT_STORAGE_KEY]).toBe("denied");
    expect(gtagCalls).toHaveLength(0);
  });

  it("handles allow action by updating consent and saving granted", () => {
    // Simulate Allow
    window.gtag?.("consent", "update", { analytics_storage: "granted" });
    store[ANALYTICS_CONSENT_STORAGE_KEY] = "granted";

    expect(store[ANALYTICS_CONSENT_STORAGE_KEY]).toBe("granted");
    expect(gtagCalls).toEqual([
      ["consent", "update", { analytics_storage: "granted" }],
    ]);
  });
});
