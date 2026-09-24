import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _prefetch, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ThreeCoinResultClient } from "./three-coin-result-client";

describe("ThreeCoinResultClient Component Locale Routing & State Parity", () => {
  it("renders empty state pointing to /zh/methods/three-coin in Chinese mode", () => {
    const html = renderToStaticMarkup(
      <ThreeCoinResultClient locale="zh-Hans" initialState={{ kind: "empty" }} />,
    );
    expect(html).toContain('href="/zh/methods/three-coin"');
    expect(html).not.toContain('href="/#three-coin-reading"');
    expect(html).toContain("开始三枚铜钱起卦");
    expect(html).toContain("没有找到已完成的起卦");
  });

  it("renders empty state pointing to /#three-coin-reading in English mode", () => {
    const html = renderToStaticMarkup(
      <ThreeCoinResultClient locale="en" initialState={{ kind: "empty" }} />,
    );
    expect(html).toContain('href="/#three-coin-reading"');
    expect(html).toContain("Start a Three-Coin Reading");
    expect(html).toContain("No completed reading found");
  });

  it("renders error state pointing to /zh/methods/three-coin in Chinese mode", () => {
    const html = renderToStaticMarkup(
      <ThreeCoinResultClient
        locale="zh-Hans"
        initialState={{ kind: "error", code: "TEST_ERROR" }}
      />,
    );
    expect(html).toContain('href="/zh/methods/three-coin"');
    expect(html).not.toContain('href="/#three-coin-reading"');
    expect(html).toContain("返回三枚铜钱起卦");
    expect(html).toContain("无法恢复这次已落定的起卦结果");
  });

  it("renders error state pointing to /#three-coin-reading in English mode", () => {
    const html = renderToStaticMarkup(
      <ThreeCoinResultClient
        locale="en"
        initialState={{ kind: "error", code: "TEST_ERROR" }}
      />,
    );
    expect(html).toContain('href="/#three-coin-reading"');
    expect(html).toContain("Return to Three-Coin Reading");
    expect(html).toContain("The sealed reading could not be interpreted");
  });

  it("renders completed report banner pointing to /zh/account in Chinese mode", () => {
    const mockReading: any = {
      primary: { number: 1, englishName: "The Creative", chineseName: "乾" },
      relating: { number: 9, englishName: "Small Taming", chineseName: "小畜" },
      result: { lineValuesBottomUp: [7, 7, 7, 9, 7, 7], movingLinePositions: [4] },
      primaryInterpretation: { coreTheme: "创造与开始", orientation: "积极向前" },
    };
    const mockReport: any = {
      executiveSummary: "测试摘要",
      coreHexagramStructure: "测试结构",
      changingDynamics: "测试动态",
      futureTrajectory: "测试走向",
      blindSpotAnalysis: "测试盲区",
      strategicActions: ["行动一", "行动二"],
      riskFactors: ["风险一"],
      timingConsiderations: "时机考量",
      philosophicalReflection: "哲学反思",
      closingGuidance: "结语指导",
    };

    const html = renderToStaticMarkup(
      <ThreeCoinResultClient
        locale="zh-Hans"
        initialUser={{ id: "usr_1", email: "test@example.com" }}
        initialState={{ kind: "ready", reading: mockReading, lineValues: [7, 7, 7, 9, 7, 7] }}
        initialCastingView={{
          castingId: "cast_1",
          context: "事业测试",
          lineValuesBottomUp: [7, 7, 7, 9, 7, 7],
          readingReport: mockReport,
          owns: true,
        }}
      />,
    );
    expect(html).toContain('href="/zh/account"');
    expect(html).not.toContain('href="/account"');
    expect(html).toContain("查看账户与历史记录 →");
  });

  it("renders completed report banner pointing to /account in English mode", () => {
    const mockReading: any = {
      primary: { number: 1, englishName: "The Creative", chineseName: "乾", upper: "qian", lower: "qian" },
      relating: { number: 9, englishName: "Small Taming", chineseName: "小畜", upper: "xun", lower: "qian" },
      relatingInterpretation: { coreMeaning: "Gentle restraint", coreTheme: "Small progress" },
      result: { lineValuesBottomUp: [7, 7, 7, 9, 7, 7], movingLinePositions: [4] },
      primaryInterpretation: {
        coreTheme: "Creation",
        orientation: "Forward",
        coreMeaning: "Initiating force and perseverance",
        strength: "Strong purpose",
        challenge: "Impatience",
        structureInterpretation: "Heaven above heaven represents boundless potential",
        reflectionQuestions: ["Where should initiative be focused?", "What requires steady endurance?", "How to lead wisely?"],
        watchFor: ["Overextension", "Sudden breakthroughs", "Leadership opportunities"],
      },
      activeLines: [],
      synthesis: {
        situation: "A moment of creative initiative",
        whereChangeIsHappening: "Line 4 transition",
        directionOfChange: "Advancing steadily",
        bottomLine: "Focus on persistence",
      },
    };
    const mockReport: any = {
      executiveSummary: "Test summary",
      coreHexagramStructure: "Test structure",
      changingDynamics: "Test dynamics",
      futureTrajectory: "Test trajectory",
      blindSpotAnalysis: "Test blindspot",
      strategicActions: ["Action 1"],
      riskFactors: ["Risk 1"],
      timingConsiderations: "Timing",
      philosophicalReflection: "Reflection",
      closingGuidance: "Closing",
    };

    const html = renderToStaticMarkup(
      <ThreeCoinResultClient
        locale="en"
        initialUser={{ id: "usr_1", email: "test@example.com" }}
        initialState={{ kind: "ready", reading: mockReading, lineValues: [7, 7, 7, 9, 7, 7] }}
        initialCastingView={{
          castingId: "cast_1",
          context: "Career test",
          lineValuesBottomUp: [7, 7, 7, 9, 7, 7],
          readingReport: mockReport,
          owns: true,
        }}
      />,
    );
    expect(html).toContain('href="/account"');
    expect(html).not.toContain('href="/zh/account"');
  });
});
