import { describe, expect, it } from "vitest";
import { ADSTERRA_RESULT_UNIT, isAdsterraEnabledValue } from "./adsterra";

describe("Adsterra result ad configuration", () => {
  it("stays disabled unless the normalized flag is exactly true", () => {
    expect(isAdsterraEnabledValue(undefined)).toBe(false);
    expect(isAdsterraEnabledValue("")).toBe(false);
    expect(isAdsterraEnabledValue("false")).toBe(false);
    expect(isAdsterraEnabledValue("1")).toBe(false);
    expect(isAdsterraEnabledValue(" true ")).toBe(true);
    expect(isAdsterraEnabledValue("TRUE")).toBe(true);
  });

  it("pins the reviewed single Adsterra unit", () => {
    expect(ADSTERRA_RESULT_UNIT).toEqual({
      scriptOrigin: "https://pl30822164.effectivecpmnetwork.com",
      scriptUrl: "https://pl30822164.effectivecpmnetwork.com/98a6d22e22a68bd3f38e4eedda19cd18/invoke.js",
      containerId: "container-98a6d22e22a68bd3f38e4eedda19cd18",
      scriptElementId: "adsterra-result-native-loader",
    });
  });
});
