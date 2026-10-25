import { describe, expect, it, vi } from "vitest";
import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  getAnalyticsConfig,
  readStoredAnalyticsConsent,
  analyticsProvidersAllowed,
} from "./analytics";

describe("getAnalyticsConfig", () => {
  it("keeps analytics disabled outside production when public IDs are absent", () => {
    expect(getAnalyticsConfig({})).toEqual({
      gaMeasurementId: null,
      clarityProjectId: null,
    });
    expect(getAnalyticsConfig({ VERCEL_ENV: "preview" })).toEqual({
      gaMeasurementId: null,
      clarityProjectId: null,
    });
  });

  it("activates the reviewed Quick I Ching IDs on Vercel production", () => {
    expect(getAnalyticsConfig({ VERCEL_ENV: "production" })).toEqual({
      gaMeasurementId: "G-NLFCDYQSJQ",
      clarityProjectId: "xvz3gv8ics",
    });
  });

  it("ignores stale public env overrides on the canonical production site", () => {
    expect(
      getAnalyticsConfig({
        VERCEL_ENV: "production",
        NEXT_PUBLIC_GA_MEASUREMENT_ID: "G-WNMZ8YWC3B",
        NEXT_PUBLIC_CLARITY_PROJECT_ID: "stale-project",
      }),
    ).toEqual({
      gaMeasurementId: "G-NLFCDYQSJQ",
      clarityProjectId: "xvz3gv8ics",
    });
  });

  it("accepts valid explicit GA4 and Clarity IDs outside production", () => {
    expect(
      getAnalyticsConfig({
        VERCEL_ENV: "preview",
        NEXT_PUBLIC_GA_MEASUREMENT_ID: "G-ABC123XYZ",
        NEXT_PUBLIC_CLARITY_PROJECT_ID: "abc123xyz",
      }),
    ).toEqual({
      gaMeasurementId: "G-ABC123XYZ",
      clarityProjectId: "abc123xyz",
    });
  });

  it("fails fast on an unsafe or malformed GA4 ID outside production", () => {
    expect(() =>
      getAnalyticsConfig({ NEXT_PUBLIC_GA_MEASUREMENT_ID: "<script>" }),
    ).toThrow("NEXT_PUBLIC_GA_MEASUREMENT_ID has an invalid format");
  });

  it("fails fast on an unsafe Clarity project ID outside production", () => {
    expect(() =>
      getAnalyticsConfig({ NEXT_PUBLIC_CLARITY_PROJECT_ID: "abc123';alert(1)" }),
    ).toThrow("NEXT_PUBLIC_CLARITY_PROJECT_ID has an invalid format");
  });
});

describe("analytics consent storage contract", () => {
  it("uses the approved storage key and values", () => {
    expect(ANALYTICS_CONSENT_STORAGE_KEY).toBe("quickiching:analytics-consent:v1");
  });

  it("reads granted and denied from localStorage safely", () => {
    const store: Record<string, string> = {};
    const mockStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => {
        store[key] = val;
      },
    };

    vi.stubGlobal("window", { localStorage: mockStorage });

    expect(readStoredAnalyticsConsent()).toBeNull();

    store[ANALYTICS_CONSENT_STORAGE_KEY] = "granted";
    expect(readStoredAnalyticsConsent()).toBe("granted");

    store[ANALYTICS_CONSENT_STORAGE_KEY] = "denied";
    expect(readStoredAnalyticsConsent()).toBe("denied");

    store[ANALYTICS_CONSENT_STORAGE_KEY] = "invalid";
    expect(readStoredAnalyticsConsent()).toBeNull();

    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("SecurityError");
        },
      },
    });
    expect(readStoredAnalyticsConsent()).toBeNull();

    vi.unstubAllGlobals();
  });
});


describe("analytics provider consent gate", () => {
  it("initializes providers only after explicit stored grant", () => {
    expect(analyticsProvidersAllowed(null)).toBe(false);
    expect(analyticsProvidersAllowed("denied")).toBe(false);
    expect(analyticsProvidersAllowed("granted")).toBe(true);
  });
});
