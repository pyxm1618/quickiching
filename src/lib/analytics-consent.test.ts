import { describe, expect, it } from "vitest";
import {
  ANALYTICS_CONSENT_COOKIE,
  buildClarityCookieDeletionStrings,
  buildGoogleAnalyticsCookieDeletionStrings,
  findClarityCookieNames,
  findGoogleAnalyticsCookieNames,
  isValidClarityProjectId,
  isValidGaMeasurementId,
  parseAnalyticsConsent,
  serializeAnalyticsConsent,
} from "@/lib/analytics-consent";
import {
  isValidAnalyticsEventName,
  sanitizeAnalyticsEventParams,
  trackAnalyticsEvent,
} from "@/lib/analytics";

describe("analytics consent policy", () => {
  it("parses only the two supported consent values", () => {
    expect(parseAnalyticsConsent(`other=1; ${ANALYTICS_CONSENT_COOKIE}=granted`)).toBe("granted");
    expect(parseAnalyticsConsent(`${ANALYTICS_CONSENT_COOKIE}=denied; other=1`)).toBe("denied");
    expect(parseAnalyticsConsent(`${ANALYTICS_CONSENT_COOKIE}=unexpected`)).toBe("unset");
    expect(parseAnalyticsConsent("")).toBe("unset");
  });

  it("serializes a first-party, site-wide, time-limited consent cookie", () => {
    expect(serializeAnalyticsConsent("granted", true)).toBe(
      `${ANALYTICS_CONSENT_COOKIE}=granted; Max-Age=15552000; Path=/; SameSite=Lax; Secure`,
    );
    expect(serializeAnalyticsConsent("denied", false)).toBe(
      `${ANALYTICS_CONSENT_COOKIE}=denied; Max-Age=15552000; Path=/; SameSite=Lax`,
    );
  });

  it("accepts only GA4 measurement IDs", () => {
    expect(isValidGaMeasurementId("G-WNMZ8YWC3B")).toBe(true);
    expect(isValidGaMeasurementId("G-ABC123")).toBe(true);
    expect(isValidGaMeasurementId("UA-12345-1")).toBe(false);
    expect(isValidGaMeasurementId("g-abc123")).toBe(false);
    expect(isValidGaMeasurementId(" G-ABC123 ")).toBe(false);
    expect(isValidGaMeasurementId(undefined)).toBe(false);
  });

  it("accepts only lowercase alphanumeric Clarity project IDs", () => {
    expect(isValidClarityProjectId("xvz3gv8ics")).toBe(true);
    expect(isValidClarityProjectId("abc12345")).toBe(true);
    expect(isValidClarityProjectId("ABC12345")).toBe(false);
    expect(isValidClarityProjectId("abc-12345")).toBe(false);
    expect(isValidClarityProjectId(" xv z3gv8ics ")).toBe(false);
    expect(isValidClarityProjectId(undefined)).toBe(false);
  });

  it("finds only Google Analytics first-party cookies", () => {
    expect(
      findGoogleAnalyticsCookieNames(
        "session=abc; _ga=GA1.1.1.1; _ga_WNMZ8YWC3B=GS1.1.1; qic_analytics_consent=granted",
      ),
    ).toEqual(["_ga", "_ga_WNMZ8YWC3B"]);
  });

  it("finds only Clarity first-party cookies", () => {
    expect(
      findClarityCookieNames(
        "session=abc; _clck=clarity-user; _clsk=clarity-session; MUID=third-party",
      ),
    ).toEqual(["_clck", "_clsk"]);
  });

  it("builds host-only and production-domain GA deletion strings", () => {
    const deletions = buildGoogleAnalyticsCookieDeletionStrings(
      "_ga=GA1.1.1.1; _ga_WNMZ8YWC3B=GS1.1.1",
      "www.quickiching.com",
      true,
    );

    expect(deletions).toContain(
      "_ga=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; SameSite=Lax; Secure",
    );
    expect(deletions).toContain(
      "_ga=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; SameSite=Lax; Domain=.quickiching.com; Secure",
    );
    expect(deletions.some((value) => value.includes("session="))).toBe(false);
  });

  it("builds host-only and production-domain Clarity deletion strings", () => {
    const deletions = buildClarityCookieDeletionStrings(
      "_clck=clarity-user; _clsk=clarity-session; session=abc",
      "www.quickiching.com",
      true,
    );

    expect(deletions).toContain(
      "_clck=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; SameSite=Lax; Secure",
    );
    expect(deletions).toContain(
      "_clsk=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; SameSite=Lax; Domain=.quickiching.com; Secure",
    );
    expect(deletions.some((value) => value.includes("session="))).toBe(false);
  });
});

describe("safe analytics event boundary", () => {
  it("accepts GA-compatible event names and rejects invalid names", () => {
    expect(isValidAnalyticsEventName("reading_started")).toBe(true);
    expect(isValidAnalyticsEventName("purchase")).toBe(true);
    expect(isValidAnalyticsEventName("Reading Started")).toBe(false);
    expect(isValidAnalyticsEventName("1_reading_started")).toBe(false);
    expect(isValidAnalyticsEventName(`a${"x".repeat(40)}`)).toBe(false);
  });

  it("keeps only allowlisted machine-readable parameters", () => {
    expect(
      sanitizeAnalyticsEventParams({
        method: "three_coin",
        scene: "career",
        status: "completed",
        currency: "USD",
        value: 2.99,
        quantity: 1,
        has_changing_lines: true,
        email: "person@example.com",
        question_text: "Should I leave my job?",
        arbitrary: "ignored",
      }),
    ).toEqual({
      method: "three_coin",
      scene: "career",
      status: "completed",
      currency: "USD",
      value: 2.99,
      quantity: 1,
      has_changing_lines: true,
    });
  });

  it("drops free-form strings even when the parameter key is allowlisted", () => {
    expect(
      sanitizeAnalyticsEventParams({
        scene: "I am worried about my job and my manager",
        reason_code: "generation_timeout",
        value: Number.NaN,
      }),
    ).toEqual({ reason_code: "generation_timeout" });
  });

  it("does not emit an event when gtag is unavailable", () => {
    expect(trackAnalyticsEvent("reading_started", { method: "three_coin" })).toBe(false);
  });
});
