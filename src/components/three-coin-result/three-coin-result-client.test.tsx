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
import { CommercialReadingReportView } from "./commercial-reading-report-view";

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

  it("renders streamlined context form with $2.99 pricing disclosure and expandable details", () => {
    const htmlZh = renderToStaticMarkup(
      <ThreeCoinResultClient
        locale="zh-Hans"
        initialState={{
          kind: "ready",
          reading: {} as any,
          lineValues: [7, 7, 7, 7, 7, 7],
          question: "我的核心问题是否能够解决？",
          createdAt: "2026-09-25T10:00:00.000Z",
        }}
        initialCastingView={{
          castingId: "cast_pricing_test",
          context: "我的核心问题是否能够解决？",
          lineValuesBottomUp: [7, 7, 7, 7, 7, 7],
          readingReport: null,
          owns: false,
        }}
      />,
    );

    expect(htmlZh).toContain("个性化深度解读 · $2.99 起");
    expect(htmlZh).toContain("说明你的具体处境与关键事实");
    expect(htmlZh).toContain("你最想看清什么？");
    expect(htmlZh).toContain("+ 补充选项、限制与顾虑（可选）");
    expect(htmlZh).toContain("登录并继续 · $2.99");

    const htmlEn = renderToStaticMarkup(
      <ThreeCoinResultClient
        locale="en"
        initialState={{
          kind: "ready",
          reading: {} as any,
          lineValues: [7, 7, 7, 7, 7, 7],
          question: "How should I approach this transition?",
          createdAt: "2026-09-25T10:00:00.000Z",
        }}
        initialCastingView={{
          castingId: "cast_pricing_test_en",
          context: "How should I approach this transition?",
          lineValuesBottomUp: [7, 7, 7, 7, 7, 7],
          readingReport: null,
          owns: false,
        }}
      />,
    );

    expect(htmlEn).toContain("Personalized Deep Reading · from $2.99");
    expect(htmlEn).toContain("Tell us what matters in your situation");
    expect(htmlEn).toContain("What would you like clarity on?");
    expect(htmlEn).toContain("+ Add more details (options, constraints, concerns)");
    expect(htmlEn).toContain("Sign in to continue · $2.99");
  });

  it("renders Why this interpretation summary in completed Deep Reading report", () => {
    const mockReport = {
      schemaVersion: "deep-reading-v2" as const,
      readingVariant: "standard" as const,
      directAnswer: "Direct answer text explaining the specific context in relation to the hexagram.",
      situationMapping: "Situation mapping text with clear ties to the cast facts and user situation.",
      keyTensions: ["Tension between current stagnation and coming movement"],
      conditionalDirection: "If external conditions stabilize, advance cautiously.",
      signalsToWatch: ["Clear written agreement from the counterpart"],
      practicalReflection: "Observe before making irreversible financial or career decisions.",
      uncertaintyAndBoundaries: "Separate what the cast indicates from unknown organizational dynamics.",
      interpretiveBasisReferences: [{ evidenceId: "primary.judgment" }],
      disclaimer: "Reflective interpretation only.",
    };

    const mockSnapshot = {
      schemaVersion: "deep-reading-context-v1" as const,
      coreQuestionAtCast: "How should I approach this transition?",
      context: {
        contextNotes: "I have been in this position for two years and received an offer.",
        options: ["Accept offer", "Stay"],
        constraints: ["Must decide in 3 days"],
        concerns: ["Work culture"],
        interpretationGoal: "what_do_i_need_to_see_clearly" as const,
        locale: "en" as const,
      },
      scene: "general" as const,
      castMethod: "three_coin" as const,
      methodVersion: "three-coin-v1",
      facts: {
        method: "three_coin" as const,
        algorithmVersion: "three-coin-v1",
        classicMappingVersion: "king-wen",
        lineValuesBottomUp: [7, 9, 7, 7, 7, 7] as any,
        primaryHexagramNumber: 47,
        movingLinePositions: [2],
        relatingHexagramNumber: 45,
        readingVariant: "standard" as const,
      },
      snapshotAt: new Date().toISOString(),
      knowledgeVersion: "quickiching-knowledge-v1",
      risk: { status: "allowed" as const, ruleVersion: "v1", reasonCode: "SAFE" },
      knowledge: {
        version: "quickiching-knowledge-v1",
        primary: {
          number: 47,
          name: "Oppression",
          chineseName: "困",
          judgment: "困：亨，贞，大人吉，无咎。",
          image: "泽无水，困。君子以致命遂志。",
          interpretation: {
            coreTheme: "Constraints",
            coreMeaning: "A situation under pressure",
            strength: "Persistence",
            challenge: "Limited resources",
            orientation: "Work within real limits",
            structureInterpretation: "Water below the lake",
            transitionTheme: "Pressure changing the structure",
            stabilityTheme: "Recognize what remains available",
          },
        },
        changingLines: [],
        relating: {
          number: 45,
          name: "Gathering Together",
          chineseName: "萃",
          judgment: "萃：亨。王假有庙。",
          image: "泽上于地，萃。",
          coreMeaning: "Gathering of forces",
          orientation: "Unity in common purpose",
        },
        structuralChange: "Line 2 changes",
        evidence: [{ id: "primary.judgment", source: "king_wen_judgment" as const, hexagramNumber: 47, content: "困：亨" }],
      },
    };

    const htmlEn = renderToStaticMarkup(
      <CommercialReadingReportView report={mockReport} snapshot={mockSnapshot} locale="en" />,
    );
    expect(htmlEn).toContain('data-why-this-interpretation');
    expect(htmlEn).toContain("Why this interpretation");
    expect(htmlEn).toContain("Primarily based on Hexagram 47 (Oppression), changing line 2, and the movement toward Hexagram 45 (Gathering Together).");

    const htmlZh = renderToStaticMarkup(
      <CommercialReadingReportView report={mockReport} snapshot={mockSnapshot} locale="zh-Hans" />,
    );
    expect(htmlZh).toContain('data-why-this-interpretation');
    expect(htmlZh).toContain("解读依据概述");
    expect(htmlZh).toContain("本次解读主要基于 第 47 卦「困」，第 2 爻动爻，以及向 第 45 卦「萃」的结构变化。");
  });
});
