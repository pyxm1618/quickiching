import { describe, expect, it } from "vitest";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import { KING_WEN_HEXAGRAMS, TRIGRAM_BITS } from "@/domain/casting/hexagrams/king-wen";
import type { LineValue } from "@/domain/casting/types";
import { buildPublicReading, readingFingerprint } from "./reading";
import { manualFromLineValues, manualFromPrimaryAndChangingLines } from "./manual";
import { normalizePublicQuestion } from "./question";
import { buildStaticReading } from "./static-reading";

function baseLineValues(number: number): LineValue[] {
  const hexagram = KING_WEN_HEXAGRAMS[number - 1];
  if (!hexagram) throw new Error(`HEXAGRAM_MISSING: ${number}`);
  const bits = (TRIGRAM_BITS[hexagram.upper] << 3) | TRIGRAM_BITS[hexagram.lower];
  return Array.from({ length: 6 }, (_, index) => (bits & (1 << index) ? 7 : 8));
}

function kingWenForBinary(binary: number): number {
  const match = KING_WEN_HEXAGRAMS.find((hexagram) => {
    const hexagramBinary = (TRIGRAM_BITS[hexagram.upper] << 3) | TRIGRAM_BITS[hexagram.lower];
    return hexagramBinary === binary;
  });
  if (!match) throw new Error(`HEXAGRAM_BINARY_MISSING: ${binary}`);
  return match.number;
}

describe("PublicReading domain contract", () => {
  it("normalizes an optional question without imposing the commercial minimum", () => {
    expect(normalizePublicQuestion("   ")).toBeUndefined();
    expect(normalizePublicQuestion("  Will this settle?  ")).toBe("Will this settle?");
    expect(normalizePublicQuestion("字".repeat(500))).toHaveLength(500);
    expect(() => normalizePublicQuestion("字".repeat(501))).toThrow("PUBLIC_QUESTION_TOO_LONG");
  });

  it("builds a versioned manual PublicReading and keeps its question out of its fingerprint", () => {
    const reading = buildPublicReading({
      id: "reading-manual-test",
      createdAt: "2026-08-19T00:00:00.000Z",
      method: "manual",
      lineValuesBottomUp: [6, 7, 8, 9, 7, 8],
      question: "  What should I notice? ",
      evidence: { kind: "manual", mode: "line-values" },
    });

    expect(reading).toMatchObject({
      schemaVersion: 1,
      id: "reading-manual-test",
      method: "manual",
      methodVersion: "manual-cast-v1",
      question: "What should I notice?",
      primaryHexagram: 47,
      changingLines: [1, 4],
      relatingHexagram: 60,
    });
    expect(reading.lineValuesBottomUp).toEqual([6, 7, 8, 9, 7, 8]);

    const sameFacts = buildPublicReading({
      id: "different-id",
      createdAt: "2027-01-01T00:00:00.000Z",
      method: "manual",
      lineValuesBottomUp: reading.lineValuesBottomUp,
      question: "A different question",
      evidence: { kind: "manual", mode: "line-values" },
    });
    expect(readingFingerprint(reading)).toBe(readingFingerprint(sameFacts));
  });

  it("maps primary-plus-changing-lines to the same six values as Manual mode A", () => {
    for (let number = 1; number <= 64; number += 1) {
      const base = baseLineValues(number);
      for (let mask = 0; mask < 64; mask += 1) {
        const changingLines = Array.from({ length: 6 }, (_, index) => index + 1).filter(
          (position) => (mask & (1 << (position - 1))) !== 0,
        );
        const modeA = manualFromLineValues(
          base.map((value, index) => {
            const changing = changingLines.includes(index + 1);
            if (!changing) return value;
            return value === 7 ? 9 : 6;
          }),
        );
        const modeB = manualFromPrimaryAndChangingLines(number, changingLines);
        expect(modeB).toEqual(modeA);

        const result = buildHexagramResult({ lineValuesBottomUp: modeB, method: "three_coin" });
        expect(result.primaryHexagramNumber).toBe(number);
        expect(result.movingLinePositions).toEqual(changingLines);
        const primaryBinary = (TRIGRAM_BITS[KING_WEN_HEXAGRAMS[number - 1]!.upper] << 3)
          | TRIGRAM_BITS[KING_WEN_HEXAGRAMS[number - 1]!.lower];
        const expectedRelating = mask === 0 ? null : kingWenForBinary(primaryBinary ^ mask);
        expect(result.relatingHexagramNumber).toBe(expectedRelating);
      }
    }
  });

  it("does not create a relating hexagram when no lines move", () => {
    const reading = buildPublicReading({
      method: "manual",
      lineValuesBottomUp: manualFromPrimaryAndChangingLines(24, []),
      evidence: { kind: "manual", mode: "primary-changing", primaryHexagramNumber: 24, changingLines: [] },
    });

    expect(reading.primaryHexagram).toBe(24);
    expect(reading.changingLines).toEqual([]);
    expect(reading.relatingHexagram).toBeNull();
  });

  it("links readings directly to canonical hexagram URLs and stable line anchors", () => {
    const reading = buildPublicReading({
      method: "manual",
      lineValuesBottomUp: [9, 7, 7, 7, 7, 7],
      evidence: { kind: "manual", mode: "line-values" },
    });
    const result = buildStaticReading(reading);
    expect(result.primary.href).toMatch(/^\/hexagrams\/[^/]+$/);
    expect(result.relating?.href).toMatch(/^\/hexagrams\/[^/]+$/);
    expect(result.activeLines[0]?.href).toBe(`${result.primary.href}#line-1`);
  });
});
