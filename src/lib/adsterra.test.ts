import { describe, expect, it } from "vitest";
import { ADSTERRA_RESULT_UNIT, isAdsterraEnabled } from "./adsterra";

describe("Adsterra result ad configuration", () => {
  it("enables deployed environments by default while local development stays off", () => {
    expect(isAdsterraEnabled({ VERCEL_ENV: "production" })).toBe(true);
    expect(isAdsterraEnabled({ VERCEL_ENV: "preview" })).toBe(true);
    expect(isAdsterraEnabled({ VERCEL_ENV: "development" })).toBe(false);
    expect(isAdsterraEnabled({})).toBe(false);
  });

  it("allows an explicit emergency override", () => {
    expect(isAdsterraEnabled({ VERCEL_ENV: "production", NEXT_PUBLIC_ADSTERRA_ENABLED: "false" })).toBe(false);
    expect(isAdsterraEnabled({ VERCEL_ENV: "development", NEXT_PUBLIC_ADSTERRA_ENABLED: " true " })).toBe(true);
  });

  it("pins the reviewed native unit", () => {
    expect(ADSTERRA_RESULT_UNIT.scriptUrl).toBe(
      "https://pl30822164.effectivecpmnetwork.com/98a6d22e22a68bd3f38e4eedda19cd18/invoke.js",
    );
    expect(ADSTERRA_RESULT_UNIT.containerId).toBe("container-98a6d22e22a68bd3f38e4eedda19cd18");
  });
});
