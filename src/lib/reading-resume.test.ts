import { afterEach, describe, expect, it, vi } from "vitest";
import { ALGORITHM_VERSIONS } from "@/domain/casting/types";
import type { ThreeCoinStep } from "@/domain/casting/three-coin/algorithm";
import { patchThreeCoinQuestionSession, writeThreeCoinSteps } from "./three-coin-session";
import {
  decideReadingResume,
  NO_READING_RESUME,
  resumeProgressLabel,
  threeCoinResumeState,
} from "./reading-resume";

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
