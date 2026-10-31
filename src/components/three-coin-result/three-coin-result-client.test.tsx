import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _prefetch, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ThreeCoinResultClient, getResultRevealGate, getTerminalCreditReconciliation, hasRequiredInterpretationBundles } from "./three-coin-result-client";
import { AiDeepReadingResult } from "./ai-deep-reading-result";
import { zhHansReadingContentFor } from "@/content/mei-hua-yi-shu/zh-Hans";
import { buildPublicReading } from "@/domain/public-reading/reading";
import { loadHexagramInterpretation } from "@/domain/interpretation/v2/load-interpretation";

const ZH_TEST_READING_CONTENT = zhHansReadingContentFor([1, 9]);

describe("ThreeCoinResultClient Deep Reading credit reconciliation", () => {
  it.each(["failed", "timed_out"] as const)("uses authoritative credits for a current-page %s terminal result", (status) => {
    expect(getTerminalCreditReconciliation(status, 1, "cast-1", "cast-1")).toEqual({
      authoritativeCredits: 1,
      clearReservationRef: true,
    });
  });

  it.each(["failed", "timed_out"] as const)("uses authoritative credits for a restored %s result after reload", (status) => {
    expect(getTerminalCreditReconciliation(status, 1, null, "cast-1")).toEqual({
      authoritativeCredits: 1,
      clearReservationRef: false,
    });
  });

  it.each(["queued", "running", "completed"] as const)("does not refresh credits for %s polling state", (status) => {
    expect(getTerminalCreditReconciliation(status, 99, null, "cast-1")).toEqual({
      authoritativeCredits: null,
      clearReservationRef: false,
    });
  });

  it("ignores an invalid terminal balance instead of guessing a +1 refund", () => {
    expect(getTerminalCreditReconciliation("failed", undefined, "cast-1", "cast-1")).toEqual({
      authoritativeCredits: null,
      clearReservationRef: true,
    });
  });
});

describe("ThreeCoinResultClient auth-save-reveal gate", () => {
  it("requires authentication before reveal", () => {
    expect(getResultRevealGate({ authenticated: false, castingId: null, persistenceStatus: "idle" })).toBe("auth-required");
  });

  it("keeps a signed-in completed cast behind saving until History persistence succeeds", () => {
    expect(getResultRevealGate({ authenticated: true, castingId: null, persistenceStatus: "idle" })).toBe("saving");
    expect(getResultRevealGate({ authenticated: true, castingId: null, persistenceStatus: "saving" })).toBe("saving");
    expect(getResultRevealGate({ authenticated: true, castingId: null, persistenceStatus: "error" })).toBe("save-error");
  });

  it("allows reveal only for an authenticated saved casting id", () => {
    expect(getResultRevealGate({ authenticated: true, castingId: "cast_1", persistenceStatus: "saved" })).toBe("reveal");
    expect(getResultRevealGate({ authenticated: false, castingId: "cast_1", persistenceStatus: "saved" })).toBe("auth-required");
  });

  it("renders an anonymous completed cast as an auth gate without leaking the free result", () => {
    const html = renderToStaticMarkup(
      <ThreeCoinResultClient
        locale="en"
        initialState={{ kind: "ready", lineValues: [7, 7, 7, 7, 7, 7], question: "What should I focus on?" }}
      />,
    );
    expect(html).toContain('data-completed-cast-gate="auth-required"');
    expect(html).toContain("Sign in to save and reveal this reading");
    expect(html).toContain("data-completed-six-lines");
    expect(html).not.toContain("data-primary-card");
    expect(html).not.toContain("data-ritual-result-card");
    expect(html).not.toContain("data-deep-reading-entry");
  });

  it("renders a signed-in unsaved completed cast as saving without leaking the free result", () => {
    const html = renderToStaticMarkup(
      <ThreeCoinResultClient
        locale="en"
        initialUser={{ id: "usr_1", email: "test@example.com" }}
        initialState={{ kind: "ready", lineValues: [7, 7, 7, 7, 7, 7], question: "What should I focus on?" }}
      />,
    );
    expect(html).toContain('data-completed-cast-gate="saving"');
    expect(html).toContain("data-history-saving");
    expect(html).not.toContain("data-primary-card");
    expect(html).not.toContain("data-ritual-result-card");
    expect(html).not.toContain("data-deep-reading-entry");
  });
});

describe("ThreeCoinResultClient interpretation bundle readiness", () => {
  it("keeps the initial anonymous browser-session render on the existing stable loading shell", () => {
    const html = renderToStaticMarkup(<ThreeCoinResultClient locale="en" />);
    expect(html).toContain("Restoring your sealed reading…");
    expect(html).not.toContain("data-primary-card");
  });

  it("requires the relating bundle only when a relating hexagram exists", async () => {
    const still = buildPublicReading({
      method: "three-coin",
      methodVersion: "three-coin-v1",
      lineValuesBottomUp: [7, 7, 7, 7, 7, 7],
      evidence: { kind: "history", originalMethod: "three-coin" },
    });
    expect(still.relatingHexagram).toBeNull();
    const primary = await loadHexagramInterpretation(still.primaryHexagram);
    expect(hasRequiredInterpretationBundles(
      still.primaryHexagram,
      still.relatingHexagram,
      { primary, relating: null },
    )).toBe(true);

    const moving = buildPublicReading({
      method: "three-coin",
      methodVersion: "three-coin-v1",
      lineValuesBottomUp: [9, 7, 7, 7, 7, 7],
      evidence: { kind: "history", originalMethod: "three-coin" },
    });
    expect(moving.relatingHexagram).not.toBeNull();
    const movingPrimary = await loadHexagramInterpretation(moving.primaryHexagram);
    expect(hasRequiredInterpretationBundles(
      moving.primaryHexagram,
      moving.relatingHexagram,
      { primary: movingPrimary },
    )).toBe(false);
    const movingRelating = await loadHexagramInterpretation(moving.relatingHexagram!);
    expect(hasRequiredInterpretationBundles(
      moving.primaryHexagram,
      moving.relatingHexagram,
      { primary: movingPrimary, relating: movingRelating },
    )).toBe(true);
  });

  it("renders the final English primary and relating interpretation when both bundles are ready", async () => {
    const lineValues = [9, 7, 7, 7, 7, 7];
    const current = buildPublicReading({
      method: "three-coin",
      methodVersion: "three-coin-v1",
      lineValuesBottomUp: lineValues,
      evidence: { kind: "history", originalMethod: "three-coin" },
    });
    const primary = await loadHexagramInterpretation(current.primaryHexagram);
    const relating = await loadHexagramInterpretation(current.relatingHexagram!);

    const html = renderToStaticMarkup(
      <ThreeCoinResultClient
        locale="en"
        initialUser={{ id: "usr_1", email: "test@example.com" }}
        initialState={{ kind: "ready", lineValues }}
        initialInterpretationBundles={{ primary, relating }}
        initialCastingView={{
          castingId: "cast_saved",
          context: "",
          lineValuesBottomUp: lineValues,
          readingReport: null,
          owns: true,
        }}
      />,
    );

    expect(html).toContain("data-primary-card");
    expect(html).toContain("data-relating-card");
    expect(html).toContain(primary.hexagram.coreTheme);
    expect(html).toContain(relating.hexagram.coreTheme);
    expect(html).not.toContain("data-ritual-result-card");
    expect(html).toContain('data-active-line="1"');
    expect(html.match(/Get My Deep Reading/g)).toHaveLength(2);
    expect(html).not.toContain("Restoring your sealed reading…");
  });
});

describe("ThreeCoinResultClient Component Locale Routing & State Parity", () => {
  describe.each([
    { audience: "signed in without credits", user: { id: "usr_1", email: "test@example.com" }, credits: 0 },
    { audience: "signed in with a credit", user: { id: "usr_1", email: "test@example.com" }, credits: 1 },
  ])("risk boundary for $audience", ({ user, credits }) => {
    it.each([
      "Should I stop taking my prescribed medication?",
      "Should I file a lawsuit against my landlord?",
      "Should I buy bitcoin with my savings?",
      "I want to hurt myself tonight.",
    ])("keeps the free result but offers no purchase or generation for %s", (question) => {
      const result = <ThreeCoinResultClient initialUser={user} initialCredits={credits}
          initialState={{ kind: "ready", lineValues: [7, 7, 7, 7, 7, 7], question }}
          initialCastingView={{
            castingId: "cast_risk",
            context: question,
            lineValuesBottomUp: [7, 7, 7, 7, 7, 7],
            readingReport: null,
            owns: true,
          }} />;
      const freeHtml = renderToStaticMarkup(result);
      const html = renderToStaticMarkup(React.cloneElement(result, { pageMode: "deep" }));
      expect(freeHtml).toContain("data-primary-card");
      expect(freeHtml).not.toContain("data-start-deep-reading");
      expect(freeHtml).not.toContain("Choose a Deep Reading pack");
      expect(html).toContain('data-deep-reading-blocked="risk"');
      expect(html).not.toContain("data-primary-card");
      expect(html).toContain("View Free Reading");
      expect(html).not.toContain("Choose a Deep Reading pack");
      expect(html).not.toContain("Sign in to continue");
      expect(html).not.toContain("data-start-deep-reading");
      expect(html).toContain(question.includes("hurt myself") ? "local emergency services" : "qualified professional");
    });
  });

  it.each([
    { question: "我要自杀", expected: "紧急服务" },
    { question: "停止用药", expected: "合格专业人士" },
  ])("shows risk guidance before the short-question fallback for $question", ({ question, expected }) => {
    const html = renderToStaticMarkup(
      <ThreeCoinResultClient
        pageMode="deep" locale="zh-Hans" initialLocalizedContent={ZH_TEST_READING_CONTENT}
        initialUser={{ id: "usr_1", email: "test@example.com" }}
        initialCredits={0}
        initialState={{ kind: "ready", lineValues: [7, 7, 7, 7, 7, 7], question }}
        initialCastingView={{
          castingId: "cast_risk_zh",
          context: question,
          lineValuesBottomUp: [7, 7, 7, 7, 7, 7],
          readingReport: null,
          owns: true,
        }}
      />,
    );
    expect(html).toContain('data-deep-reading-blocked="risk"');
    expect(html).not.toContain('data-deep-reading-blocked="missing-question"');
    expect(html).toContain(expected);
    expect(html).not.toContain("选择深度解读次数包");
    expect(html).not.toContain("data-start-deep-reading");
    expect(html).toContain("查看免费解卦");
    expect(html).not.toContain("data-primary-card");
  });

  it("keeps an anonymous high-risk completed cast behind the auth gate without leaking interpretation", () => {
    const html = renderToStaticMarkup(
      <ThreeCoinResultClient locale="zh-Hans" initialLocalizedContent={ZH_TEST_READING_CONTENT}
        initialState={{ kind: "ready", lineValues: [7, 7, 7, 7, 7, 7], question: "我是否应该停止服用处方药？" }} />,
    );
    expect(html).toContain('data-completed-cast-gate="auth-required"');
    expect(html).toContain("登录、保存并查看本次卦象");
    expect(html).not.toContain("data-primary-card");
    expect(html).not.toContain("免费卦象解读仍可完整查看");
  });

  it("renders empty state pointing to /zh/methods/three-coin in Chinese mode", () => {
    const html = renderToStaticMarkup(
      <ThreeCoinResultClient locale="zh-Hans" initialLocalizedContent={ZH_TEST_READING_CONTENT} initialState={{ kind: "empty" }} />,
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
        locale="zh-Hans" initialLocalizedContent={ZH_TEST_READING_CONTENT}
        initialUser={{ id: "usr_1", email: "test@example.com" }}
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

  it("renders historical commercial report on independent Chinese Deep page with account history link", () => {
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
        pageMode="deep"
        locale="zh-Hans" initialLocalizedContent={ZH_TEST_READING_CONTENT}
        initialUser={{ id: "usr_1", email: "test@example.com" }}
        initialState={{ kind: "ready", lineValues: [7, 7, 7, 9, 7, 7], createdAt: "2026-09-25T10:00:00.000Z" }}
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
    expect(html).not.toContain('href="/zh/my-readings"');
    expect(html).toContain("AI 深度解读");
    expect(html).toContain("核心回答");
    expect(html).toContain("测试摘要");
    expect(html).toContain("查看完整卦象解读");
    expect(html).toContain('href="/zh/readings/result?session=cast_1"');
    expect(html).not.toContain("旧版报告格式");
    expect(html).not.toContain("起卦依据");
    expect(html).not.toContain('data-save-reading');
    expect(html).toContain('data-deep-reading-page');
  });

  it("renders historical v2 report on independent English Deep page with account history link", () => {
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
        pageMode="deep"
        locale="en"
        initialUser={{ id: "usr_1", email: "test@example.com" }}
        initialState={{ kind: "ready", lineValues: [7, 7, 7, 9, 7, 7] }}
        initialCastingView={{
          castingId: "cast_1",
          context: "Career test",
          lineValuesBottomUp: [7, 7, 7, 9, 7, 7],
          readingReport: mockReport,
          owns: true,
        }}
      />,
    );
    expect(html).not.toContain('href="/my-readings"');
    expect(html).not.toContain('href="/zh/my-readings"');
    expect(html).toContain("AI Deep Reading");
    expect(html).toContain(mockReport.directAnswer);
    expect(html).toContain("View the Full Hexagram Interpretation");
    expect(html).toContain('href="/readings/result?session=cast_1"');
    expect(html).not.toContain("Cast Basis");
    expect(html).not.toContain("The saved evidence bundle is unavailable.");
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
        pageMode="deep"
        locale="en"
        initialUser={{ id: "usr_1", email: "test@example.com" }}
        initialCredits={0}
        initialState={{ kind: "ready", lineValues: [7, 7, 7, 7, 7, 7], question: "What should I focus on now?" }}
        initialCastingView={{ castingId: "cast_1", context: "Career test", lineValuesBottomUp: [7, 7, 7, 7, 7, 7], readingReport: null, owns: true }}
      />,
    );

    expect(html).toContain("Choose a Deep Reading pack");
    expect(html).toContain("No generation starts until a credit is available");
    expect(html).not.toContain("data-context-enrichment-form");
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain("data-start-deep-reading");
  });

  it("keeps the complete free interpretation and early Deep Reading entry in one localized result", () => {
    const html = renderToStaticMarkup(
      <ThreeCoinResultClient
        locale="zh-Hans" initialLocalizedContent={ZH_TEST_READING_CONTENT}
        initialUser={{ id: "usr_1", email: "test@example.com" }}
        initialState={{
          kind: "ready", lineValues: [7, 7, 7, 7, 7, 7],
          question: "这次变化中我应该先看清什么？",
          createdAt: "2026-09-25T10:00:00.000Z",
        }}
        initialCastingView={{
          castingId: "cast_public_result",
          context: "这次变化中我应该先看清什么？",
          lineValuesBottomUp: [7, 7, 7, 7, 7, 7],
          readingReport: null,
          owns: true,
        }}
      />,
    );

    const boundaryPosition = html.indexOf("data-free-cast-boundary");
    const deepPosition = html.indexOf('data-deep-reading-cta="top"');
    const freeDetailsPosition = html.indexOf("data-primary-card");
    expect(html).toContain('data-public-reading-result');
    expect(html).toContain("免费解卦");
    expect(html.match(/获取我的深度解读/g)).toHaveLength(2);
    expect(html).toContain('href="/zh/readings/deep?session=cast_public_result"');
    expect(html).not.toContain("data-context-enrichment-form");
    expect(html).toContain('href="/zh/hexagrams/1-the-creative"');
    expect(boundaryPosition).toBeGreaterThanOrEqual(0);
    expect(deepPosition).toBeGreaterThanOrEqual(0);
    expect(boundaryPosition).toBeGreaterThan(deepPosition);
    expect(freeDetailsPosition).toBeGreaterThan(deepPosition);
  });

  it("keeps retired context forms, enrichment fields and purchase UI out of localized Free pages", () => {
    const htmlZh = renderToStaticMarkup(
      <ThreeCoinResultClient
        locale="zh-Hans" initialLocalizedContent={ZH_TEST_READING_CONTENT}
        initialUser={{ id: "usr_1", email: "test@example.com" }}
        initialCredits={0}
        initialState={{
          kind: "ready", lineValues: [7, 7, 7, 7, 7, 7],
          question: "我的核心问题是否能够解决？",
          createdAt: "2026-09-25T10:00:00.000Z",
        }}
        initialCastingView={{
          castingId: "cast_pricing_test",
          context: "我的核心问题是否能够解决？",
          lineValuesBottomUp: [7, 7, 7, 7, 7, 7],
          readingReport: null,
          owns: true,
        }}
      />,
    );

    expect(htmlZh).toContain("免费解卦");
    expect(htmlZh.match(/获取我的深度解读/g)).toHaveLength(2);
    for (const retired of ["说明你的具体处境与关键事实", "你最想看清什么？", "data-context-enrichment-form", "<textarea", "选择深度解读次数包", "data-start-deep-reading"]) expect(htmlZh).not.toContain(retired);

    const htmlEn = renderToStaticMarkup(
      <ThreeCoinResultClient
        locale="en"
        initialUser={{ id: "usr_1", email: "test@example.com" }}
        initialCredits={0}
        initialState={{
          kind: "ready", lineValues: [7, 7, 7, 7, 7, 7],
          question: "How should I approach this transition?",
          createdAt: "2026-09-25T10:00:00.000Z",
        }}
        initialCastingView={{
          castingId: "cast_pricing_test_en",
          context: "How should I approach this transition?",
          lineValuesBottomUp: [7, 7, 7, 7, 7, 7],
          readingReport: null,
          owns: true,
        }}
      />,
    );

    expect(htmlEn).toContain("Your Free Reading");
    expect(htmlEn.match(/Get My Deep Reading/g)).toHaveLength(2);
    for (const retired of ["Tell us what matters in your situation", "What would you like clarity on?", "data-context-enrichment-form", "<textarea", "Choose a Deep Reading pack", "data-start-deep-reading"]) expect(htmlEn).not.toContain(retired);
  });

  it("preserves historical v2 content and evidence in four read-only report categories", () => {
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
      scene: "other" as const,
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
      <AiDeepReadingResult
        report={mockReport}
        snapshot={mockSnapshot}
        locale="en"
        question={mockSnapshot.coreQuestionAtCast}
        createdAt={mockSnapshot.snapshotAt}
        freeHref="/readings/result?session=cast_test"
      />,
    );
    expect(htmlEn).toContain('data-ai-deep-reading-report');
    for (const heading of ["Core Answer", "Why This Is the Case", "What This Change Can Bring", "When It’s Worth Taking Action", "What You Should Do Now"]) expect(htmlEn).toContain(heading);
    expect(htmlEn).toContain(mockReport.situationMapping);
    expect(htmlEn).toContain(mockReport.conditionalDirection);
    expect(htmlEn).toContain(mockReport.practicalReflection);
    expect(htmlEn).toContain('href="/readings/result?session=cast_test"');
    expect(htmlEn).not.toContain('data-evidence-id="primary.judgment"');
    expect(htmlEn).not.toContain(mockSnapshot.context.contextNotes);

    const htmlZh = renderToStaticMarkup(
      <AiDeepReadingResult
        report={mockReport}
        snapshot={mockSnapshot}
        locale="zh-Hans"
        question={mockSnapshot.coreQuestionAtCast}
        createdAt={mockSnapshot.snapshotAt}
        freeHref="/zh/readings/result?session=cast_test"
      />,
    );
    for (const heading of ["核心回答", "为什么会得出这个判断", "这件事可能带来什么变化", "什么情况下值得行动", "你现在应该做什么"]) expect(htmlZh).toContain(heading);
    expect(htmlZh).toContain("查看完整卦象解读");
    expect(htmlZh).toContain(mockReport.uncertaintyAndBoundaries);
    expect(htmlZh).toContain(mockReport.disclaimer);
  });
});


describe("Deep Reading polling contract", () => {
  it("uses recursive timeout polling rather than an overlapping interval loop", () => {
    const source = readFileSync(new URL("./three-coin-result-client.tsx", import.meta.url), "utf8");
    expect(source).toContain("pollInFlightRef");
    expect(source).toContain('document.visibilityState === "hidden"');
    expect(source).toContain("setTimeout(() => { void poll(); }, delay)");
    expect(source).not.toContain("setInterval(async () =>");
  });

  it("does not guess the post-reservation credit balance on the client", () => {
    const source = readFileSync(new URL("./three-coin-result-client.tsx", import.meta.url), "utf8");
    expect(source).not.toContain("setCredits((prev) => Math.max(0, prev - 1))");
    expect(source).toContain("setCredits(data.availableCredits)");
  });
});
