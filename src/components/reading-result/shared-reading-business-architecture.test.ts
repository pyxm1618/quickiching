import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");
describe("shared post-Reading business architecture", () => {
  it("keeps ThreeCoinResultClient as a compatibility shell", () => {
    const wrapper = source("../three-coin-result/three-coin-result-client.tsx");
    for (const forbidden of ["/api/readings", "/signin", "readCompletedPublicReading", "persistCurrentReading", "handleUnlockDeepReading"]) expect(wrapper).not.toContain(forbidden);
    expect(wrapper).toContain("ReadingResultClient as ThreeCoinResultClient");
  });
  it("owns post-Reading Auth/Save/Deep/retry once", () => {
    const shared = source("./reading-result-client.tsx");
    expect(shared).toContain('fetch("/api/readings"');
    expect(shared).toContain("persistCurrentReading");
    expect(shared).toContain("handleUnlockDeepReading");
    expect(shared).toContain("data-retry-account-reading-save");
    expect(shared).toContain("data-auth-reading-intent");
    expect(shared).toContain("/readings/deep?session=");
    expect(shared).not.toContain("readThreeCoinSession");
  });
  it("hands Three-Coin, Yarrow and Mei Hua into the same completed Reading boundary", () => {
    for (const relative of ["../public-reading/three-coin-tool.tsx","../public-reading/yarrow-tool.tsx","../public-reading/mei-hua-number-flow.tsx"]) {
      const method = source(relative);
      expect(method).toContain("writeCompletedPublicReading");
      expect(method).toContain("completedPublicReadingPath");
      expect(method).not.toContain('fetch("/api/readings"');
      expect(method).not.toContain("/signin?");
    }
  });
});
