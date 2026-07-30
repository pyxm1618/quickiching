import { describe, expect, it } from "vitest";
import type { HexagramResult } from "./types";
import {
  assertMethodEvidenceMatchesResult,
  type CastingMethodEvidence,
} from "./method-evidence";

const coinResult: HexagramResult = {
  lineValuesBottomUp: [9, 8, 7, 6, 7, 8],
  primaryHexagramNumber: 63,
  movingLinePositions: [1, 4],
  relatingHexagramNumber: 49,
  method: "three_coin",
  algorithmVersion: "three-coin-v1",
  classicMappingVersion: "king-wen-v1",
};

const coinEvidence: CastingMethodEvidence = {
  method: "three_coin",
  rounds: [
    { linePosition: 1, coinValues: [3, 3, 3], lineValue: 9 },
    { linePosition: 2, coinValues: [3, 3, 2], lineValue: 8 },
    { linePosition: 3, coinValues: [3, 2, 2], lineValue: 7 },
    { linePosition: 4, coinValues: [2, 2, 2], lineValue: 6 },
    { linePosition: 5, coinValues: [3, 2, 2], lineValue: 7 },
    { linePosition: 6, coinValues: [3, 3, 2], lineValue: 8 },
  ],
};

describe("casting method evidence", () => {
  it("accepts six server-recorded three-coin rounds that reproduce the result", () => {
    expect(() => assertMethodEvidenceMatchesResult(coinEvidence, coinResult)).not.toThrow();
  });

  it.each([
    ["wrong method", { ...coinEvidence, method: "yarrow_stalk" }],
    ["missing round", { ...coinEvidence, rounds: coinEvidence.rounds.slice(0, 5) }],
    ["duplicate position", {
      ...coinEvidence,
      rounds: coinEvidence.rounds.map((round, index) => index === 5 ? { ...round, linePosition: 5 } : round),
    }],
    ["coin sum mismatch", {
      ...coinEvidence,
      rounds: coinEvidence.rounds.map((round, index) => index === 0 ? { ...round, coinValues: [2, 2, 2] as const } : round),
    }],
    ["result mismatch", {
      ...coinEvidence,
      rounds: coinEvidence.rounds.map((round, index) => index === 1 ? { ...round, lineValue: 7 as const } : round),
    }],
  ])("rejects %s", (_label, evidence) => {
    expect(() => assertMethodEvidenceMatchesResult(evidence as CastingMethodEvidence, coinResult))
      .toThrow("CASTING_METHOD_EVIDENCE_INVALID");
  });

  it("accepts exactly eighteen ordered yarrow changes and their six derived line values", () => {
    const lineValues = [6, 7, 8, 9, 8, 7] as const;
    const result: HexagramResult = {
      ...coinResult,
      method: "yarrow_stalk",
      algorithmVersion: "yarrow-v1",
      lineValuesBottomUp: lineValues,
      movingLinePositions: [1, 4],
    };
    const evidence: CastingMethodEvidence = {
      method: "yarrow_stalk",
      changes: Array.from({ length: 18 }, (_, index) => ({
        linePosition: Math.floor(index / 3) + 1,
        changeIndex: (index % 3) + 1 as 1 | 2 | 3,
        stalksBefore: index % 3 === 0 ? 49 : 44,
        leftPile: 23,
        rightPile: 21,
        removedRemainders: 5,
        stalksAfter: index % 3 === 2 ? lineValues[Math.floor(index / 3)] * 4 : 44,
      })),
      lineValues: [...lineValues],
    };

    expect(() => assertMethodEvidenceMatchesResult(evidence, result)).not.toThrow();
    expect(() => assertMethodEvidenceMatchesResult({
      ...evidence,
      changes: evidence.changes.slice(0, 17),
    }, result)).toThrow("CASTING_METHOD_EVIDENCE_INVALID");
  });

  it("requires lunisolar, timezone, timestamp, trigram, moving-line, body and use evidence for Mei Hua", () => {
    const result: HexagramResult = {
      ...coinResult,
      method: "mei_hua_current_time",
      algorithmVersion: "mei-hua-lunisolar-v1",
      lineValuesBottomUp: [7, 8, 7, 8, 9, 8],
      movingLinePositions: [5],
    };
    const evidence: CastingMethodEvidence = {
      method: "mei_hua_current_time",
      inputTimestamp: "2026-07-30T15:30:00.000Z",
      ianaTimeZone: "Asia/Singapore",
      calendarSystem: "chinese_lunisolar",
      lunisolarDate: { cycleYear: 43, lunarMonth: 6, lunarDay: 17, doubleHourBranch: 10 },
      upperTrigramNumber: 1,
      lowerTrigramNumber: 2,
      movingLinePosition: 5,
      bodyTrigram: "upper",
      useTrigram: "lower",
      calculationVersion: "mei-hua-lunisolar-v1",
    };

    expect(() => assertMethodEvidenceMatchesResult(evidence, result)).not.toThrow();
    expect(() => assertMethodEvidenceMatchesResult({
      ...evidence,
      calendarSystem: "gregorian" as never,
    }, result)).toThrow("CASTING_METHOD_EVIDENCE_INVALID");
  });
});
