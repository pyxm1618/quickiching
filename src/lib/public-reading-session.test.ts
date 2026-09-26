import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearPublicReadingSession,
  patchPublicReadingSession,
  readPublicReadingSession,
  readPublicReadingSessionState,
  restartPublicReadingSession,
  writePublicReadingSession,
} from "./public-reading-session";

function installSessionStorage(initial?: string) {
  const values = new Map<string, string>(initial ? [["reading", initial]] : []);
  const sessionStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  } as Storage;
  vi.stubGlobal("window", { sessionStorage });
  return sessionStorage;
}

afterEach(() => vi.unstubAllGlobals());

describe("public reading session envelope", () => {
  it("freezes the question when casting data is written and keeps the reading identity", () => {
    installSessionStorage();
    patchPublicReadingSession("reading", { started: true, question: "What deserves attention?" });
    const first = writePublicReadingSession("reading", { lines: [7, 8, 9] });
    patchPublicReadingSession("reading", { started: true, question: "A different question" });
    const second = readPublicReadingSession("reading", (value) => value as { lines: number[] });

    expect(second).toMatchObject({
      id: first.id,
      createdAt: first.createdAt,
      question: "What deserves attention?",
      coreQuestionAtCast: "What deserves attention?",
      coreQuestionFrozenAtCast: true,
      data: { lines: [7, 8, 9] },
    });
  });

  it("migrates legacy casting data behind the question gate and gives it one persistent id", () => {
    const storage = installSessionStorage(JSON.stringify([7, 8, 9]));
    expect(readPublicReadingSessionState("reading")).toEqual({ started: false, coreQuestionFrozenAtCast: true });
    patchPublicReadingSession("reading", { started: true, question: "A question" });
    const migrated = readPublicReadingSession("reading", (value) => Array.isArray(value) ? value as number[] : null);
    const persisted = JSON.parse(storage.getItem("reading") ?? "null") as { id?: string; question?: string; coreQuestionFrozenAtCast?: boolean };

    expect(migrated?.data).toEqual([7, 8, 9]);
    expect(migrated?.question).toBeUndefined();
    expect(migrated?.coreQuestionFrozenAtCast).toBe(true);
    expect(persisted.coreQuestionFrozenAtCast).toBe(true);
    expect(persisted.id).toBe(migrated?.id);
    clearPublicReadingSession("reading");
    expect(storage.getItem("reading")).toBeNull();
  });

  it("restarts casting with a fresh identity while preserving the active question", () => {
    installSessionStorage();
    patchPublicReadingSession("reading", { started: true, question: "What deserves attention?" });
    const first = writePublicReadingSession("reading", { lines: [7, 8, 9] });

    const restarted = restartPublicReadingSession("reading");

    expect(restarted).toMatchObject({
      started: true,
      question: "What deserves attention?",
    });
    expect(restarted.id).not.toBe(first.id);
    expect(restarted.createdAt).not.toBe(first.createdAt);
    expect("data" in restarted).toBe(false);
    expect(readPublicReadingSessionState("reading")).toEqual({
      started: true,
      question: "What deserves attention?",
      coreQuestionFrozenAtCast: false,
    });
  });

  it("persists the core question freeze and ignores later question changes", () => {
    const storage = installSessionStorage();
    expect(patchPublicReadingSession("reading", {
      started: true,
      question: "What deserves attention?",
      coreQuestionAtCast: "What deserves attention?",
      coreQuestionFrozenAtCast: true,
    })).toBe(true);
    expect(patchPublicReadingSession("reading", { started: true, question: "A different question" })).toBe(true);

    expect(readPublicReadingSessionState("reading")).toEqual({
      started: true,
      question: "What deserves attention?",
      coreQuestionAtCast: "What deserves attention?",
      coreQuestionFrozenAtCast: true,
    });
    expect(JSON.parse(storage.getItem("reading") ?? "null")).toMatchObject({
      question: "What deserves attention?",
      coreQuestionAtCast: "What deserves attention?",
      coreQuestionFrozenAtCast: true,
    });
  });

  it("reports a failed write so casting can stop before its first irreversible outcome", () => {
    const storage = installSessionStorage();
    storage.setItem = () => { throw new Error("quota exceeded"); };

    expect(patchPublicReadingSession("reading", {
      started: true,
      question: "What deserves attention?",
      coreQuestionAtCast: "What deserves attention?",
      coreQuestionFrozenAtCast: true,
    })).toBe(false);
    expect(storage.getItem("reading")).toBeNull();
  });
});
