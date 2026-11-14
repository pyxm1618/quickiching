import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");
describe("shared post-Reading business architecture", () => {
  it("keeps ThreeCoinResultClient as a compatibility shell", () => {
    const wrapper = source("../three-coin-result/three-coin-result-client.tsx");
    for (const forbidden of ["/api/readings", "/signin", "readPendingCompletedReading", "persistCurrentReading", "handleUnlockDeepReading"]) expect(wrapper).not.toContain(forbidden);
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
    expect(shared).not.toContain("manualDeepUnavailable");
    expect(shared).not.toContain('data-deep-reading-blocked="manual"');
  });
  it("hands Three-Coin, Yarrow, Mei Hua and Manual into the one Reading Handoff owner", () => {
    for (const relative of ["../public-reading/three-coin-tool.tsx","../public-reading/yarrow-tool.tsx","../public-reading/mei-hua-number-flow.tsx","../public-reading/manual-cast-tool.tsx"]) {
      const method = source(relative);
      expect(method).toContain("completeReadingHandoff");
      // No adapter owns pending writes, session retirement or handoff navigation.
      expect(method).not.toContain("writePendingCompletedReading");
      expect(method).not.toContain("removePendingCompletedReading");
      expect(method).not.toContain("router.push");
      expect(method).not.toContain('fetch("/api/readings"');
      expect(method).not.toContain("/signin?");
    }
  });
});
