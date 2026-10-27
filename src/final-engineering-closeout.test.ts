import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluateRisk } from "@/domain/risk/engine";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("final engineering closeout source contracts", () => {
  it("keeps privacy pages free of empty advertising sections and current on the material-change date", () => {
    const english = source("./app/(default)/privacy/page.tsx");
    const chinese = source("./app/(localized)/zh/privacy/page.tsx");
    expect(english).not.toMatch(/<h2[^>]*>Advertising<\/h2>/u);
    expect(chinese).not.toMatch(/<h2[^>]*>广告<\/h2>/u);
    expect(english).toContain("Last updated: October 27, 2026");
    expect(chinese).toContain("最后更新：2026 年 10 月 27 日");
    expect(english).not.toContain("Last updated: September 27, 2026");
    expect(chinese).not.toContain("最后更新：2026 年 9 月 27 日");
  });

  it("uses four homepage how-cards on desktop without bypassing the display-font variable", () => {
    const css = source("./app/globals.css");
    expect(css).toContain(".how-strip { display: grid; grid-template-columns: repeat(4, 1fr);");
    expect(css).not.toContain(".how-strip { display: grid; grid-template-columns: repeat(3, 1fr);");
    const georgiaLines = css.split("\n").filter((line) => line.includes("Georgia"));
    expect(georgiaLines).toHaveLength(1);
    expect(georgiaLines[0]).toContain("--font-display");
  });

  it("keeps scene normalization for reading data while making risk evaluation scene-neutral", () => {
    const route = source("./app/api/readings/route.ts");
    const engine = source("./domain/risk/engine.ts");
    const client = source("./components/three-coin-result/three-coin-result-client.tsx");
    const deepService = source("./server/generation/deep-reading-service.ts");
    expect(route).toContain("const scene = normalizeScene(sceneInput)");
    expect(route).toContain("evaluateRisk(questionText)");
    expect(route).not.toContain("evaluateRisk(questionText, scene)");
    expect(route).not.toContain("scene as Scene");
    expect(engine).toContain("evaluateRisk(rawQuestion: string)");
    expect(engine).not.toContain("scene: Scene");
    expect(engine).not.toContain("scene context");
    expect(client).not.toContain('join("\\n"), "other"');
    expect(deepService).not.toContain("evaluateRisk(riskText(coreQuestionAtCast, context), normalizedScene)");
    expect(deepService).not.toContain("snapshot.scene,");
  });

  it("preserves risk decisions after removing the unused scene parameter", () => {
    expect(evaluateRisk("I want to hurt myself tonight.").status).toBe("emergency_blocked");
    expect(evaluateRisk("Should I stop taking my prescribed medication?").status).toBe("professional_decision_blocked");
    expect(evaluateRisk("My chemotherapy situation means I need guidance.").status).toBe("needs_clarification");
    expect(evaluateRisk("My doctor discussed chemotherapy with me.").status).toBe("allowed");
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

  it("keeps anonymous browser-session Three-Coin results on the interpretation loading contract", () => {
    const client = source("./components/three-coin-result/three-coin-result-client.tsx");
    const genericResult = source("./components/public-reading/public-reading-result.tsx");
    expect(client).toContain("shouldDeferBrowserInterpretation");
    expect(client).toContain("waitingForBrowserInterpretation");
    expect(client).toContain("data-reading-interpretation-loading");
    expect(client).toContain("loadHexagramInterpretation(resultReading.primaryHexagram)");
    expect(genericResult).not.toContain("data-reading-interpretation-loading");
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

  it("keeps analytics providers behind Google CMP consent and public-route policy", () => {
    const gate = source("./components/consent-gated-analytics.tsx");
    expect(gate).toContain("useSyncExternalStore");
    expect(gate).toContain("consent.analytics && isAnalyticsSurface(pathname)");
    expect(gate).toContain("stopAnalytics()");
    expect(gate).not.toContain("readStoredAnalyticsConsent");
  });
});
