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
      schemaVersion: "commercial-reading-v1",
      readingVariant: "standard",
      coreSummary: "测试摘要",
      currentStage: "当前阶段",
      primaryHexagramPattern: "测试结构",
      changeMechanism: "测试动态",
      possibleDirection: "测试走向",
      obstaclesAndBlindSpots: "测试盲区",
      turningConditions: "转机条件",
      conditionalActionDirection: "行动方向",
      uncertaintyAndBoundaries: "不确定性",
      interpretiveBasisReferences: [],
      disclaimer: "仅供反思。",
    };

    const html = renderToStaticMarkup(
      <ThreeCoinResultClient
        locale="zh-Hans"
        initialUser={{ id: "usr_1", email: "test@example.com" }}
        initialState={{ kind: "ready", reading: mockReading, lineValues: [7, 7, 7, 9, 7, 7], createdAt: "2026-09-25T10:00:00.000Z" }}
        initialCastingView={{
          castingId: "cast_1",
          createdAt: "2026-09-25T10:00:00.000Z",
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
    expect(html).toContain("旧版报告格式");
    expect(html).toContain("测试摘要");
    expect(html).toContain('data-save-reading');
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
      schemaVersion: "deep-reading-v2",
      readingVariant: "standard",
      directAnswer: "A clear next step depends on what is confirmed in the current situation and which option remains reversible.",
      situationMapping: "The cast describes an active transition, while the supplied context determines which part of that pattern applies now.",
      keyTensions: ["Move with purpose while keeping the decision open to new evidence."],
      conditionalDirection: "If the relevant support is present, a measured next step can test the direction without committing to the full outcome.",
      signalsToWatch: ["Watch whether the other party follows through on the specific commitment."],
      practicalReflection: "Write down what would count as reliable evidence, then choose one action that can be reviewed soon.",
      uncertaintyAndBoundaries: "The cast cannot establish what another person will decide; that remains unknown until observable actions occur.",
      interpretiveBasisReferences: [{ evidenceId: "primary:judgment" }],
      disclaimer: "This is conditional reflection and not a certain prediction.",
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
    expect(html).toContain("Restoring the saved evidence bundle");
    expect(html).not.toContain("Unresolved evidence reference");
  });

  it("keeps the paid request disabled until an authenticated user has a credit", () => {
    const freeReading: any = {
      primary: { number: 1, englishName: "The Creative", chineseName: "乾", upper: "qian", lower: "qian" },
      relating: null,
      result: { lineValuesBottomUp: [7, 7, 7, 7, 7, 7], movingLinePositions: [] },
      primaryInterpretation: {
        coreTheme: "Creation",
        orientation: "Forward",
        coreMeaning: "Initiating force and perseverance",
        strength: "Strong purpose",
        challenge: "Impatience",
        structureInterpretation: "Heaven above heaven represents potential",
        reflectionQuestions: ["Where should initiative be focused?"],
        watchFor: ["Overextension"],
      },
      activeLines: [],
      synthesis: { situation: "A beginning", whereChangeIsHappening: "No moving lines", directionOfChange: "Stable", bottomLine: "Proceed steadily" },
    };
    const html = renderToStaticMarkup(
      <ThreeCoinResultClient
        locale="en"
        initialUser={{ id: "usr_1", email: "test@example.com" }}
        initialCredits={0}
        initialState={{ kind: "ready", reading: freeReading, lineValues: [7, 7, 7, 7, 7, 7], question: "What should I focus on now?" }}
        initialCastingView={{ castingId: "cast_1", context: "Career test", lineValuesBottomUp: [7, 7, 7, 7, 7, 7], readingReport: null, owns: true }}
      />,
    );

    expect(html).toContain("Choose a Deep Reading pack");
    expect(html).toContain("No generation starts until a credit is available");
    expect(html).toContain("data-context-enrichment-form");
    expect(html).not.toContain("data-start-deep-reading");
  });

  it("keeps the complete free interpretation and early Deep Reading entry in one localized result", () => {
    const html = renderToStaticMarkup(
      <ThreeCoinResultClient
        locale="zh-Hans"
        initialState={{
          kind: "ready",
          reading: {} as any,
          lineValues: [7, 7, 7, 7, 7, 7],
          question: "这次变化中我应该先看清什么？",
          createdAt: "2026-09-25T10:00:00.000Z",
        }}
        initialCastingView={{
          castingId: "cast_public_result",
          context: "这次变化中我应该先看清什么？",
          lineValuesBottomUp: [7, 7, 7, 7, 7, 7],
          readingReport: null,
          owns: false,
        }}
      />,
    );

    const boundaryPosition = html.indexOf("data-free-cast-boundary");
    const deepPosition = html.indexOf("data-deep-reading-entry");
    const freeDetailsPosition = html.indexOf("data-primary-card");
    expect(html).toContain('data-public-reading-result');
    expect(html).toContain("本次三枚铜钱起卦结果");
    expect(html).toContain("免费：理解卦象 · 付费：解读卦象与你处境的关系");
    expect(html).toContain('href="/zh/hexagrams/1-the-creative"');
    expect(boundaryPosition).toBeGreaterThanOrEqual(0);
    expect(deepPosition).toBeGreaterThan(boundaryPosition);
    expect(freeDetailsPosition).toBeGreaterThan(deepPosition);
  });
});
