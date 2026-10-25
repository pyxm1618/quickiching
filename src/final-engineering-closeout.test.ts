import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("final engineering closeout source contracts", () => {
  it("keeps privacy pages free of empty advertising sections", () => {
    expect(source("./app/(default)/privacy/page.tsx")).not.toMatch(/<h2[^>]*>Advertising<\/h2>/u);
    expect(source("./app/(localized)/zh/privacy/page.tsx")).not.toMatch(/<h2[^>]*>广告<\/h2>/u);
  });

  it("uses four homepage how-cards on desktop without bypassing the display-font variable", () => {
    const css = source("./app/globals.css");
    expect(css).toContain(".how-strip { display: grid; grid-template-columns: repeat(4, 1fr);");
    expect(css).not.toContain(".how-strip { display: grid; grid-template-columns: repeat(3, 1fr);");
    const georgiaLines = css.split("\n").filter((line) => line.includes("Georgia"));
    expect(georgiaLines).toHaveLength(1);
    expect(georgiaLines[0]).toContain("--font-display");
  });

  it("distinguishes clarification risk copy from high-risk professional-support copy", () => {
    const client = source("./components/three-coin-result/three-coin-result-client.tsx");
    expect(client).toContain('deepRisk.status === "needs_clarification"');
    expect(client).toContain("Deep Reading needs a clearer question or situation context");
    expect(client).toContain("qualified professional support");
  });

  it("does not eagerly serialize the full Chinese 64-hexagram reading payload into public casting clients", () => {
    for (const path of [
      "./app/(localized)/zh/page.tsx",
      "./app/(localized)/zh/methods/three-coin/page.tsx",
      "./app/(localized)/zh/methods/yarrow-stalks/page.tsx",
      "./app/(localized)/zh/methods/manual-cast/page.tsx",
    ]) {
      expect(source(path), path).not.toContain("ZH_HANS_READING_CONTENT");
    }
    expect(source("./app/(localized)/zh/methods/mei-hua-yi-shu/page.tsx")).not.toContain("readingContent={content.reading}");
    expect(source("./components/three-coin-result/three-coin-result-client.tsx")).not.toContain('import { ZH_HANS_READING_CONTENT');
    expect(source("./components/public-reading/public-reading-result.tsx")).toContain('import("@/content/mei-hua-yi-shu/zh-Hans")');
  });

  it("preloads known result interpretations on server-owned result routes", () => {
    expect(source("./app/(default)/readings/three-coin/result/page.tsx")).toContain("initialInterpretationBundles");
    const zhResult = source("./app/(localized)/zh/readings/three-coin/result/page.tsx");
    expect(zhResult).toContain("initialInterpretationBundles");
    expect(zhResult).toContain("initialLocalizedContent");
    expect(zhResult).toContain("zhHansReadingContentFor");
  });

  it("does not mechanically lowercase trusted interpretation prose", () => {
    const detail = source("./components/hexagram-detail-page.tsx");
    expect(detail).not.toMatch(/withoutBrand\(knowledge\.interpretation\.(?:strength|challenge)\)\.toLocaleLowerCase/u);
  });

  it("does not emit normal readiness configuration audit logs on every request", () => {
    expect(source("./app/api/ready/route.ts")).not.toContain("PROD_AI_CONFIG_AUDIT");
    expect(source("./app/api/ready/route.ts")).toContain("[READY_AUDIT]");
  });

  it("keeps analytics provider scripts behind explicit granted consent", () => {
    const gate = source("./components/consent-gated-analytics.tsx");
    expect(gate).toContain("analyticsProvidersAllowed(consent)");
    expect(gate).toContain("enabled && gaMeasurementId");
    expect(gate).toContain("enabled && clarityProjectId");
  });
});
