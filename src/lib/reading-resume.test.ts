import { afterEach, describe, expect, it, vi } from "vitest";
import { ALGORITHM_VERSIONS } from "@/domain/casting/types";
import type { ThreeCoinStep } from "@/domain/casting/three-coin/algorithm";
import { patchThreeCoinQuestionSession, writeThreeCoinSteps } from "./three-coin-session";
import {
  LOCALE_CONTINUATION_STORAGE_KEY,
  clearLiveFlowRegistration,
  consumeLocaleContinuation,
  currentMethodSessionId,
  decideReadingResume,
  detectMethodResume,
  getLiveFlowRegistration,
  issueLocaleContinuationIntent,
  manualResumeState,
  NO_READING_RESUME,
  prepareLocaleContinuationClick,
  readLocaleContinuationRecord,
  registerLiveFlow,
  registerLiveFlowFromSession,
  resumeProgressLabel,
  threeCoinResumeState,
  yarrowResumeState,
} from "./reading-resume";
import { MANUAL_SESSION_STORAGE_KEY, YARROW_SESSION_STORAGE_KEY } from "./method-session-retirement";
import { MANUAL_CAST_DRAFT_STORAGE_KEY } from "./manual-cast-draft";

function step(lineIndex: number): ThreeCoinStep {
  return {
    lineIndex: lineIndex as ThreeCoinStep["lineIndex"],
    coinFaces: ["yang", "yin", "yin"],
    lineValue: 7,
    algorithmVersion: ALGORITHM_VERSIONS.three_coin,
  };
}

function stubBrowserStorage() {
  const sessionMemory = new Map<string, string>();
  vi.stubGlobal("window", {
    sessionStorage: {
      getItem: (key: string) => sessionMemory.get(key) ?? null,
      setItem: (key: string, value: string) => sessionMemory.set(key, value),
      removeItem: (key: string) => sessionMemory.delete(key),
      clear: () => sessionMemory.clear(),
      key: (index: number) => [...sessionMemory.keys()][index] ?? null,
      get length() { return sessionMemory.size; },
    },
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
  });
  return sessionMemory;
}

afterEach(() => vi.unstubAllGlobals());

describe("C1 — passive resume decision rule", () => {
  it("returns none when there is no partial and no sealed reading", () => {
    expect(decideReadingResume({ method: "manual", partial: null })).toEqual(NO_READING_RESUME);
  });

  it("treats 4 of 6 lines as resumable and 6 of 6 as not resumable", () => {
    const partial = decideReadingResume({
      method: "three-coin",
      partial: { completed: 4, total: 6, unit: "lines" },
      partialReadingId: "reading-a",
      stage: "ritual",
    });
    expect(partial).toMatchObject({ kind: "partial", readingId: "reading-a", stage: "ritual" });

    expect(decideReadingResume({
      method: "three-coin",
      partial: { completed: 6, total: 6, unit: "lines" },
      partialReadingId: "reading-a",
    })).toEqual(NO_READING_RESUME);
  });

  it("treats 8 of 18 yarrow changes as resumable", () => {
    expect(decideReadingResume({
      method: "yarrow-stalks",
      partial: { completed: 8, total: 18, unit: "changes" },
      partialReadingId: "reading-b",
    })).toMatchObject({ kind: "partial", readingId: "reading-b" });
  });

  it("lets sealed completion outrank a leftover draft", () => {
    expect(decideReadingResume({
      method: "manual",
      partial: { completed: 0, total: 1, unit: "draft" },
      partialReadingId: "manual-draft",
      sealedReadingId: "reading-sealed",
    })).toMatchObject({ kind: "sealed", readingId: "reading-sealed" });
  });

  it("allows a saved draft and a saved question as partial entry points", () => {
    expect(decideReadingResume({
      method: "manual",
      partial: { completed: 0, total: 1, unit: "draft" },
      partialReadingId: "manual-draft",
      stage: "draft",
    })).toMatchObject({ kind: "partial", stage: "draft" });

    expect(decideReadingResume({
      method: "three-coin",
      partial: { completed: 0, total: 6, unit: "lines" },
      partialReadingId: "reading-c",
      stage: "question-confirm",
    })).toMatchObject({ kind: "partial", stage: "question-confirm" });
  });

  it("labels each method's progress", () => {
    const threeCoin = decideReadingResume({
      method: "three-coin",
      partial: { completed: 4, total: 6, unit: "lines" },
      partialReadingId: "a",
    });
    const yarrow = decideReadingResume({
      method: "yarrow-stalks",
      partial: { completed: 8, total: 18, unit: "changes" },
      partialReadingId: "b",
    });
    expect(resumeProgressLabel(threeCoin, false)).toBe("4 / 6 lines");
    expect(resumeProgressLabel(threeCoin, true)).toBe("4 / 6 爻");
    expect(resumeProgressLabel(yarrow, false)).toBe("8 / 18 changes");
    expect(resumeProgressLabel(NO_READING_RESUME, false)).toBe("");
  });
});

describe("C1 — Three Coin adapter", () => {
  it("reports a 4/6 partial cast without entering it", () => {
    stubBrowserStorage();
    expect(patchThreeCoinQuestionSession({
      started: true,
      question: "Should I continue?",
      coreQuestionAtCast: "Should I continue?",
      coreQuestionFrozenAtCast: true,
    })).toBe(true);
    writeThreeCoinSteps([0, 1, 2, 3].map(step));
    expect(threeCoinResumeState()).toMatchObject({
      kind: "partial",
      method: "three-coin",
      progress: { completed: 4, total: 6, unit: "lines" },
      stage: "ritual",
    });
  });

  it("reports a completed 6/6 cast as sealed, never as a resumable partial", () => {
    stubBrowserStorage();
    expect(patchThreeCoinQuestionSession({
      started: true,
      question: "Should I continue?",
      coreQuestionAtCast: "Should I continue?",
      coreQuestionFrozenAtCast: true,
    })).toBe(true);
    writeThreeCoinSteps([0, 1, 2, 3, 4, 5].map(step));
    expect(threeCoinResumeState()).toMatchObject({ kind: "sealed", method: "three-coin" });
  });

  it("reports a saved question as a question-confirm resume", () => {
    stubBrowserStorage();
    expect(patchThreeCoinQuestionSession({ started: true, question: "Should I continue?" })).toBe(true);
    expect(threeCoinResumeState()).toMatchObject({
      kind: "partial",
      stage: "question-confirm",
      progress: { completed: 0, total: 6, unit: "lines" },
    });
  });

  it("reports nothing when no session exists", () => {
    stubBrowserStorage();
    expect(threeCoinResumeState()).toEqual(NO_READING_RESUME);
  });
});

describe("C1 — QuestionFirst-bound method adapters", () => {
  const createdAt = "2026-11-15T01:00:00.000Z";

  function yarrowChanges(count: number) {
    return Array.from({ length: count }, (_, index) => ({
      lineIndex: Math.floor(index / 3),
      changeIndex: index % 3,
      startingStalks: 49,
      endingStalks: 36,
      leftGroup: 20,
      rightGroup: 28,
      leftRemainder: 4,
      rightRemainder: 4,
      algorithmVersion: "yarrow-zhu-xi-digital-v2",
    }));
  }

  it("detects a stored Yarrow 8/18 partial without applying it", () => {
    const sessionMemory = stubBrowserStorage();
    sessionMemory.set(YARROW_SESSION_STORAGE_KEY, JSON.stringify({
      schemaVersion: 1,
      id: "yarrow-partial-a",
      createdAt,
      started: true,
      question: "Should I stay on this path?",
      coreQuestionAtCast: "Should I stay on this path?",
      coreQuestionFrozenAtCast: true,
      data: { changes: yarrowChanges(8) },
    }));

    const state = yarrowResumeState();
    expect(state).toMatchObject({
      kind: "partial",
      method: "yarrow-stalks",
      readingId: "yarrow-partial-a",
      progress: { completed: 8, total: 18, unit: "changes" },
      stage: "ritual",
    });
    expect(resumeProgressLabel(state, false)).toBe("8 / 18 changes");
    expect(detectMethodResume("yarrow-stalks")).toEqual(state);
  });

  it("treats a completed 18/18 Yarrow session as sealed, never resumable", () => {
    const sessionMemory = stubBrowserStorage();
    sessionMemory.set(YARROW_SESSION_STORAGE_KEY, JSON.stringify({
      schemaVersion: 1,
      id: "yarrow-sealed",
      createdAt,
      started: true,
      coreQuestionFrozenAtCast: true,
      data: { changes: yarrowChanges(18) },
    }));
    expect(yarrowResumeState()).toMatchObject({ kind: "sealed", readingId: "yarrow-sealed" });
  });

  it("detects a stored Manual draft as a resumable partial", () => {
    const sessionMemory = stubBrowserStorage();
    const question = "Should I move to Kyoto?";
    sessionMemory.set(MANUAL_SESSION_STORAGE_KEY, JSON.stringify({
      schemaVersion: 1,
      id: "manual-draft-session",
      createdAt,
      started: true,
      question,
    }));
    sessionMemory.set(MANUAL_CAST_DRAFT_STORAGE_KEY, JSON.stringify({
      schemaVersion: 1,
      questionKey: question,
      mode: "primary-changing",
      lineValuesBottomUp: [7, 7, 7, 7, 7, 7],
      primaryHexagram: 1,
      changingLines: [2, 4],
    }));

    const state = manualResumeState();
    expect(state).toMatchObject({
      kind: "partial",
      method: "manual",
      progress: { unit: "draft" },
      stage: "draft",
    });
    expect(resumeProgressLabel(state, false)).toBe("saved draft");
    expect(detectMethodResume("manual")).toEqual(state);
  });

  it("sealed Manual facts outrank a leftover draft", () => {
    const sessionMemory = stubBrowserStorage();
    sessionMemory.set(MANUAL_SESSION_STORAGE_KEY, JSON.stringify({
      schemaVersion: 1,
      id: "manual-sealed",
      createdAt,
      started: true,
      coreQuestionFrozenAtCast: true,
      data: {
        mode: "line-values",
        lineValuesBottomUp: [7, 8, 9, 6, 7, 8],
        evidence: { kind: "manual", mode: "line-values" },
      },
    }));
    sessionMemory.set(MANUAL_CAST_DRAFT_STORAGE_KEY, JSON.stringify({
      schemaVersion: 1,
      questionKey: null,
      mode: "line-values",
      lineValuesBottomUp: [7, 7, 7, 7, 7, 7],
      primaryHexagram: 1,
      changingLines: [],
    }));
    expect(manualResumeState()).toMatchObject({ kind: "sealed", readingId: "manual-sealed" });
  });

  it("returns nothing when the method has no resume adapter", () => {
    expect(detectMethodResume("three-coin")).toEqual(NO_READING_RESUME);
    expect(detectMethodResume(null)).toEqual(NO_READING_RESUME);
  });
});


describe("C9 — Active-Flow Locale Continuation Intent", () => {
  it("issues, validates against the authoritative method session, and consumes exactly once", () => {
    const sessionMemory = stubBrowserStorage();
    writeThreeCoinSteps([step(0), step(1), step(2), step(3)]);
    const readingId = currentMethodSessionId("three-coin");
    expect(readingId).toBeTruthy();

    expect(issueLocaleContinuationIntent({
      method: "three-coin",
      readingId: readingId!,
      targetLocale: "zh-Hans",
    })).toBe(true);
    expect(consumeLocaleContinuation({
      method: "three-coin",
      locale: "zh-Hans",
      sessionId: readingId,
    })).toBe(true);
    expect(sessionMemory.has(LOCALE_CONTINUATION_STORAGE_KEY)).toBe(false);
    expect(consumeLocaleContinuation({
      method: "three-coin",
      locale: "zh-Hans",
      sessionId: readingId,
    })).toBe(false);
  });

  it("deletes an intent issued in the future and returns false", () => {
    const sessionMemory = stubBrowserStorage();
    expect(issueLocaleContinuationIntent({
      method: "three-coin",
      readingId: "reading-A",
      targetLocale: "zh-Hans",
    })).toBe(true);
    const future = JSON.parse(sessionMemory.get(LOCALE_CONTINUATION_STORAGE_KEY) ?? "{}");
    future.issuedAt = Date.now() + 1_000;
    sessionMemory.set(LOCALE_CONTINUATION_STORAGE_KEY, JSON.stringify(future));

    expect(consumeLocaleContinuation({
      method: "three-coin",
      locale: "zh-Hans",
      sessionId: "reading-A",
    })).toBe(false);
    expect(sessionMemory.has(LOCALE_CONTINUATION_STORAGE_KEY)).toBe(false);
  });

  it("deletes an expired intent and returns false", () => {
    const sessionMemory = stubBrowserStorage();
    expect(issueLocaleContinuationIntent({
      method: "three-coin",
      readingId: "reading-A",
      targetLocale: "zh-Hans",
    })).toBe(true);
    const stale = JSON.parse(sessionMemory.get(LOCALE_CONTINUATION_STORAGE_KEY) ?? "{}");
    stale.issuedAt = Date.now() - 61_000;
    sessionMemory.set(LOCALE_CONTINUATION_STORAGE_KEY, JSON.stringify(stale));

    expect(consumeLocaleContinuation({
      method: "three-coin",
      locale: "zh-Hans",
      sessionId: "reading-A",
    })).toBe(false);
    expect(sessionMemory.has(LOCALE_CONTINUATION_STORAGE_KEY)).toBe(false);
  });

  it.each([
    ["method", { method: "yarrow-stalks" as const, locale: "zh-Hans" as const, sessionId: "reading-A" }],
    ["readingId", { method: "three-coin" as const, locale: "zh-Hans" as const, sessionId: "reading-B" }],
    ["locale", { method: "three-coin" as const, locale: "en" as const, sessionId: "reading-A" }],
  ])("deletes and rejects a %s mismatch", (_label, consumeInput) => {
    const sessionMemory = stubBrowserStorage();
    issueLocaleContinuationIntent({
      method: "three-coin",
      readingId: "reading-A",
      targetLocale: "zh-Hans",
    });
    expect(consumeLocaleContinuation(consumeInput)).toBe(false);
    expect(sessionMemory.has(LOCALE_CONTINUATION_STORAGE_KEY)).toBe(false);
  });

  it("deletes and rejects a malformed or payload-bearing record", () => {
    const sessionMemory = stubBrowserStorage();
    const badRecords = [
      "not-json",
      JSON.stringify({ schemaVersion: 2, nonce: "n", method: "three-coin", readingId: "A", targetLocale: "zh-Hans", issuedAt: Date.now() }),
      JSON.stringify({ schemaVersion: 1, nonce: "n", method: "three-coin", readingId: "A", targetLocale: "zh-Hans", issuedAt: Date.now(), question: "forbidden" }),
    ];
    for (const raw of badRecords) {
      sessionMemory.set(LOCALE_CONTINUATION_STORAGE_KEY, raw);
      expect(consumeLocaleContinuation({
        method: "three-coin",
        locale: "zh-Hans",
        sessionId: "A",
      })).toBe(false);
      expect(sessionMemory.has(LOCALE_CONTINUATION_STORAGE_KEY)).toBe(false);
    }
  });

  it("writes only the six-field continuation record and no reading payload", () => {
    stubBrowserStorage();
    expect(issueLocaleContinuationIntent({
      method: "three-coin",
      readingId: "reading-A",
      targetLocale: "zh-Hans",
    })).toBe(true);
    const record = readLocaleContinuationRecord();
    expect(record).not.toBeNull();
    expect(Object.keys(record!).sort()).toEqual([
      "issuedAt",
      "method",
      "nonce",
      "readingId",
      "schemaVersion",
      "targetLocale",
    ]);
    const raw = JSON.stringify(record);
    for (const forbidden of [
      "question",
      "lines",
      "changes",
      "draft",
      "hexagram",
      "steps",
      "lineValues",
      "payment",
      "account",
    ]) {
      expect(raw).not.toContain(forbidden);
    }
  });

  it("does not issue for modified or middle clicks", () => {
    const liveFlow = {
      method: "three-coin" as const,
      readingId: "reading-A",
      locale: "en" as const,
      active: true as const,
    };
    for (const event of [
      { button: 1, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false },
      { button: 0, metaKey: true, ctrlKey: false, shiftKey: false, altKey: false },
      { button: 0, metaKey: false, ctrlKey: true, shiftKey: false, altKey: false },
      { button: 0, metaKey: false, ctrlKey: false, shiftKey: true, altKey: false },
      { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: true },
    ]) {
      const issueIntent = vi.fn(() => true);
      expect(prepareLocaleContinuationClick({
        event,
        targetLocale: "zh-Hans",
        liveFlow,
        issueIntent,
      })).toBe("ignore");
      expect(issueIntent).not.toHaveBeenCalled();
    }
  });

  it("cancels a plain locale navigation when the active-flow intent write fails", () => {
    const issueIntent = vi.fn(() => false);
    expect(prepareLocaleContinuationClick({
      event: { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false },
      targetLocale: "zh-Hans",
      liveFlow: {
        method: "three-coin",
        readingId: "reading-A",
        locale: "en",
        active: true,
      },
      issueIntent,
    })).toBe("cancel");
    expect(issueIntent).toHaveBeenCalledWith({
      method: "three-coin",
      readingId: "reading-A",
      targetLocale: "zh-Hans",
    });
  });

  it("returns false when sessionStorage rejects the intent write", () => {
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: () => null,
        setItem: () => { throw new DOMException("blocked", "SecurityError"); },
        removeItem: () => {},
      },
    });
    expect(issueLocaleContinuationIntent({
      method: "three-coin",
      readingId: "reading-A",
      targetLocale: "zh-Hans",
    })).toBe(false);
  });

  it("keeps passive detection separate from live registration, then registers only on activation", () => {
    stubBrowserStorage();
    clearLiveFlowRegistration();
    writeThreeCoinSteps([step(0)]);
    expect(threeCoinResumeState()).toMatchObject({ kind: "partial" });
    expect(getLiveFlowRegistration()).toBeNull();

    registerLiveFlowFromSession("three-coin", "en");
    expect(getLiveFlowRegistration()).toMatchObject({
      method: "three-coin",
      locale: "en",
      active: true,
    });
    expect(getLiveFlowRegistration()?.readingId).toBe(currentMethodSessionId("three-coin"));
  });

  it("clears the memory-only registration at a flow-end boundary", () => {
    clearLiveFlowRegistration();
    registerLiveFlow({
      method: "manual",
      readingId: "manual-A",
      locale: "en",
    });
    expect(getLiveFlowRegistration()).toEqual({
      method: "manual",
      readingId: "manual-A",
      locale: "en",
      active: true,
    });
    clearLiveFlowRegistration();
    expect(getLiveFlowRegistration()).toBeNull();
  });
});
