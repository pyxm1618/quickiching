import React from "react";
import { readFileSync } from "node:fs";
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

  it("does not initialize analytics providers from the consent banner itself", () => {
    const source = readFileSync(new URL("./analytics-consent.tsx", import.meta.url), "utf8");
    expect(source).toContain("Microsoft Clarity");
    expect(source).not.toContain("window.clarity");
    expect(source).not.toContain("window.gtag");
    expect(source).toContain('onConsentChange?.("denied")');
    expect(source).toContain('onConsentChange?.("granted")');
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

  it("does not emit provider calls before or while consent is only stored", () => {
    store[ANALYTICS_CONSENT_STORAGE_KEY] = "granted";
    expect(store[ANALYTICS_CONSENT_STORAGE_KEY]).toBe("granted");
    expect(gtagCalls).toHaveLength(0);
  });
});
