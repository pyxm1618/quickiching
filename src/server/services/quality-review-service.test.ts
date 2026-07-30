import { describe, expect, it } from "vitest";
import { createMemoryRepositories } from "@/server/repositories/memory";
import { QualityReviewService } from "./quality-review-service";

function deliveredFixture() {
  const repositories = createMemoryRepositories();
  const user = repositories.identityRepository.createUser("review-service@example.com");
  const casting = repositories.castingRepository.createCastingSession({
    method: "three_coin",
    scene: "career",
    interpretationGoal: "what_do_i_need_to_see_clearly",
    userId: user.id,
    anonHash: null,
    algorithmVersion: "three-coin-v1",
  });
  repositories.castingRepository.addQuestionVersion({
    castingSessionId: casting.id,
    context: "What should I understand about this career transition?",
    versionNumber: 1,
    reason: "initial",
  });
  repositories.castingRepository.recordRiskCheck({
    castingSessionId: casting.id,
    ruleVersion: "risk-v2",
    matchedRuleCodes: [],
    reasonCode: "none",
    status: "allowed",
  });
  for (let lineIndex = 0; lineIndex < 6; lineIndex++) {
    repositories.castingRepository.saveStep({
      castingSessionId: casting.id,
      stepKind: "coin",
      lineIndex,
      changeIndex: null,
      rawRecord: {},
      lineValue: 7,
    });
  }
  repositories.castingRepository.saveCastResult({
    castingSessionId: casting.id,
    lineValues: [7, 7, 7, 7, 7, 7],
    methodCalculation: {},
  });
  repositories.castingRepository.transitionCasting(casting.id, "revealed");
  const reading = repositories.readingRepository.getOrCreateReading(casting.id);
  repositories.entitlementRepository.grantEntitlement({
    userId: user.id,
    productId: "one",
    quantity: 1,
    amountUsd: 2.99,
  });
  const frozen = repositories.entitlementRepository.freezeForReading(reading.id, user.id, new Date());
  if (!("reservationId" in frozen)) throw new Error("expected reservation");
  repositories.readingRepository.markReadingReserved(reading.id, frozen.reservationId, new Date());
  repositories.readingRepository.completeReading(
    reading.id,
    frozen.reservationId,
    { coreSummary: "delivered" },
    new Date("2026-07-30T00:00:00.000Z"),
  );
  repositories.entitlementRepository.consumeReservation(frozen.reservationId, new Date());
  const current = { value: new Date("2026-08-01T00:00:00.000Z") };
  const service = new QualityReviewService({
    reviewRepository: repositories.reviewRepository,
    readingRepository: repositories.readingRepository,
    entitlementRepository: repositories.entitlementRepository,
    clock: { now: () => new Date(current.value) },
  });
  return { repositories, user, reading, current, service };
}

describe("QualityReviewService", () => {
  it("accepts one review within the delivery window and records a response deadline", () => {
    const { repositories, user, reading, service } = deliveredFixture();

    const review = service.submit({ readingId: reading.id, userId: user.id, reason: "Missing moving-line explanation" });

    expect(review).toMatchObject({
      status: "submitted",
      responseDueAt: new Date("2026-08-08T00:00:00.000Z"),
    });
    expect(repositories.reviewRepository.getQualityReview(review.id)).toBeDefined();
    expect(() => service.submit({ readingId: reading.id, userId: user.id, reason: "duplicate" }))
      .toThrow("QUALITY_REVIEW_ALREADY_SUBMITTED");
  });

  it("allows one supplementation before review begins", () => {
    const { user, reading, service } = deliveredFixture();
    const review = service.submit({ readingId: reading.id, userId: user.id, reason: "Initial reason" });

    const supplemented = service.supplement({
      reviewId: review.id,
      userId: user.id,
      additionalReason: "The method facts also appear inconsistent.",
    });
    expect(supplemented.status).toBe("supplementing");
    expect(supplemented.reason).toContain("method facts");
    expect(() => service.supplement({
      reviewId: review.id,
      userId: user.id,
      additionalReason: "second supplement",
    })).toThrow("QUALITY_REVIEW_SUPPLEMENT_CLOSED");
  });

  it("approves a review once and grants one compensation credit", () => {
    const { repositories, user, reading, service } = deliveredFixture();
    const review = service.submit({ readingId: reading.id, userId: user.id, reason: "Objective defect" });

    const approved = service.decide({ reviewId: review.id, approved: true });
    expect(approved.status).toBe("approved");
    expect(repositories.entitlementRepository.getBatches(user.id)
      .reduce((sum, batch) => sum + batch.quantityAvailable, 0)).toBe(1);
    expect(() => service.decide({ reviewId: review.id, approved: true }))
      .toThrow("QUALITY_REVIEW_TERMINAL");
  });

  it("rejects review submission after the 7-day submission window", () => {
    const { user, reading, current, service } = deliveredFixture();
    current.value = new Date("2026-08-08T00:00:00.001Z");

    expect(() => service.submit({ readingId: reading.id, userId: user.id, reason: "Too late" }))
      .toThrow("QUALITY_REVIEW_WINDOW_CLOSED");
  });
});
