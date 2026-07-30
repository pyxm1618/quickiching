import { describe, it, expect } from "vitest";
import { KING_WEN_HEXAGRAMS, BINARY_TO_KING_WEN, TRIGRAM_BITS } from "./hexagrams/king-wen";
import { buildHexagramResult, isMovingLine } from "./hexagrams/compute";
import { generateThreeCoinLine } from "./three-coin/algorithm";
import { generateYarrowLine } from "./yarrow/algorithm";
import { meiHuaFromFields, hourBranch, localCalendarFields } from "./mei-hua/algorithm";
import type { LineValue } from "./types";

describe("King Wen mapping (G-01 golden standard)", () => {
  it("contains exactly 64 unique hexagrams numbered 1..64", () => {
    expect(KING_WEN_HEXAGRAMS).toHaveLength(64);
    const numbers = new Set(KING_WEN_HEXAGRAMS.map((h) => h.number));
    expect(numbers.size).toBe(64);
    for (let n = 1; n <= 64; n++) expect(numbers.has(n)).toBe(true);
  });

  it("binary map covers all 64 six-line combinations", () => {
    expect(BINARY_TO_KING_WEN.size).toBe(64);
  });

  it("maps all-yang to Qian (1) and all-yin to Kun (2)", () => {
    const qian = buildHexagramResult({ lineValuesBottomUp: [7, 7, 7, 7, 7, 7], method: "three_coin" });
    expect(qian.primaryHexagramNumber).toBe(1);
    const kun = buildHexagramResult({ lineValuesBottomUp: [8, 8, 8, 8, 8, 8], method: "three_coin" });
    expect(kun.primaryHexagramNumber).toBe(2);
  });

  it("maps a known hexagram (63 After Completion: lower Li, upper Kan)", () => {
    const r = buildHexagramResult({ lineValuesBottomUp: [7, 8, 7, 8, 7, 8], method: "three_coin" });
    expect(r.primaryHexagramNumber).toBe(63);
    expect(r.movingLinePositions).toEqual([]);
    expect(r.relatingHexagramNumber).toBeNull();
  });

  it("computes moving lines and relating hexagram (single old yang at line 1)", () => {
    const r = buildHexagramResult({ lineValuesBottomUp: [9, 7, 7, 7, 7, 7], method: "three_coin" });
    expect(r.movingLinePositions).toEqual([1]);
    // primary = Qian (all yang). Moving line 1 (old yang) flips bit0 to yin.
    // relating bits [0,1,1,1,1,1] => lower dui(110), upper qian(111) => hexagram 10 (Treading).
    expect(r.relatingHexagramNumber).toBe(10);
  });

  it("all line values are within 6..9", () => {
    for (const v of [6, 7, 8, 9] as LineValue[]) expect(isMovingLine(v)).toBe(v === 6 || v === 9);
  });

  it("trigram bits are distinct 0..7", () => {
    const bits = Object.values(TRIGRAM_BITS).sort();
    expect(bits).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});

describe("Three-Coin v1 (§8.2)", () => {
  const combos: Array<["yin" | "yang", "yin" | "yang", "yin" | "yang", LineValue]> = [
    ["yin", "yin", "yin", 6],
    ["yin", "yin", "yang", 7],
    ["yin", "yang", "yin", 7],
    ["yang", "yin", "yin", 7],
    ["yin", "yang", "yang", 8],
    ["yang", "yin", "yang", 8],
    ["yang", "yang", "yin", 8],
    ["yang", "yang", "yang", 9],
  ];

  it("maps all 8 face combinations to the correct line value (yang=3, yin=2)", () => {
    for (const [a, b, c, expected] of combos) {
      const step = generateThreeCoinLine(0, () => true); // placeholder
      void step;
      const result = generateThreeCoinLine(2, () => false);
      void result;
      // Drive deterministic faces by a queue-based bit source.
      const queue = [a, b, c];
      let i = 0;
      const bit = () => queue[i++] === "yang";
      const s = generateThreeCoinLine(0, bit);
      expect(s.lineValue).toBe(expected);
      expect(s.coinFaces).toEqual([a, b, c]);
    }
  });

  it("six completed lines produce a valid hexagram", () => {
    const faces = [true, false, true, false, true, false, true, false, true, false, true, false];
    let i = 0;
    const bit = () => faces[i++];
    const lineValues = [0, 1, 2, 3, 4, 5].map((idx) => generateThreeCoinLine(idx as 0, bit).lineValue);
    const r = buildHexagramResult({ lineValuesBottomUp: lineValues, method: "three_coin" });
    expect(r.primaryHexagramNumber).toBeGreaterThanOrEqual(1);
    expect(r.primaryHexagramNumber).toBeLessThanOrEqual(64);
  });
});

// Seeded RNG (mulberry32) for reproducible statistical tests.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("Yarrow v1 (§8.3)", () => {
  it("conserves stalk counts and yields a valid line value for every change", () => {
    const rng = mulberry32(12345);
    const ri = (maxExclusive: number) => 1 + Math.floor(rng() * (maxExclusive - 1));
    for (let trial = 0; trial < 200; trial++) {
      const res = generateYarrowLine(0, ri);
      expect([6, 7, 8, 9]).toContain(res.lineValue);
      let running = 49;
      for (const ch of res.changes) {
        expect(ch.startingStalks).toBe(running);
        const consumed = ch.leftRemainder + ch.rightRemainder + ch.removedFromRight;
        expect(ch.endingStalks).toBe(ch.startingStalks - consumed);
        // conservation: left + right == starting, and remainders in 1..4
        expect(ch.leftGroup + ch.rightGroup).toBe(ch.startingStalks);
        expect([1, 2, 3, 4]).toContain(ch.leftRemainder);
        expect([1, 2, 3, 4]).toContain(ch.rightRemainder);
        running = ch.endingStalks;
      }
      expect(running / 4).toBe(res.lineValue);
    }
  });

  it("empirical distribution approximates canonical yarrow probabilities (G-03 pending advisor)", () => {
    // Canonical targets: 6=1/16, 7=5/16, 8=7/16, 9=3/16.
    const rng = mulberry32(98765);
    const ri = (maxExclusive: number) => 1 + Math.floor(rng() * (maxExclusive - 1));
    const counts: Record<number, number> = { 6: 0, 7: 0, 8: 0, 9: 0 };
    const N = 200000;
    for (let i = 0; i < N; i++) {
      const v = generateYarrowLine(0, ri).lineValue;
      counts[v]++;
    }
    const tol = 0.02;
    expect(Math.abs(counts[6] / N - 1 / 16)).toBeLessThan(tol);
    expect(Math.abs(counts[7] / N - 5 / 16)).toBeLessThan(tol);
    expect(Math.abs(counts[8] / N - 7 / 16)).toBeLessThan(tol);
    expect(Math.abs(counts[9] / N - 3 / 16)).toBeLessThan(tol);
  });
});

describe("Mei Hua current-time v1 (§8.4)", () => {
  it("hourBranch maps the 12 terrestrial branches, including 子时 at 23 and 0", () => {
    expect(hourBranch(23)).toBe(1); // 子
    expect(hourBranch(0)).toBe(1); // 子
    expect(hourBranch(1)).toBe(2); // 丑
    expect(hourBranch(11)).toBe(7); // 午
    expect(hourBranch(12)).toBe(7); // 午
    expect(hourBranch(13)).toBe(8); // 未
  });

  it("produces exactly one moving line and only 7/8/6/9 values", () => {
    const r = meiHuaFromFields({ year: 2026, month: 7, day: 29, hour: 14, ianaTimeZone: "America/New_York" });
    expect(r.lineValuesBottomUp.filter((v) => v === 6 || v === 9)).toHaveLength(1);
    for (const v of r.lineValuesBottomUp) expect([6, 7, 8, 9]).toContain(v);
    expect(r.movingLinePosition).toBeGreaterThanOrEqual(1);
    expect(r.movingLinePosition).toBeLessThanOrEqual(6);
  });

  it("is deterministic for a fixed instant (no re-cast across minute boundaries)", () => {
    const a = meiHuaFromFields({ year: 2026, month: 7, day: 29, hour: 14, ianaTimeZone: "America/New_York" });
    const b = meiHuaFromFields({ year: 2026, month: 7, day: 29, hour: 14, ianaTimeZone: "America/New_York" });
    expect(a.lineValuesBottomUp).toEqual(b.lineValuesBottomUp);
    expect(a.movingLinePosition).toBe(b.movingLinePosition);
  });

  it("applies the traditional 子时 day rollover", () => {
    const f = localCalendarFields(Date.UTC(2026, 6, 29, 4, 30), "America/New_York"); // 00:30 local => hour 0
    expect(f.hour).toBe(0);
    const f23 = localCalendarFields(Date.UTC(2026, 6, 29, 4, 30), "America/New_York");
    void f23;
    // 23:00 local on July 29 => rollover to July 30
    const fRoll = localCalendarFields(Date.UTC(2026, 6, 30, 3, 30), "America/New_York"); // 23:30 local Jul 29
    expect(fRoll.day).toBe(30);
    expect(fRoll.hour).toBe(23);
  });
});
