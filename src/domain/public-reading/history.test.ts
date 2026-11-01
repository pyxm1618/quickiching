import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPublicReading } from "./reading";
import {
  deleteHistoryRecord,
  HISTORY_STORAGE_KEY,
  readHistoryRecords,
  renameHistoryRecord,
  saveHistoryRecord,
  publicReadingFromHistory,
} from "./history";

function installStorage() {
  const values = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  } as Storage;
  vi.stubGlobal("window", { localStorage });
  return localStorage;
}

function reading(id: string, question: string, createdAt: string) {
  return buildPublicReading({
    id,
    createdAt,
    method: "manual",
    question,
    lineValuesBottomUp: [7, 8, 7, 8, 7, 8],
    evidence: { kind: "manual", mode: "line-values" },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("local Public Reading History", () => {
  it("keeps legacy current-time Mei Hua records readable without treating them as an active method", () => {
    const storage = installStorage();
    storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify([{
      schemaVersion: 1,
      id: "legacy-mei-hua",
      title: "Legacy Mei Hua",
      question: "What should I notice?",
      createdAt: "2026-08-19T10:00:00.000Z",
      updatedAt: "2026-08-19T10:00:00.000Z",
      method: "mei-hua-yi-shu",
      methodVersion: "mei-hua-gregorian-current-time-v2",
      lineValuesBottomUp: [7, 8, 7, 9, 7, 7],
      primaryHexagram: 13,
      changingLines: [4],
      relatingHexagram: 37,
    }]));
    const records = readHistoryRecords();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ id: "legacy-mei-hua", methodVersion: "mei-hua-gregorian-current-time-v2" });
    expect(publicReadingFromHistory(records[0]!)).toMatchObject({
      id: "legacy-mei-hua",
      method: "mei-hua-yi-shu",
      methodVersion: "mei-hua-gregorian-current-time-v2",
      primaryHexagram: 13,
      changingLines: [4],
      relatingHexagram: 37,
    });
  });

  it("keeps same facts with different questions as distinct UUID-backed records", () => {
    const storage = installStorage();
    const createdAt = "2026-08-19T10:00:00.000Z";
    const first = reading("reading-one", "What should I notice?", createdAt);
    const second = reading("reading-two", "What should I release?", createdAt);

    saveHistoryRecord(first);
    saveHistoryRecord(second);

    expect(readHistoryRecords().map((record) => record.id)).toEqual(["reading-two", "reading-one"]);
    expect(readHistoryRecords().map((record) => record.question)).toEqual(["What should I release?", "What should I notice?"]);
    expect(JSON.parse(storage.getItem(HISTORY_STORAGE_KEY) ?? "[]")).toHaveLength(2);
    expect(publicReadingFromHistory(readHistoryRecords()[1]!)).toMatchObject({ id: "reading-one", createdAt });
  });

  it("deduplicates only by the persistent reading id and supports rename/delete", () => {
    installStorage();
    const first = reading("reading-one", "First question", "2026-08-19T10:00:00.000Z");
    const replacement = reading("reading-one", "Edited question", "2026-08-19T10:00:00.000Z");
    saveHistoryRecord(first);
    saveHistoryRecord(replacement);

    expect(readHistoryRecords()).toHaveLength(1);
    expect(readHistoryRecords()[0]?.question).toBe("Edited question");
    expect(renameHistoryRecord("reading-one", "A better title")[0]?.title).toBe("A better title");
    expect(deleteHistoryRecord("reading-one")).toEqual([]);
  });

  it("preserves a custom title when the same reading is saved again", () => {
    installStorage();
    const first = reading("reading-one", "First question", "2026-08-19T10:00:00.000Z");
    const edited = reading("reading-one", "Edited question", "2026-08-19T10:00:00.000Z");

    saveHistoryRecord(first);
    renameHistoryRecord("reading-one", "Transition notes");
    const savedAgain = saveHistoryRecord(edited);

    expect(savedAgain.title).toBe("Transition notes");
    expect(readHistoryRecords()[0]).toMatchObject({
      id: "reading-one",
      title: "Transition notes",
      question: "Edited question",
    });
  });
});
