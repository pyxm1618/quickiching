import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PublicReadingResult, resolveReadingKicker } from "./public-reading-result";
import { ZH_HANS_UI_DICTIONARY } from "@/i18n/dictionaries/zh-Hans";
import { EN_UI_DICTIONARY } from "@/i18n/dictionaries/en";
import { buildPublicReading } from "@/domain/public-reading/reading";
import type { PublicReadingMethod } from "@/domain/public-reading/types";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => React.createElement("a", { href, ...props }, children),
}));

function mockReading(method: PublicReadingMethod, version: string) {
  return buildPublicReading({
    id: `test-${method}`,
    createdAt: "2026-09-23T12:00:00.000Z",
    method,
    methodVersion: version,
    question: "测试问题",
    lineValuesBottomUp: [7, 8, 9, 6, 7, 8],
    evidence: { kind: "history", originalMethod: method },
  });
}

describe("PublicReadingResult Kicker Method Perception", () => {
  it("resolves Three-Coin Chinese kicker accurately without internal version numbers", () => {
    const reading = mockReading("three-coin", "three-coin-v1");
    const kicker = resolveReadingKicker(reading, ZH_HANS_UI_DICTIONARY);
    expect(kicker).toBe("三枚铜钱 · 基础解读");
    expect(kicker).not.toContain("-v1");
    expect(kicker).not.toContain("梅花易数");
  });

  it("resolves Yarrow Chinese kicker accurately without internal version numbers", () => {
    const reading = mockReading("yarrow-stalks", "yarrow-v1");
    const kicker = resolveReadingKicker(reading, ZH_HANS_UI_DICTIONARY);
    expect(kicker).toBe("蓍草起卦 · 基础解读");
    expect(kicker).not.toContain("-v1");
    expect(kicker).not.toContain("梅花易数");
  });

  it("resolves Mei Hua Chinese kicker accurately without internal version numbers", () => {
    const reading = mockReading("mei-hua-yi-shu", "mei-hua-v1");
    const kicker = resolveReadingKicker(reading, ZH_HANS_UI_DICTIONARY);
    expect(kicker).toBe("梅花易数 · 基础解读");
    expect(kicker).not.toContain("-v1");
  });

  it("resolves Manual Cast Chinese kicker accurately without internal version numbers", () => {
    const reading = mockReading("manual", "manual-v1");
    const kicker = resolveReadingKicker(reading, ZH_HANS_UI_DICTIONARY);
    expect(kicker).toBe("手动起卦 · 基础解读");
    expect(kicker).not.toContain("-v1");
    expect(kicker).not.toContain("梅花易数");
  });

  it("preserves English static kicker contract for English dictionary", () => {
    const reading = mockReading("three-coin", "three-coin-v1");
    const kicker = resolveReadingKicker(reading, EN_UI_DICTIONARY);
    expect(kicker).toBe("Static reading · three-coin-v1");
  });
});

describe("PublicReadingResult changing-line meaning", () => {
  it("explains an unchanged English cast without a bare None or fabricated relating hexagram", () => {
    const reading = buildPublicReading({
      id: "static-no-change-en",
      createdAt: "2026-09-27T00:00:00.000Z",
      method: "three-coin",
      methodVersion: "three-coin-v1",
      question: "What should I notice?",
      lineValuesBottomUp: [7, 7, 7, 7, 7, 7],
      evidence: { kind: "history", originalMethod: "three-coin" },
    });
    const html = renderToStaticMarkup(
      React.createElement(
        PublicReadingResult,
        { reading },
        React.createElement("aside", { "data-deep-reading-entry": true }, "Deep Reading"),
      ),
    );

    expect(html).toContain("No changing lines");
    expect(html).toContain("No relating hexagram");
    expect(html).toContain("No line changed, so this reading remains centered on the primary hexagram.");
    expect(html).not.toContain("Changing Lines: None");
    expect(html).not.toContain(">None</div>");
    expect(html).not.toContain("data-relating-card");
    expect(html.indexOf("data-primary-overview")).toBeLessThan(html.indexOf("data-deep-reading-entry"));
  });

  it("explains an unchanged Chinese cast and keeps the Deep Reading offer after the cast summary", () => {
    const reading = buildPublicReading({
      id: "static-no-change-zh",
      createdAt: "2026-09-27T00:00:00.000Z",
      method: "three-coin",
      methodVersion: "three-coin-v1",
      question: "我该留意什么？",
      lineValuesBottomUp: [7, 7, 7, 7, 7, 7],
      evidence: { kind: "history", originalMethod: "three-coin" },
    });
    const html = renderToStaticMarkup(
      React.createElement(
        PublicReadingResult,
        { reading, dictionary: ZH_HANS_UI_DICTIONARY },
        React.createElement("aside", { "data-deep-reading-entry": true }, "深度解读"),
      ),
    );

    expect(html).toContain("无动爻");
    expect(html).toContain("本次没有变卦（之卦）");
    expect(html).toContain("六爻均未发生变化，因此本次阅读以本卦为核心。");
    expect(html).not.toContain("动爻：无");
    expect(html.indexOf("data-primary-overview")).toBeLessThan(html.indexOf("data-deep-reading-entry"));
  });

  it("keeps the actual relating hexagram visible when a line changes", () => {
    const reading = buildPublicReading({
      id: "static-change-en",
      createdAt: "2026-09-27T00:00:00.000Z",
      method: "three-coin",
      methodVersion: "three-coin-v1",
      lineValuesBottomUp: [7, 7, 9, 7, 7, 7],
      evidence: { kind: "history", originalMethod: "three-coin" },
    });
    const html = renderToStaticMarkup(React.createElement(PublicReadingResult, { reading }));

    expect(html).toContain("Changing line(s): 3");
    expect(html).toContain("data-relating-card");
    expect(html).toContain("Relating Hexagram");
  });
});
