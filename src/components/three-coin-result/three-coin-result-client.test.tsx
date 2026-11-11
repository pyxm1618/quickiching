import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import Loadable from "next/dist/shared/lib/loadable.shared-runtime";
import { beforeAll, describe, expect, it, vi } from "vitest";

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
import { normalizeDeepReadingViewModel } from "@/domain/generation/deep-reading-view-model";

beforeAll(async () => {
  await Loadable.preloadAll();
});

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

  it("keeps a signed-in completed cast behind saving until account persistence succeeds", () => {
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
    expect(html).toContain("data-account-reading-saving");
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
      evidence: { kind: "three-coin", steps: [] },
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
      evidence: { kind: "three-coin", steps: [] },
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
      evidence: { kind: "three-coin", steps: [] },
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
          owns: true,
        }}
      />,
    );

    expect(html).toContain("data-primary-card");
    expect(html).toContain("data-relating-card");
    expect(html).toContain(primary.hexagram.coreTheme);
    expect(html).toContain(relating.hexagram.coreTheme);
    expect(html).toContain("data-ritual-result-card");
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
    expect(html).toContain('href="/zh"');
    expect(html).not.toContain('href="/#three-coin-reading"');
    expect(html).toContain("重新起一卦");
    expect(html).toContain("没有找到已完成的起卦");
  });

  it("renders the shared empty state pointing to the reading entry in English mode", () => {
    const html = renderToStaticMarkup(
      <ThreeCoinResultClient locale="en" initialState={{ kind: "empty" }} />,
    );
    expect(html).toContain('href="/"');
    expect(html).toContain("Start a New Reading");
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
    expect(html).toContain('href="/zh"');
    expect(html).not.toContain('href="/#three-coin-reading"');
    expect(html).toContain("返回起卦入口");
    expect(html).toContain("无法恢复这次已落定的起卦结果");
  });

  it("renders error state pointing to /#three-coin-reading in English mode", () => {
    const html = renderToStaticMarkup(
      <ThreeCoinResultClient
        locale="en"
        initialState={{ kind: "error", code: "TEST_ERROR" }}
      />,
    );
    expect(html).toContain('href="/"');
    expect(html).toContain("Return to Reading Methods");
    expect(html).toContain("The sealed reading could not be interpreted");
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
        initialCastingView={{ castingId: "cast_1", context: "Career test", lineValuesBottomUp: [7, 7, 7, 7, 7, 7], owns: true }}
      />,
    );

    expect(html).toContain("Choose a Deep Reading pack");
    expect(html).toContain("Buying credits does not start generation.");
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
          owns: true,
        }}
      />,
    );

    expect(htmlEn).toContain("Your Free Reading");
    expect(htmlEn.match(/Get My Deep Reading/g)).toHaveLength(2);
    for (const retired of ["Tell us what matters in your situation", "What would you like clarity on?", "data-context-enrichment-form", "<textarea", "Choose a Deep Reading pack", "data-start-deep-reading"]) expect(htmlEn).not.toContain(retired);
  });

  it("uses recursive timeout polling rather than an overlapping interval loop", () => {
    const source = readFileSync(new URL("../reading-result/reading-result-client.tsx", import.meta.url), "utf8");
    expect(source).toContain("pollInFlightRef");
    expect(source).toContain('document.visibilityState === "hidden"');
    expect(source).toContain("setTimeout(() => { void poll(); }, delay)");
    expect(source).not.toContain("setInterval(async () =>");
  });

  it("does not guess the post-reservation credit balance on the client", () => {
    const source = readFileSync(new URL("../reading-result/reading-result-client.tsx", import.meta.url), "utf8");
    expect(source).not.toContain("setCredits((prev) => Math.max(0, prev - 1))");
    expect(source).toContain("setCredits(data.availableCredits)");
  });
});
