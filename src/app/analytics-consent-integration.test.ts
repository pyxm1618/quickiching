import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const controllerPath = "src/components/analytics/analytics-consent.tsx";
const googleAnalyticsPath = "src/components/analytics/google-analytics.tsx";
const settingsButtonPath = "src/components/analytics/cookie-settings-button.tsx";

describe("GA4 consent integration", () => {
  it("defines the three isolated analytics client components", () => {
    expect(existsSync(resolve(process.cwd(), controllerPath))).toBe(true);
    expect(existsSync(resolve(process.cwd(), googleAnalyticsPath))).toBe(true);
    expect(existsSync(resolve(process.cwd(), settingsButtonPath))).toBe(true);
  });

  it("loads GA only from the granted consent branch", () => {
    if (!existsSync(resolve(process.cwd(), controllerPath))) return;

    const controller = source(controllerPath);
    expect(controller).toContain('consent === "granted"');
    expect(controller).toContain("<GoogleAnalytics");
    expect(controller).toContain("parseAnalyticsConsent");
    expect(controller).toContain("serializeAnalyticsConsent");
    expect(controller).toContain("buildGoogleAnalyticsCookieDeletionStrings");
    expect(controller).toContain("Reject analytics");
    expect(controller).toContain("Accept analytics");
  });

  it("uses Consent Mode v2 while keeping all advertising consent denied", () => {
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

  it("mounts consent globally and exposes persistent cookie settings", () => {
    const layout = source("src/app/layout.tsx");
    const footer = source("src/components/site-footer.tsx");

    expect(layout).toContain("AnalyticsConsentController");
    expect(footer).toContain("CookieSettingsButton");
    expect(footer).toContain("Cookie settings");
  });

  it("documents but never hardcodes the public measurement ID", () => {
    const envExample = source(".env.example");
    const trackedSources = [
      envExample,
      source("src/app/layout.tsx"),
      source("src/components/site-footer.tsx"),
      existsSync(resolve(process.cwd(), controllerPath)) ? source(controllerPath) : "",
      existsSync(resolve(process.cwd(), googleAnalyticsPath)) ? source(googleAnalyticsPath) : "",
      existsSync(resolve(process.cwd(), settingsButtonPath)) ? source(settingsButtonPath) : "",
    ].join("\n");

    expect(envExample).toContain("NEXT_PUBLIC_GA_MEASUREMENT_ID=");
    expect(trackedSources).not.toContain("G-WNMZ8YWC3B");
  });
});
