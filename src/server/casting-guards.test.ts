import { describe, expect, it } from "vitest";
import { assertCastingMutationAllowed, nextMissingCoinLine, nextYarrowCoordinate } from "./casting-guards";
import type { CastingSession, CastingStep } from "./repository";

const session = (overrides: Partial<CastingSession> = {}): CastingSession => ({
  id: "cast", userId: null, anonymousSessionHash: "anon", anonymousHashKeyVersion: "v1",
  method: "three_coin", lifecycle: "casting", riskStatus: "allowed", scene: "career",
  interpretationGoal: "what_do_i_need_to_see_clearly", currentQuestionVersionId: "q1",
  questionFingerprint: null, fingerprintKeyVersion: null, algorithmVersion: "three-coin-v1",
  firstIrreversibleStepAt: new Date(), castingExpiresAt: new Date(Date.now() + 1000),
  completedAt: null, revealExpiresAt: null, revealedAt: null, duplicateOfCastingId: null,
  deletedAt: null, purgeAfter: null, createdAt: new Date(), updatedAt: new Date(),
  ...overrides,
});

const step = (lineIndex: number, changeIndex: number | null = null): CastingStep => ({
  id: `${lineIndex}-${changeIndex}`, castingSessionId: "cast", stepKind: changeIndex === null ? "coin" : "yarrow_change",
  lineIndex, changeIndex, rawRecord: {}, lineValue: null, algorithmVersion: "v1", createdAt: new Date(),
});

describe("casting guards", () => {
  it("rejects a casting mutation without a persisted question", () => {
    expect(() => assertCastingMutationAllowed(session({ currentQuestionVersionId: null }), "three_coin", new Date())).toThrow("QUESTION_REQUIRED");
  });

  it("allows the ritual for a professional-decision question on the classic-only path", () => {
    expect(() => assertCastingMutationAllowed(
      session({ riskStatus: "professional_decision_blocked" }),
      "three_coin",
      new Date(),
    )).not.toThrow();
  });

  it("rejects the ritual while clarification is still required", () => {
    expect(() => assertCastingMutationAllowed(
      session({ riskStatus: "needs_clarification" }),
      "three_coin",
      new Date(),
    )).toThrow("RISK_CLARIFICATION_REQUIRED");
  });

  it("rejects an expired session before a new random step", () => {
    expect(() => assertCastingMutationAllowed(session({ castingExpiresAt: new Date(Date.now() - 1) }), "three_coin", new Date())).toThrow("CASTING_EXPIRED");
  });

  it("accepts only the first missing coin line", () => {
    expect(nextMissingCoinLine([step(0), step(1)])).toBe(2);
    expect(nextMissingCoinLine([step(0), step(2)])).toBe(1);
  });

  it("accepts yarrow changes in one global order", () => {
    expect(nextYarrowCoordinate([step(0, 0), step(0, 1)])).toEqual({ lineIndex: 0, changeIndex: 2 });
    expect(nextYarrowCoordinate([step(0, 0), step(0, 1), step(0, 2)])).toEqual({ lineIndex: 1, changeIndex: 0 });
  });
});
