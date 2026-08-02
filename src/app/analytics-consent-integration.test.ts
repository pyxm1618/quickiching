import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const controllerPath = "src/components/analytics/analytics-consent.tsx";
const googleAnalyticsPath = "src/components/analytics/google-analytics.tsx";
const microsoftClarityPath = "src/components/analytics/microsoft-clarity.tsx";
const settingsButtonPath = "src/components/analytics/cookie-settings-button.tsx";

describe("optional analytics consent integration", () => {
  it("defines isolated analytics client components", () => {
    expect(existsSync(resolve(process.cwd(), controllerPath))).toBe(true);
    expect(existsSync(resolve(process.cwd(), googleAnalyticsPath))).toBe(true);
    expect(existsSync(resolve(process.cwd(), microsoftClarityPath))).toBe(true);
    expect(existsSync(resolve(process.cwd(), settingsButtonPath))).toBe(true);
  });

  it("loads GA and Clarity only from the granted consent branch", () => {
    if (!existsSync(resolve(process.cwd(), controllerPath))) return;

    const controller = source(controllerPath);
    expect(controller).toContain('consent === "granted"');
    expect(controller).toContain("<GoogleAnalytics");
    expect(controller).toContain("<MicrosoftClarity");
    expect(controller).toContain("parseAnalyticsConsent");
    expect(controller).toContain("serializeAnalyticsConsent");
    expect(controller).toContain("buildGoogleAnalyticsCookieDeletionStrings");
    expect(controller).toContain("buildClarityCookieDeletionStrings");
    expect(controller).toContain("Reject analytics");
    expect(controller).toContain("Accept analytics");
  });

  it("uses Google Consent Mode v2 while keeping all advertising consent denied", () => {
    if (!existsSync(resolve(process.cwd(), googleAnalyticsPath))) return;

    const googleAnalytics = source(googleAnalyticsPath);
    expect(googleAnalytics).toContain('from "next/script"');
    expect(googleAnalytics).toContain("analytics_storage");
    expect(googleAnalytics).toContain("ad_storage");
    expect(googleAnalytics).toContain("ad_user_data");
    expect(googleAnalytics).toContain("ad_personalization");
    expect(googleAnalytics).toContain("allow_google_signals");
    expect(googleAnalytics).toContain("allow_ad_personalization_signals");
    expect(googleAnalytics).toContain('"denied"');
    expect(googleAnalytics).toContain('"granted"');
  });

  it("uses the current Clarity Consent V2 API and denies advertising storage", () => {
    if (!existsSync(resolve(process.cwd(), microsoftClarityPath))) return;

    const clarity = source(microsoftClarityPath);
    expect(clarity).toContain('from "next/script"');
    expect(clarity).toContain("https://www.clarity.ms/tag/");
    expect(clarity).toContain('"consentv2"');
    expect(clarity).toContain("analytics_Storage");
    expect(clarity).toContain("ad_Storage");
    expect(clarity).toContain('analytics_Storage: "granted"');
    expect(clarity).toContain('ad_Storage: "denied"');
  });

  it("mounts consent globally and exposes persistent cookie settings", () => {
    const layout = source("src/app/layout.tsx");
    const footer = source("src/components/site-footer.tsx");

    expect(layout).toContain("AnalyticsConsentController");
    expect(footer).toContain("CookieSettingsButton");
    expect(footer).toContain("Cookie settings");
  });

  it("explicitly masks sensitive question, account, result, sign-in, and order content", () => {
    const sensitiveSources = [
      source("src/components/cast/question-step.tsx"),
      source("src/components/cast/reading-step.tsx"),
      source("src/app/result/[castingId]/page.tsx"),
      source("src/app/account/page.tsx"),
      source("src/app/signin/page.tsx"),
      source("src/components/checkout-status.tsx"),
    ];

    for (const content of sensitiveSources) {
      expect(content).toContain("data-clarity-mask");
    }
  });

  it("documents but never hardcodes public analytics identifiers", () => {
    const envExample = source(".env.example");
    const trackedSources = [
      envExample,
      source("src/app/layout.tsx"),
      source("src/components/site-footer.tsx"),
      existsSync(resolve(process.cwd(), controllerPath)) ? source(controllerPath) : "",
      existsSync(resolve(process.cwd(), googleAnalyticsPath)) ? source(googleAnalyticsPath) : "",
      existsSync(resolve(process.cwd(), microsoftClarityPath)) ? source(microsoftClarityPath) : "",
      existsSync(resolve(process.cwd(), settingsButtonPath)) ? source(settingsButtonPath) : "",
    ].join("\n");

    expect(envExample).toContain("NEXT_PUBLIC_GA_MEASUREMENT_ID=");
    expect(envExample).toContain("NEXT_PUBLIC_CLARITY_PROJECT_ID=");
    expect(trackedSources).not.toContain("G-WNMZ8YWC3B");
    expect(trackedSources).not.toContain("xvz3gv8ics");
  });
});
