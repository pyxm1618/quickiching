import { describe, expect, it } from "vitest";
import {
  buildPricingHref,
  buildPricingSigninHref,
  buildResultSigninHref,
} from "./commercial-navigation";

describe("commercial flow navigation", () => {
  const reading = "/readings/three-coin/result?session=24aaac9c-1107-4c83-bd50-1ea3c7758fde";

  it("uses the existing signin callbackURL contract for a reading result", () => {
    const href = buildResultSigninHref(reading);
    const url = new URL(href, "https://www.quickiching.com");

    expect(url.pathname).toBe("/signin");
    expect(url.searchParams.get("callbackURL")).toBe(reading);
    expect(url.searchParams.has("callbackUrl")).toBe(false);
  });

  it("preserves the current reading when opening pricing", () => {
    const href = buildPricingHref(reading);
    const url = new URL(href, "https://www.quickiching.com");

    expect(url.pathname).toBe("/pricing");
    expect(url.searchParams.get("returnUrl")).toBe(reading);
  });

  it("preserves pricing returnUrl through the authentication gate", () => {
    const href = buildPricingSigninHref(reading);
    const url = new URL(href, "https://www.quickiching.com");
    const callback = url.searchParams.get("callbackURL");

    expect(url.pathname).toBe("/signin");
    expect(callback).toBe(`/pricing?returnUrl=${encodeURIComponent(reading)}`);
  });
});
