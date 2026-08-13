import { describe, expect, it } from "vitest";
import { getAnalyticsConfig } from "./analytics";

describe("getAnalyticsConfig", () => {
  it("keeps analytics disabled when public IDs are absent", () => {
    expect(getAnalyticsConfig({})).toEqual({
      gaMeasurementId: null,
      clarityProjectId: null,
    });
  });

  it("accepts valid GA4 and Clarity IDs", () => {
    expect(
      getAnalyticsConfig({
        NEXT_PUBLIC_GA_MEASUREMENT_ID: "G-ABC123XYZ",
        NEXT_PUBLIC_CLARITY_PROJECT_ID: "abc123xyz",
      }),
    ).toEqual({
      gaMeasurementId: "G-ABC123XYZ",
      clarityProjectId: "abc123xyz",
    });
  });

  it("fails fast on an unsafe or malformed GA4 ID", () => {
    expect(() =>
      getAnalyticsConfig({ NEXT_PUBLIC_GA_MEASUREMENT_ID: "<script>" }),
    ).toThrow("NEXT_PUBLIC_GA_MEASUREMENT_ID has an invalid format");
  });

  it("fails fast on an unsafe Clarity project ID", () => {
    expect(() =>
      getAnalyticsConfig({ NEXT_PUBLIC_CLARITY_PROJECT_ID: "abc123';alert(1)" }),
    ).toThrow("NEXT_PUBLIC_CLARITY_PROJECT_ID has an invalid format");
  });
});
