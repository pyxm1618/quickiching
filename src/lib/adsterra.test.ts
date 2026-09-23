import { describe, expect, it } from "vitest";
import {
  ADSTERRA_RESULT_UNIT,
  isAdsterraRuntimeHost,
  resolveAdsterraEnabled,
} from "./adsterra";

describe("Adsterra result ad configuration", () => {
  it("enables production by default and keeps non-production environments off", () => {
    expect(resolveAdsterraEnabled({ nodeEnv: "production" })).toBe(true);
    expect(resolveAdsterraEnabled({ nodeEnv: "development" })).toBe(false);
    expect(resolveAdsterraEnabled({ nodeEnv: "test" })).toBe(false);
    expect(resolveAdsterraEnabled({ nodeEnv: undefined })).toBe(false);
  });

  it("honors the explicit public emergency override", () => {
    expect(resolveAdsterraEnabled({ nodeEnv: "production", publicFlag: "false" })).toBe(false);
    expect(resolveAdsterraEnabled({ nodeEnv: "development", publicFlag: " true " })).toBe(true);
    expect(resolveAdsterraEnabled({ nodeEnv: "production", publicFlag: " FALSE " })).toBe(false);
  });

  it("restricts live provider loading to Quick I Ching and Vercel deployment hosts", () => {
    expect(isAdsterraRuntimeHost("www.quickiching.com")).toBe(true);
    expect(isAdsterraRuntimeHost("quickiching.com")).toBe(true);
    expect(isAdsterraRuntimeHost("quickiching-git-feature.example.vercel.app")).toBe(true);
    expect(isAdsterraRuntimeHost("127.0.0.1")).toBe(false);
    expect(isAdsterraRuntimeHost("localhost")).toBe(false);
    expect(isAdsterraRuntimeHost("example.com")).toBe(false);
  });

  it("pins the reviewed native unit", () => {
    expect(ADSTERRA_RESULT_UNIT.scriptUrl).toBe(
      "https://pl30822164.effectivecpmnetwork.com/98a6d22e22a68bd3f38e4eedda19cd18/invoke.js",
    );
    expect(ADSTERRA_RESULT_UNIT.containerId).toBe("container-98a6d22e22a68bd3f38e4eedda19cd18");
  });
});
