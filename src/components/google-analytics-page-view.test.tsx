import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ANALYTICS_CONSENT_STORAGE_KEY } from "@/lib/analytics";

let currentPathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
}));

import { GoogleAnalyticsPageView } from "./google-analytics-page-view";

describe("GoogleAnalyticsPageView", () => {
  let store: Record<string, string> = {};
  let gtagCalls: unknown[][] = [];

  beforeEach(() => {
    store = {};
    gtagCalls = [];
    currentPathname = "/";
    vi.stubGlobal("window", {
      location: { href: "https://www.quickiching.com/" },
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
    vi.stubGlobal("document", { title: "Quick I Ching" });
  });

  it("exports a valid React component", () => {
    expect(typeof GoogleAnalyticsPageView).toBe("function");
    const html = renderToStaticMarkup(
      <GoogleAnalyticsPageView measurementId="G-NLFCDYQSJQ" />,
    );
    expect(html).toBe("");
  });
});
