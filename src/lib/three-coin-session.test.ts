import { afterEach, describe, expect, it, vi } from "vitest";
import { ALGORITHM_VERSIONS } from "@/domain/casting/types";
import type { ThreeCoinStep } from "@/domain/casting/three-coin/algorithm";
import {
  clearThreeCoinReading,
  completedThreeCoinSteps,
  parseThreeCoinSteps,
  patchThreeCoinQuestionSession,
  readThreeCoinQuestionState,
  readThreeCoinSession,
  THREE_COIN_SESSION_STORAGE_KEY,
  writeThreeCoinSteps,
} from "./three-coin-session";

function step(lineIndex: number, lineValue: 6 | 7 | 8 | 9 = 7): ThreeCoinStep {
  return {
    lineIndex: lineIndex as ThreeCoinStep["lineIndex"],
    coinFaces: lineValue === 6
      ? ["yin", "yin", "yin"]
      : lineValue === 7
        ? ["yang", "yin", "yin"]
        : lineValue === 8
          ? ["yang", "yang", "yin"]
          : ["yang", "yang", "yang"],
    lineValue,
    algorithmVersion: ALGORITHM_VERSIONS.three_coin,
  };
}

function validSteps(count = 6): ThreeCoinStep[] {
  return Array.from({ length: count }, (_, index) => step(index, ([7, 8, 9, 6, 7, 8] as const)[index] ?? 7));
}

function storageWith(overrides: Partial<Storage>): Storage {
  return {
    length: 0,
    clear() {},
    getItem() { return null; },
    key() { return null; },
    removeItem() {},
    setItem() {},
    ...overrides,
  } as Storage;
}

function stubWindowStorage(storage: Storage) {
  vi.stubGlobal("window", { sessionStorage: storage });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Three-Coin browser session contract", () => {
  it("keeps the established storage key stable", () => {
    expect(THREE_COIN_SESSION_STORAGE_KEY).toBe("quickiching:public-v1:three-coin");
  });

  it("accepts a valid partial cast without treating it as completed", () => {
    const parsed = parseThreeCoinSteps(JSON.stringify(validSteps(4)));
    expect(parsed).toHaveLength(4);
    expect(completedThreeCoinSteps(parsed)).toBeNull();
  });

  it("accepts exactly six valid sequential steps as a completed cast", () => {
    const parsed = parseThreeCoinSteps(JSON.stringify(validSteps()));
    const completed = completedThreeCoinSteps(parsed);
    expect(completed).not.toBeNull();
    expect(completed?.map((entry) => entry.lineIndex)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(completed?.map((entry) => entry.lineValue)).toEqual([7, 8, 9, 6, 7, 8]);
  });

  it.each([
    ["malformed json", "{"],
    ["non-array", JSON.stringify({ lineIndex: 0 })],
    ["too many steps", JSON.stringify(validSteps(6).concat(step(5)))],
    ["discontinuous indexes", JSON.stringify([step(0), step(2)])],
    ["invalid line value", JSON.stringify([{ ...step(0), lineValue: 5 }])],
    ["invalid coin face", JSON.stringify([{ ...step(0), coinFaces: ["yang", "yin", "edge"] }])],
    ["wrong algorithm version", JSON.stringify([{ ...step(0), algorithmVersion: "three-coin-v0" }])],
  ])("rejects %s", (_label, raw) => {
    expect(parseThreeCoinSteps(raw)).toEqual([]);
  });

  it("rejects a line value that does not agree with the stored coin faces", () => {
    expect(parseThreeCoinSteps(JSON.stringify([{ ...step(0, 7), lineValue: 9 }]))).toEqual([]);
  });

  it("throws a specific error when sessionStorage.getItem is unavailable", () => {
    stubWindowStorage(storageWith({
      getItem() {
        throw new Error("storage blocked");
      },
    }));

    expect(() => readThreeCoinSession()).toThrowError("THREE_COIN_SESSION_UNAVAILABLE");
  });

  it("throws a specific error when sessionStorage.setItem fails", () => {
    stubWindowStorage(storageWith({
      setItem() {
        throw new Error("quota exceeded");
      },
    }));

    expect(() => writeThreeCoinSteps(validSteps(1))).toThrowError("THREE_COIN_SESSION_WRITE_FAILED");
  });

  it("throws a specific error when sessionStorage.removeItem fails during clear", () => {
    stubWindowStorage(storageWith({
      removeItem() {
        throw new Error("storage blocked");
      },
    }));

    expect(() => clearThreeCoinReading()).toThrowError("THREE_COIN_SESSION_CLEAR_FAILED");
  });

  it("does not revive the retired raw-array Three-Coin session model", () => {
    const values = new Map<string, string>([
      [THREE_COIN_SESSION_STORAGE_KEY, JSON.stringify(validSteps(2))],
    ]);
    vi.stubGlobal("window", {
      sessionStorage: storageWith({
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      }),
    });

    expect(readThreeCoinSession()).toBeNull();
    expect(readThreeCoinQuestionState()).toEqual({
      started: false,
      coreQuestionFrozenAtCast: false,
    });
  });

  it("does not revive the retired unversioned object session model", () => {
    const values = new Map<string, string>([
      [THREE_COIN_SESSION_STORAGE_KEY, JSON.stringify({ steps: validSteps(2) })],
    ]);
    vi.stubGlobal("window", {
      sessionStorage: storageWith({
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      }),
    });

    expect(readThreeCoinSession()).toBeNull();
    expect(readThreeCoinQuestionState()).toEqual({
      started: false,
      coreQuestionFrozenAtCast: false,
    });

    expect(patchThreeCoinQuestionSession({
      started: true,
      question: "Should I continue?",
    })).toBe(true);
    expect(JSON.parse(values.get(THREE_COIN_SESSION_STORAGE_KEY) ?? "null")).toMatchObject({
      schemaVersion: 1,
      started: true,
      question: "Should I continue?",
    });
  });

  it("C4/C6: never reads or writes the retired 24h completed backup", () => {
    const sessionMemory = new Map<string, string>();
    const localMemory = new Map<string, string>();
    vi.stubGlobal("window", {
      sessionStorage: storageWith({
        getItem: (key: string) => sessionMemory.get(key) ?? null,
        setItem: (key: string, value: string) => sessionMemory.set(key, value),
        removeItem: (key: string) => sessionMemory.delete(key),
      }),
      localStorage: storageWith({
        getItem: (key: string) => localMemory.get(key) ?? null,
        setItem: (key: string, value: string) => localMemory.set(key, value),
        removeItem: (key: string) => localMemory.delete(key),
      }),
    });

    expect(patchThreeCoinQuestionSession({
      started: true,
      question: "Should I continue?",
      coreQuestionAtCast: "Should I continue?",
      coreQuestionFrozenAtCast: true,
    })).toBe(true);
    const written = writeThreeCoinSteps(validSteps(6));
    expect(localMemory.size).toBe(0);

    // A completed cast is not revived from a localStorage backup in a new tab.
    sessionMemory.clear();
    expect(readThreeCoinSession()).toBeNull();
    expect(written.data?.steps).toHaveLength(6);
  });

  it("restores a five-line current session with the same identity and leaves it incomplete", () => {
    const values = new Map<string, string>();
    const sessionStorage = storageWith({
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    vi.stubGlobal("window", { sessionStorage, localStorage: storageWith({}) });

    expect(patchThreeCoinQuestionSession({
      started: true,
      question: "What should I understand?",
      coreQuestionAtCast: "What should I understand?",
      coreQuestionFrozenAtCast: true,
    })).toBe(true);
    const written = writeThreeCoinSteps(validSteps(5));
    const restored = readThreeCoinSession();

    expect(restored?.id).toBe(written.id);
    expect(restored?.data?.steps).toHaveLength(5);
    expect(completedThreeCoinSteps(restored?.data?.steps ?? [])).toBeNull();
  });

  it("New Reading clears only the active method session", () => {
    const sessionMemory = new Map<string, string>();
    const localMemory = new Map<string, string>([["unrelated-pending", "keep"]]);
    vi.stubGlobal("window", {
      sessionStorage: storageWith({
        getItem: (key: string) => sessionMemory.get(key) ?? null,
        setItem: (key: string, value: string) => sessionMemory.set(key, value),
        removeItem: (key: string) => sessionMemory.delete(key),
      }),
      localStorage: storageWith({
        getItem: (key: string) => localMemory.get(key) ?? null,
        setItem: (key: string, value: string) => localMemory.set(key, value),
        removeItem: (key: string) => localMemory.delete(key),
      }),
    });

    expect(patchThreeCoinQuestionSession({
      started: true,
      question: "Start over?",
      coreQuestionAtCast: "Start over?",
      coreQuestionFrozenAtCast: true,
    })).toBe(true);
    writeThreeCoinSteps(validSteps(6));

    clearThreeCoinReading();
    expect(sessionMemory.has(THREE_COIN_SESSION_STORAGE_KEY)).toBe(false);
    expect(localMemory.get("unrelated-pending")).toBe("keep");
  });
});
