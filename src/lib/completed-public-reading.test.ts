import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPublicReading } from "@/domain/public-reading/reading";
import { generateYarrowLine } from "@/domain/casting/yarrow/algorithm";
import { generateThreeCoinLine } from "@/domain/casting/three-coin/algorithm";
import { meiHuaFromNumberAndTime } from "@/domain/casting/mei-hua/number-time";
import { completedPublicReadingPath, readCompletedPublicReading, publicReadingSaveInput, writeCompletedPublicReading } from "./completed-public-reading";

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

describe("common completed reading handoff", () => {
  it("preserves method evidence and scopes recovery to the requested session", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", { sessionStorage: { setItem: (key: string, value: string) => values.set(key, value), getItem: (key: string) => values.get(key) ?? null } });
    writeCompletedPublicReading(reading);
    expect(readCompletedPublicReading(reading.id)).toEqual(reading);
    expect(readCompletedPublicReading("another-session")).toBeNull();
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
    const values = new Map<string, string>();
    vi.stubGlobal("window", { sessionStorage: { setItem: (key: string, value: string) => values.set(key, value), getItem: (key: string) => values.get(key) ?? null } });
    const yarrow = Array.from({ length: 6 }, (_, index) => generateYarrowLine(index as 0, () => 1));
    const coins = Array.from({ length: 6 }, (_, index) => generateThreeCoinLine(index as 0, () => true));
    for (const completed of [
      reading,
      buildPublicReading({ id: reading.id, method: "three-coin", lineValuesBottomUp: coins.map(line => line.lineValue), evidence: { kind: "three-coin", steps: coins } }),
      buildPublicReading({ id: reading.id, method: "yarrow-stalks", lineValuesBottomUp: yarrow.map(line => line.lineValue), evidence: { kind: "yarrow-stalks", lines: yarrow } }),
      buildPublicReading({ id: reading.id, method: "manual", lineValuesBottomUp: [7, 8, 9, 6, 7, 8], evidence: { kind: "manual", mode: "line-values" } }),
    ]) {
      writeCompletedPublicReading(completed);
      expect(readCompletedPublicReading(completed.id)).toEqual(completed);
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

  it("fails closed on corrupt storage and propagates blocked writes", () => {
    vi.stubGlobal("window", { sessionStorage: { getItem: () => "{broken", setItem: () => { throw new Error("blocked"); } } });
    expect(readCompletedPublicReading()).toBeNull();
    expect(() => writeCompletedPublicReading(reading)).toThrow("blocked");
  });
});

import { clearCompletedReadingForRestart } from "./completed-public-reading";
describe("restart preserves other casting methods", () => {
  it.each([
    ["yarrow-stalks", "quickiching:public-v1:yarrow-v2", "/methods/yarrow-stalks", "/zh/methods/yarrow-stalks"],
    ["mei-hua-yi-shu", "quickiching:public-v1:mei-hua-number-time-v1", "/methods/mei-hua-yi-shu", "/zh/methods/mei-hua-yi-shu"],
    // V13: Three Coin's New Reading target is the canonical localized root.
    ["three-coin", "quickiching:public-v1:three-coin", "/", "/zh"],
    ["manual", "quickiching:public-v1:manual-cast", "/methods/manual-cast", "/zh/methods/manual-cast"],
  ] as const)("clears only %s and the common handoff", (method, key, href, zhHref) => {
    const values = new Map([[key,"cast"],["unrelated","preserve"],["quickiching:public-v1:completed-reading","handoff"]]);
    vi.stubGlobal("window", {sessionStorage: {removeItem:(item:string)=>values.delete(item)}, localStorage:{removeItem:vi.fn()}});
    expect(clearCompletedReadingForRestart(method, false)).toBe(href);
    expect(clearCompletedReadingForRestart(method, true)).toBe(zhHref);
    expect(values.has(key)).toBe(false);
    expect(values.has("quickiching:public-v1:completed-reading")).toBe(false);
    expect(values.get("unrelated")).toBe("preserve");
  });
});
