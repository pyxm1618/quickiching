import { describe, expect, it } from "vitest";
import { isAdsterraEnabled, isAdsterraRuntimeHost } from "@/lib/adsterra";

describe("Adsterra result ad activation", () => {
  it("enables production builds unless the emergency kill switch is false", () => {
    expect(isAdsterraEnabled({ NODE_ENV: "production" })).toBe(true);
    expect(isAdsterraEnabled({ NODE_ENV: "production", NEXT_PUBLIC_ADSTERRA_ENABLED: "false" })).toBe(false);
  });

  it("loads the live provider only on Quick I Ching and Vercel deployment hosts", () => {
    expect(isAdsterraRuntimeHost("www.quickiching.com")).toBe(true);
    expect(isAdsterraRuntimeHost("quickiching.com")).toBe(true);
    expect(isAdsterraRuntimeHost("quickiching-git-feature.example.vercel.app")).toBe(true);
    expect(isAdsterraRuntimeHost("127.0.0.1")).toBe(false);
    expect(isAdsterraRuntimeHost("localhost")).toBe(false);
    expect(isAdsterraRuntimeHost("example.com")).toBe(false);
  });
});
