import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function componentSource(): string {
  return readFileSync(new URL("./adsterra-result-ad.tsx", import.meta.url), "utf8");
}

describe("AdsterraResultAd client build contract", () => {
  it("uses direct literal environment-variable access so Next.js can inline client values", () => {
    const source = componentSource();

    expect(source).toContain("process.env.NEXT_PUBLIC_ADSTERRA_ENABLED");
    expect(source).toContain("process.env.NODE_ENV");
    expect(source).toContain("resolveAdsterraEnabled({");
    expect(source).not.toContain("isAdsterraEnabled()");
    expect(source).not.toContain("= process.env,");
  });

  it("keeps the runtime host gate and reviewed DOM/provider identifiers", () => {
    const source = componentSource();

    expect(source).toContain("isAdsterraRuntimeHost(window.location.hostname)");
    expect(source).toContain('data-adsterra-result-slot="true"');
    expect(source).toContain("ADSTERRA_RESULT_UNIT.containerId");
    expect(source).toContain("ADSTERRA_RESULT_UNIT.scriptUrl");
  });
});
