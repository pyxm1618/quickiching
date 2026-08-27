import { describe, expect, it } from "vitest";
import type { DeterministicFacts } from "@/domain/generation/schemas";
import {
  calculateDeepReadingInputSnapshotHash,
  calculateDeepReadingResultIntegrity,
} from "./integrity";

const facts: DeterministicFacts = {
  method: "three_coin",
  algorithmVersion: "coin-v1",
  classicMappingVersion: "king-wen-v1",
  lineValuesBottomUp: [7, 8, 9, 7, 8, 6],
  primaryHexagramNumber: 11,
  movingLinePositions: [3, 6],
  relatingHexagramNumber: 26,
  readingVariant: "multiple_moving",
};

const baseResult = {
  castingId: "550e8400-e29b-41d4-a716-446655440000",
  jobId: "650e8400-e29b-41d4-a716-446655440000",
  reservationId: "750e8400-e29b-41d4-a716-446655440000",
  output: { schemaVersion: "commercial-reading-v1", coreSummary: "A stable output" },
  facts,
  schemaVersion: "commercial-reading-v1",
  promptVersion: "deep-v1",
  provider: "openai",
  model: "gpt-test",
};

const env = { RESULT_INTEGRITY_KEYS: "v7:integrity-secret,v6:old-secret" };

describe("deep-reading integrity", () => {
  it("avoids delimiter-collision snapshots by hashing a structured canonical payload", () => {
    const common = {
      castingId: "casting-1",
      userId: "user-1",
      epoch: 1,
      question: "d",
      facts,
    };
    const first = calculateDeepReadingInputSnapshotHash({ ...common, scene: "a:b", interpretationGoal: "c" });
    const second = calculateDeepReadingInputSnapshotHash({ ...common, scene: "a", interpretationGoal: "b:c" });
    expect(first).not.toBe(second);
  });

  it("signs the persisted output and returns the signing-key version", () => {
    const signed = calculateDeepReadingResultIntegrity(baseResult, env);
    expect(signed.version).toBe("v7");
    expect(signed.hmac).toMatch(/^[A-Za-z0-9_-]+$/);

    const tampered = calculateDeepReadingResultIntegrity({
      ...baseResult,
      output: { ...baseResult.output, coreSummary: "tampered" },
    }, env);
    expect(tampered.hmac).not.toBe(signed.hmac);
  });

  it("binds result metadata into the integrity signature", () => {
    const signed = calculateDeepReadingResultIntegrity(baseResult, env);
    const changedModel = calculateDeepReadingResultIntegrity({ ...baseResult, model: "other-model" }, env);
    expect(changedModel.hmac).not.toBe(signed.hmac);
  });

  it("fails closed when no result-integrity key is configured", () => {
    expect(() => calculateDeepReadingResultIntegrity(baseResult, {})).toThrowError("RESULT_INTEGRITY_KEYS_INVALID");
  });
});
