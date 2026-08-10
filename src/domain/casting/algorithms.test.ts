import { describe, expect, it } from "vitest";
import { BINARY_TO_KING_WEN, KING_WEN_HEXAGRAMS, TRIGRAM_BITS } from "./hexagrams/king-wen";
import { buildHexagramResult, isMovingLine } from "./hexagrams/compute";
import { generateThreeCoinLine } from "./three-coin/algorithm";
import { generateYarrowLine } from "./yarrow/algorithm";
import { gregorianYearBranchNumber, hourBranch, localCalendarFields, meiHuaFromFields } from "./mei-hua/algorithm";
import type { LineValue } from "./types";

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function queuedRandom(values: number[]) {
  let index = 0;
  return (maxExclusive: number) => {
    const value = values[index++] ?? 0;
    return ((value % maxExclusive) + maxExclusive) % maxExclusive;
  };
}

describe("King Wen mapping", () => {
  it("contains exactly 64 unique hexagrams and all 64 binary patterns", () => {
    expect(KING_WEN_HEXAGRAMS).toHaveLength(64);
    expect(new Set(KING_WEN_HEXAGRAMS.map((hexagram) => hexagram.number)).size).toBe(64);
    expect(BINARY_TO_KING_WEN.size).toBe(64);
    expect(Object.values(TRIGRAM_BITS).sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("maps all-yang to 1, all-yin to 2, and a known Li/Kan structure to 63", () => {
    expect(buildHexagramResult({ lineValuesBottomUp: [7, 7, 7, 7, 7, 7], method: "three_coin" }).primaryHexagramNumber).toBe(1);
    expect(buildHexagramResult({ lineValuesBottomUp: [8, 8, 8, 8, 8, 8], method: "three_coin" }).primaryHexagramNumber).toBe(2);
    expect(buildHexagramResult({ lineValuesBottomUp: [7, 8, 7, 8, 7, 8], method: "three_coin" }).primaryHexagramNumber).toBe(63);
  });

  it("flips only moving lines and derives the relating hexagram", () => {
    const result = buildHexagramResult({ lineValuesBottomUp: [9, 7, 7, 7, 7, 7], method: "three_coin" });
    expect(result.movingLinePositions).toEqual([1]);
    expect(result.relatingHexagramNumber).toBe(10);
  });

  it("treats only 6 and 9 as moving", () => {
    for (const value of [6, 7, 8, 9] as LineValue[]) expect(isMovingLine(value)).toBe(value === 6 || value === 9);
  });
});

describe("Three-Coin v1", () => {
  const combinations: Array<["yin" | "yang", "yin" | "yang", "yin" | "yang", LineValue]> = [
    ["yin", "yin", "yin", 6],
    ["yin", "yin", "yang", 7],
    ["yin", "yang", "yin", 7],
    ["yang", "yin", "yin", 7],
    ["yin", "yang", "yang", 8],
    ["yang", "yin", "yang", 8],
    ["yang", "yang", "yin", 8],
    ["yang", "yang", "yang", 9],
  ];

  it("maps all eight face combinations to 6/7/8/9 correctly", () => {
    for (const [a, b, c, expected] of combinations) {
      const queue = [a, b, c];
      let index = 0;
      const step = generateThreeCoinLine(0, () => queue[index++] === "yang");
      expect(step.lineValue).toBe(expected);
      expect(step.coinFaces).toEqual([a, b, c]);
    }
  });

  it("builds a six-line bottom-up reading through the shared result engine", () => {
    const faces = [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false];
    let index = 0;
    const lines = [0, 1, 2, 3, 4, 5].map((lineIndex) => generateThreeCoinLine(lineIndex as 0 | 1 | 2 | 3 | 4 | 5, () => faces[index++]).lineValue);
    const result = buildHexagramResult({ lineValuesBottomUp: lines, method: "three_coin" });
    expect(result.lineValuesBottomUp).toHaveLength(6);
    expect(result.primaryHexagramNumber).toBeGreaterThanOrEqual(1);
    expect(result.primaryHexagramNumber).toBeLessThanOrEqual(64);
  });
});

describe("Yarrow Zhu Xi digital v2", () => {
  it("has golden paths for old yin 6 and old yang 9", () => {
    const oldYin = generateYarrowLine(0, queuedRandom([0, 0, 0]));
    expect(oldYin.changes.map((change) => change.startingStalks - change.endingStalks)).toEqual([9, 8, 8]);
    expect(oldYin.lineValue).toBe(6);

    const oldYang = generateYarrowLine(0, queuedRandom([1, 1, 1]));
    expect(oldYang.changes.map((change) => change.startingStalks - change.endingStalks)).toEqual([5, 4, 4]);
    expect(oldYang.lineValue).toBe(9);
  });

  it("conserves stalks and records only allowed first/later removal totals", () => {
    const rng = mulberry32(12345);
    const randomInt = (maxExclusive: number) => Math.floor(rng() * maxExclusive);
    for (let trial = 0; trial < 1000; trial += 1) {
      const line = generateYarrowLine((trial % 6) as 0 | 1 | 2 | 3 | 4 | 5, randomInt);
      expect([6, 7, 8, 9]).toContain(line.lineValue);
      let running = 49;
      line.changes.forEach((change, changeIndex) => {
        expect(change.startingStalks).toBe(running);
        expect(change.leftGroup + change.rightGroup).toBe(change.startingStalks);
        expect(change.endingStalks).toBe(change.startingStalks - change.removedFromRight - change.leftRemainder - change.rightRemainder);
        const removed = change.startingStalks - change.endingStalks;
        expect(changeIndex === 0 ? [5, 9] : [4, 8]).toContain(removed);
        running = change.endingStalks;
      });
      expect(running / 4).toBe(line.lineValue);
    }
  });

  it("empirically matches the explicit 1/16, 5/16, 7/16, 3/16 line distribution", () => {
    const rng = mulberry32(98765);
    const randomInt = (maxExclusive: number) => Math.floor(rng() * maxExclusive);
    const counts: Record<number, number> = { 6: 0, 7: 0, 8: 0, 9: 0 };
    const sampleSize = 100000;
    for (let index = 0; index < sampleSize; index += 1) counts[generateYarrowLine(0, randomInt).lineValue] += 1;
    const tolerance = 0.006;
    expect(Math.abs(counts[6] / sampleSize - 1 / 16)).toBeLessThan(tolerance);
    expect(Math.abs(counts[7] / sampleSize - 5 / 16)).toBeLessThan(tolerance);
    expect(Math.abs(counts[8] / sampleSize - 7 / 16)).toBeLessThan(tolerance);
    expect(Math.abs(counts[9] / sampleSize - 3 / 16)).toBeLessThan(tolerance);
  });
});

describe("Mei Hua Gregorian current-time v2", () => {
  it("maps terrestrial-branch years and hour branches deterministically", () => {
    expect(gregorianYearBranchNumber(2020)).toBe(1);
    expect(gregorianYearBranchNumber(2031)).toBe(12);
    expect(gregorianYearBranchNumber(2032)).toBe(1);
    expect(hourBranch(23)).toBe(1);
    expect(hourBranch(0)).toBe(1);
    expect(hourBranch(1)).toBe(2);
    expect(hourBranch(12)).toBe(7);
    expect(hourBranch(13)).toBe(8);
  });

  it("has a fixed golden fixture: 2026-08-10 14:xx -> Qian/Qian with line 3 moving", () => {
    const meiHua = meiHuaFromFields({ year: 2026, month: 8, day: 10, hour: 14, ianaTimeZone: "Asia/Singapore" });
    expect(meiHua.upperTrigram).toBe("qian");
    expect(meiHua.lowerTrigram).toBe("qian");
    expect(meiHua.movingLinePosition).toBe(3);
    expect(meiHua.lineValuesBottomUp).toEqual([7, 7, 9, 7, 7, 7]);
    const result = buildHexagramResult({ lineValuesBottomUp: meiHua.lineValuesBottomUp, method: "mei_hua_current_time", algorithmVersion: meiHua.algorithmVersion });
    expect(result.primaryHexagramNumber).toBe(1);
    expect(result.relatingHexagramNumber).toBe(44);
  });

  it("rolls 23:xx into the next Gregorian formula date but leaves 00:xx on its civil date", () => {
    const at0030 = localCalendarFields(Date.UTC(2026, 6, 29, 4, 30), "America/New_York");
    expect(at0030).toMatchObject({ year: 2026, month: 7, day: 29, hour: 0 });
    const at2330 = localCalendarFields(Date.UTC(2026, 6, 30, 3, 30), "America/New_York");
    expect(at2330).toMatchObject({ year: 2026, month: 7, day: 30, hour: 23 });
  });

  it("handles Gregorian year rollover at Zi hour", () => {
    const fields = localCalendarFields(Date.UTC(2027, 0, 1, 4, 30), "America/New_York");
    expect(fields).toMatchObject({ year: 2027, month: 1, day: 1, hour: 23 });
  });

  it("uses IANA DST transitions rather than a fixed UTC offset", () => {
    const before = localCalendarFields(Date.UTC(2026, 2, 8, 6, 30), "America/New_York");
    const after = localCalendarFields(Date.UTC(2026, 2, 8, 7, 30), "America/New_York");
    expect(before).toMatchObject({ month: 3, day: 8, hour: 1 });
    expect(after).toMatchObject({ month: 3, day: 8, hour: 3 });
  });
});
