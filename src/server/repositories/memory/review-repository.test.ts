import { describe, expect, it } from "vitest";
import { repo } from "@/server/repository";

function createDeliveredReading() {
  const user = repo.createUser(`review-${crypto.randomUUID()}@example.com`);
  const casting = repo.createCastingSession({
    method: "three_coin",
    scene: "career",
    interpretationGoal: "what_do_i_need_to_see_clearly",
    userId: user.id,
    anonHash: null,
    algorithmVersion: "three-coin-v1",
  });
  repo.saveStep({ castingSessionId: casting.id, stepKind: "coin", lineIndex: 0, changeIndex: null, rawRecord: {}, lineValue: 7 });
  repo.saveCastResult({ castingSessionId: casting.id, lineValues: [7, 7, 7, 7, 7, 7], methodCalculation: {} });
  repo.transitionCasting(casting.id, "revealed");
  const reading = repo.getOrCreateReading(casting.id);
  repo.grantEntitlement({ userId: user.id, productId: "one", quantity: 1, amountUsd: 2.99 });
  const frozen = repo.freezeForReading(reading.id, user.id, new Date());
  if (!("reservationId" in frozen)) throw new Error("expected reservation");
  repo.completeReadingConsume(frozen.reservationId, { coreSummary: "done" });
  return { user, casting, reading };
}

describe("memory review repository characterization", () => {
  it("accepts one owner review for a delivered reading and decides it", () => {
    const { user, reading } = createDeliveredReading();
    const review = repo.createQualityReview({ readingId: reading.id, userId: user.id, reason: "needs detail" });

    expect(review.status).toBe("submitted");
    expect(repo.decideQualityReview(review.id, true).status).toBe("approved");
    expect(() => repo.createQualityReview({ readingId: reading.id, userId: user.id, reason: "again" })).toThrow("QUALITY_REVIEW_ALREADY_SUBMITTED");
  });
});
