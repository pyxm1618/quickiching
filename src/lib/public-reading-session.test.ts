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
  it("updates question without changing the reading identity or casting data", () => {
    installSessionStorage();
    const first = writePublicReadingSession("reading", { lines: [7, 8, 9] });
    patchPublicReadingSession("reading", { started: true, question: "What deserves attention?" });
    const second = readPublicReadingSession("reading", (value) => value as { lines: number[] });

    expect(second).toMatchObject({
      id: first.id,
      createdAt: first.createdAt,
      question: "What deserves attention?",
      data: { lines: [7, 8, 9] },
    });
  });

  it("migrates legacy casting data behind the question gate and gives it one persistent id", () => {
    const storage = installSessionStorage(JSON.stringify([7, 8, 9]));
    expect(readPublicReadingSessionState("reading")).toEqual({ started: false });
    patchPublicReadingSession("reading", { started: true, question: "A question" });
    const migrated = readPublicReadingSession("reading", (value) => Array.isArray(value) ? value as number[] : null);
    const persisted = JSON.parse(storage.getItem("reading") ?? "null") as { id?: string; question?: string };

    expect(migrated?.data).toEqual([7, 8, 9]);
    expect(migrated?.question).toBe("A question");
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
    });
  });
});
