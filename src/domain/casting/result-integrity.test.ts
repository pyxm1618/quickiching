import { describe, expect, it } from "vitest";
import { serializeCastResultIntegrity } from "./result-integrity";

const base = {
  castingSessionId: "cas_0123456789abcdef01234567",
  method: "three_coin" as const,
  lineValues: [7, 8, 9, 6, 7, 8] as const,
  primaryHexagramNumber: 63,
  movingLinePositions: [3, 4],
  relatingHexagramNumber: 64,
  methodCalculation: {
    kind: "three-coin",
    rounds: [
      { line: 1, faces: ["heads", "tails", "heads"] },
      { line: 2, faces: ["tails", "tails", "heads"] },
    ],
    metadata: { source: "server", version: 1 },
  },
  algorithmVersion: "three-coin-v1",
  classicMappingVersion: "king-wen-v1",
};

describe("cast result canonical integrity serialization", () => {
  it("produces identical bytes for semantically identical object key order", () => {
    const reordered = {
      ...base,
      methodCalculation: {
        metadata: { version: 1, source: "server" },
        rounds: [
          { faces: ["heads", "tails", "heads"], line: 1 },
          { faces: ["tails", "tails", "heads"], line: 2 },
        ],
        kind: "three-coin",
      },
    };

    expect(serializeCastResultIntegrity(base)).toBe(serializeCastResultIntegrity(reordered));
  });

  it.each([
    ["casting id", { ...base, castingSessionId: "cas_other" }],
    ["method", { ...base, method: "yarrow_stalk" as const }],
    ["line value", { ...base, lineValues: [7, 8, 8, 6, 7, 8] }],
    ["primary hexagram", { ...base, primaryHexagramNumber: 62 }],
    ["moving lines", { ...base, movingLinePositions: [3] }],
    ["relating hexagram", { ...base, relatingHexagramNumber: null }],
    ["method evidence", { ...base, methodCalculation: { kind: "three-coin", rounds: [] } }],
    ["algorithm version", { ...base, algorithmVersion: "three-coin-v2" }],
    ["classic mapping", { ...base, classicMappingVersion: "king-wen-v2" }],
  ])("changes the signed bytes when %s changes", (_label, changed) => {
    expect(serializeCastResultIntegrity(changed)).not.toBe(serializeCastResultIntegrity(base));
  });

  it("rejects malformed result fields and non-JSON evidence", () => {
    expect(() => serializeCastResultIntegrity({
      ...base,
      lineValues: [7, 8, 9],
    })).toThrow("CAST_RESULT_CANONICALIZATION_INVALID");
    expect(() => serializeCastResultIntegrity({
      ...base,
      methodCalculation: { invalid: Number.NaN },
    })).toThrow("CAST_RESULT_CANONICALIZATION_INVALID");
    expect(() => serializeCastResultIntegrity({
      ...base,
      methodCalculation: { invalid: undefined },
    })).toThrow("CAST_RESULT_CANONICALIZATION_INVALID");
  });
});
