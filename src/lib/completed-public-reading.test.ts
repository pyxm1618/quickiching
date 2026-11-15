import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPublicReading } from "@/domain/public-reading/reading";
import { generateYarrowLine } from "@/domain/casting/yarrow/algorithm";
import { generateThreeCoinLine } from "@/domain/casting/three-coin/algorithm";
import { meiHuaFromNumberAndTime } from "@/domain/casting/mei-hua/number-time";
import { completedPublicReadingPath, publicReadingSaveInput, clearCompletedReadingForRestart } from "./completed-public-reading";
import { pendingCompletedReadingStorageKey } from "./pending-completed-reading";
import { MANUAL_SESSION_STORAGE_KEY, MEI_HUA_SESSION_STORAGE_KEY, YARROW_SESSION_STORAGE_KEY } from "./method-session-retirement";
import { THREE_COIN_SESSION_STORAGE_KEY } from "./three-coin-session";
import { MANUAL_CAST_DRAFT_STORAGE_KEY } from "./manual-cast-draft";

const calculation = meiHuaFromNumberAndTime({
  number: 17,
  utcMillis: Date.UTC(2026, 9, 31, 12),
  ianaTimeZone: "UTC",
});
const reading = buildPublicReading({
  id: "2d0a4f0d-37e8-42bf-9232-9d40518f1e4f",
  method: "mei-hua-yi-shu",
  methodVersion: calculation.algorithmVersion,
  lineValuesBottomUp: calculation.lineValuesBottomUp,
  evidence: { kind: "mei-hua-yi-shu", calculation },
});

afterEach(() => vi.unstubAllGlobals());

function stubBrowserStorage() {
  const sessionMemory = new Map<string, string>();
  const localMemory = new Map<string, string>();
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
      getItem: (key: string) => localMemory.get(key) ?? null,
      setItem: (key: string, value: string) => localMemory.set(key, value),
      removeItem: (key: string) => localMemory.delete(key),
      clear: () => localMemory.clear(),
      key: (index: number) => [...localMemory.keys()][index] ?? null,
      get length() { return localMemory.size; },
    },
  });
  return { sessionMemory, localMemory };
}

describe("shared completed reading helpers", () => {
  it("builds the canonical Choice path for the exact reading id", () => {
    expect(completedPublicReadingPath(reading.id)).toBe(`/readings/choice?session=${reading.id}`);
    expect(completedPublicReadingPath(reading.id, true)).toBe(`/zh/readings/choice?session=${reading.id}`);
  });

  it("saves active Mei Hua as number + moment with only bounded raw source inputs", () => {
    expect(publicReadingSaveInput(reading)).toMatchObject({
      method: "mei_hua_number_time",
      clientCastingId: reading.id,
      methodCalculation: {
        number: 17,
        utcMillis: calculation.methodCalculation.utcMillis,
        ianaTimeZone: "UTC",
      },
    });
    expect(publicReadingSaveInput(reading).methodCalculation).not.toHaveProperty("movingLinePosition");
  });

  it("hands all four active methods to the same canonical route with unchanged source evidence", () => {
    const yarrow = Array.from({ length: 6 }, (_, index) => generateYarrowLine(index as 0, () => 1));
    const coins = Array.from({ length: 6 }, (_, index) => generateThreeCoinLine(index as 0, () => true));
    for (const completed of [
      reading,
      buildPublicReading({ id: reading.id, method: "three-coin", lineValuesBottomUp: coins.map(line => line.lineValue), evidence: { kind: "three-coin", steps: coins } }),
      buildPublicReading({ id: reading.id, method: "yarrow-stalks", lineValuesBottomUp: yarrow.map(line => line.lineValue), evidence: { kind: "yarrow-stalks", lines: yarrow } }),
      buildPublicReading({ id: reading.id, method: "manual", lineValuesBottomUp: [7, 8, 9, 6, 7, 8], evidence: { kind: "manual", mode: "line-values" } }),
    ]) {
      expect(completedPublicReadingPath(completed.id)).toBe(`/readings/choice?session=${completed.id}`);
      expect(publicReadingSaveInput(completed).algorithmVersion).toBe(completed.methodVersion);
    }
  });

  it("serializes Manual line-values through the shared save contract", () => {
    const manual = buildPublicReading({
      id: "3d0a4f0d-37e8-42bf-9232-9d40518f1e4f",
      method: "manual",
      lineValuesBottomUp: [7, 8, 9, 6, 7, 8],
      evidence: { kind: "manual", mode: "line-values" },
    });
    expect(publicReadingSaveInput(manual)).toMatchObject({
      clientCastingId: manual.id,
      method: "manual",
      algorithmVersion: "manual-cast-v1",
      lineValuesBottomUp: [7, 8, 9, 6, 7, 8],
      methodCalculation: { mode: "line-values" },
    });
  });

  it("serializes Manual primary-changing through the shared save contract", () => {
    const manual = buildPublicReading({
      id: "4d0a4f0d-37e8-42bf-9232-9d40518f1e4f",
      method: "manual",
      lineValuesBottomUp: [7, 7, 7, 7, 7, 7],
      evidence: { kind: "manual", mode: "primary-changing", primaryHexagramNumber: 1, changingLines: [] },
    });
    expect(publicReadingSaveInput(manual)).toMatchObject({
      clientCastingId: manual.id,
      method: "manual",
      algorithmVersion: "manual-cast-v1",
      lineValuesBottomUp: [7, 7, 7, 7, 7, 7],
      methodCalculation: { mode: "primary-changing", primaryHexagramNumber: 1, changingLines: [] },
    });
  });
});

describe("restart preserves other casting methods", () => {
  it.each([
    ["yarrow-stalks", YARROW_SESSION_STORAGE_KEY, "/methods/yarrow-stalks"],
    ["mei-hua-yi-shu", MEI_HUA_SESSION_STORAGE_KEY, "/methods/mei-hua-yi-shu"],
    ["three-coin", THREE_COIN_SESSION_STORAGE_KEY, "/"],
    ["manual", MANUAL_SESSION_STORAGE_KEY, "/methods/manual-cast"],
  ] as const)("clears only %s and its exact pending record", (method, key, href) => {
    const { sessionMemory, localMemory } = stubBrowserStorage();
    sessionMemory.set(key, "cast");
    sessionMemory.set("unrelated", "preserve");
    if (method === "manual") sessionMemory.set(MANUAL_CAST_DRAFT_STORAGE_KEY, "draft");
    localMemory.set(pendingCompletedReadingStorageKey(reading.id), "pending");
    localMemory.set("unrelated-pending", "keep");

    expect(clearCompletedReadingForRestart(method, false, reading.id)).toBe(href);
    expect(sessionMemory.has(key)).toBe(false);
    expect(sessionMemory.get("unrelated")).toBe("preserve");
    expect(localMemory.has(pendingCompletedReadingStorageKey(reading.id))).toBe(false);
    expect(localMemory.get("unrelated-pending")).toBe("keep");
  });

  it("returns the canonical Root entry for Three Coin in both locales", () => {
    stubBrowserStorage();
    expect(clearCompletedReadingForRestart("three-coin", false)).toBe("/");
    expect(clearCompletedReadingForRestart("three-coin", true)).toBe("/zh");
  });

  it("does not retire any method session when only a pending record is removed", () => {
    const { sessionMemory, localMemory } = stubBrowserStorage();
    sessionMemory.set(YARROW_SESSION_STORAGE_KEY, "cast");
    localMemory.set(pendingCompletedReadingStorageKey(reading.id), "pending");
    clearCompletedReadingForRestart("mei-hua-yi-shu", false, reading.id);
    expect(sessionMemory.get(YARROW_SESSION_STORAGE_KEY)).toBe("cast");
  });
});
