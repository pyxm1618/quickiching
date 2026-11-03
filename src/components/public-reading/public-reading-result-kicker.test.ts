import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PublicReadingResult } from "./public-reading-result";
import { ZH_HANS_UI_DICTIONARY } from "@/i18n/dictionaries/zh-Hans";
import { buildPublicReading } from "@/domain/public-reading/reading";
import type { PublicReadingEvidence, PublicReadingMethod } from "@/domain/public-reading/types";
import { meiHuaFromNumberAndTime } from "@/domain/casting/mei-hua/number-time";
import { zhHansReadingContentFor } from "@/content/mei-hua-yi-shu/zh-Hans";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => React.createElement("a", { href, ...props }, children),
}));

function evidenceFor(method: PublicReadingMethod): PublicReadingEvidence {
  if (method === "three-coin") return { kind: "three-coin", steps: [] };
  if (method === "yarrow-stalks") return { kind: "yarrow-stalks", lines: [] };
  if (method === "mei-hua-yi-shu") return { kind: "mei-hua-yi-shu", calculation: meiHuaFromNumberAndTime({ number: 17, utcMillis: Date.UTC(2026, 9, 31), ianaTimeZone: "UTC" }) };
  return { kind: "manual", mode: "line-values" };
}

function mockReading(method: PublicReadingMethod, version: string) {
  return buildPublicReading({
    id: `test-${method}`,
    createdAt: "2026-09-23T12:00:00.000Z",
    method,
    methodVersion: version,
    question: "测试问题",
    lineValuesBottomUp: [7, 8, 9, 6, 7, 8],
    evidence: evidenceFor(method),
  });
}

describe("PublicReadingResult unified method identity", () => {
  it.each([
    ["three-coin", "three-coin-v1"],
    ["yarrow-stalks", "yarrow-v1"],
    ["mei-hua-yi-shu", "mei-hua-v1"],
    ["manual", "manual-v1"],
  ] as const)("renders %s through the same current Free Reading DOM", (method, version) => {
    const html = renderToStaticMarkup(React.createElement(PublicReadingResult, { reading: mockReading(method, version) }));
    expect(html).toContain("data-free-reading-ritual");
    expect(html).toContain(`data-reading-method="${method}"`);
    expect(html).not.toContain("mystic-kicker");
  });
});

describe("PublicReadingResult changing-line meaning", () => {
  it("renders an unchanged English cast without fabricating a relating hexagram", () => {
    const reading = buildPublicReading({
      id: "static-no-change-en",
      createdAt: "2026-09-27T00:00:00.000Z",
      method: "three-coin",
      methodVersion: "three-coin-v1",
      question: "What should I notice?",
      lineValuesBottomUp: [7, 7, 7, 7, 7, 7],
      evidence: evidenceFor("three-coin"),
    });
    const html = renderToStaticMarkup(
      React.createElement(
        PublicReadingResult,
        { reading },
        React.createElement("aside", { "data-deep-reading-entry": true }, "Deep Reading"),
      ),
    );

    expect(html).toContain("No changing lines");
    expect(html).toContain("No Relating Hexagram");
    expect(html).toContain("data-no-relating-card");
    expect(html).not.toContain("data-relating-card");
    expect(html).toContain("data-primary-card");
    expect(html).toContain("data-deep-reading-entry");
    expect(html.indexOf("data-deep-reading-cta=\"top\"")).toBeLessThan(html.indexOf("data-primary-card"));
  });

  it("renders an unchanged Chinese cast in the current unified result UI", () => {
    const reading = buildPublicReading({
      id: "static-no-change-zh",
      createdAt: "2026-09-27T00:00:00.000Z",
      method: "three-coin",
      methodVersion: "three-coin-v1",
      question: "我该留意什么？",
      lineValuesBottomUp: [7, 7, 7, 7, 7, 7],
      evidence: evidenceFor("three-coin"),
    });
    const html = renderToStaticMarkup(
      React.createElement(
        PublicReadingResult,
        { reading, dictionary: ZH_HANS_UI_DICTIONARY, localizedContent: zhHansReadingContentFor([1]) },
        React.createElement("aside", { "data-deep-reading-entry": true }, "深度解读"),
      ),
    );

    expect(html).toContain("无动爻");
    expect(html).toContain("没有之卦");
    expect(html).toContain("data-no-relating-card");
    expect(html).toContain("data-primary-card");
    expect(html).toContain("data-deep-reading-entry");
    expect(html.indexOf("data-deep-reading-cta=\"top\"")).toBeLessThan(html.indexOf("data-primary-card"));
  });

  it("keeps the actual relating hexagram visible when a line changes", () => {
    const reading = buildPublicReading({
      id: "static-change-en",
      createdAt: "2026-09-27T00:00:00.000Z",
      method: "three-coin",
      methodVersion: "three-coin-v1",
      lineValuesBottomUp: [7, 7, 9, 7, 7, 7],
      evidence: evidenceFor("three-coin"),
    });
    const html = renderToStaticMarkup(React.createElement(PublicReadingResult, { reading }));

    expect(html).toContain("Changing Line(s)");
    expect(html).toContain("Line 3");
    expect(html).toContain("data-relating-card");
    expect(html).toContain("Relating Hexagram");
  });
});
