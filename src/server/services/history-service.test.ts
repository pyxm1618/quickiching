import { describe, expect, it } from "vitest";
import { createMemoryRepositories, MemoryStore } from "@/server/repositories/memory";
import { HistoryService } from "./history-service";

function fixture() {
  const store = new MemoryStore();
  const repositories = createMemoryRepositories(store);
  const user = repositories.identityRepository.createUser("history@example.com");
  const otherUser = repositories.identityRepository.createUser("history-other@example.com");
  const create = (
    method: "three_coin" | "yarrow_stalk",
    scene: "career" | "relationships",
    context: string,
    createdAt: string,
  ) => {
    const casting = repositories.castingRepository.createCastingSession({
      method,
      scene,
      interpretationGoal: "what_do_i_need_to_see_clearly",
      userId: user.id,
      anonHash: null,
      algorithmVersion: method === "three_coin" ? "three-coin-v1" : "yarrow-v1",
    });
    const stored = store.castingSessions.get(casting.id)!;
    stored.createdAt = new Date(createdAt);
    stored.updatedAt = new Date(createdAt);
    repositories.castingRepository.addQuestionVersion({
      castingSessionId: casting.id,
      context,
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
    const values = [7, 8, 7, 8, 7, 8] as const;
    values.forEach((lineValue, lineIndex) => repositories.castingRepository.saveStep({
      castingSessionId: casting.id,
      stepKind: method === "three_coin" ? "coin" : "yarrow_change",
      lineIndex,
      changeIndex: method === "three_coin" ? null : 2,
      rawRecord: method === "three_coin"
        ? { coinFaces: lineValue === 7 ? ["yang", "yin", "yin"] : ["yang", "yang", "yin"] }
        : { startingStalks: 36, leftGroup: 18, rightGroup: 18, endingStalks: 28 },
      lineValue,
    }));
    repositories.castingRepository.saveCastResult({
      castingSessionId: casting.id,
      lineValues: [...values],
      methodCalculation: { method, persisted: true },
    });
    repositories.castingRepository.transitionCasting(casting.id, "revealed");
    return casting;
  };
  const newest = create(
    "three_coin",
    "career",
    "Should I clarify the scope of the new role before accepting it?",
    "2026-07-30T03:00:00.000Z",
  );
  const middle = create(
    "yarrow_stalk",
    "relationships",
    "What is blocking a more direct conversation in this relationship?",
    "2026-07-30T02:00:00.000Z",
  );
  const oldest = create(
    "three_coin",
    "career",
    "What should I understand about the timing of this career transition?",
    "2026-07-30T01:00:00.000Z",
  );

  repositories.readingRepository.savePreviewSuccess(newest.id, "completed preview");
  const reading = repositories.readingRepository.getOrCreateReading(newest.id);
  repositories.entitlementRepository.grantEntitlement({
    userId: user.id,
    productId: "one",
    quantity: 1,
    amountUsd: 2.99,
  });
  const frozen = repositories.entitlementRepository.freezeForReading(
    reading.id,
    user.id,
    new Date("2026-07-30T04:00:00.000Z"),
  );
  if (!("reservationId" in frozen)) throw new Error("expected reservation");
  repositories.readingRepository.markReadingReserved(
    reading.id,
    frozen.reservationId,
    new Date("2026-07-30T04:00:00.000Z"),
  );
  repositories.readingRepository.completeReading(
    reading.id,
    frozen.reservationId,
    { coreSummary: "completed report" },
    new Date("2026-07-30T04:01:00.000Z"),
  );
  repositories.entitlementRepository.consumeReservation(
    frozen.reservationId,
    new Date("2026-07-30T04:01:00.000Z"),
  );
  const review = repositories.reviewRepository.createQualityReview({
    readingId: reading.id,
    userId: user.id,
    reason: "Missing method evidence",
    responseDueAt: new Date("2026-08-04T00:00:00.000Z"),
    now: new Date("2026-07-30T05:00:00.000Z"),
  });
  const compensation = repositories.entitlementRepository.grantEntitlement({
    userId: user.id,
    productId: "quality-review-compensation",
    quantity: 1,
    amountUsd: 0,
    reviewId: review.id,
  });
  repositories.reviewRepository.decideQualityReview({
    reviewId: review.id,
    approved: true,
    compensationBatchId: compensation.id,
    now: new Date("2026-07-31T05:00:00.000Z"),
  });

  const service = new HistoryService({ historyRepository: repositories.historyRepository });
  return { user, otherUser, newest, middle, oldest, reading, review, service };
}

describe("HistoryService", () => {
  it("returns complete history fields and applies filters in the repository query", () => {
    const { user, newest, reading, review, service } = fixture();
    const page = service.listPage(user.id, {
      method: "three_coin",
      scene: "career",
      hasPreview: true,
      hasReading: true,
      limit: 10,
    });

    expect(page.nextCursor).toBeNull();
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      castingId: newest.id,
      method: "three_coin",
      scene: "career",
      interpretationGoal: "what_do_i_need_to_see_clearly",
      questionContext: "Should I clarify the scope of the new role before accepting it?",
      result: {
        lineValues: [7, 8, 7, 8, 7, 8],
        primaryHexagramNumber: expect.any(Number),
        movingLinePositions: [],
        algorithmVersion: "three-coin-v1",
        classicMappingVersion: "king-wen-v1",
      },
      previewStatus: "completed",
      readingId: reading.id,
      readingStatus: "completed",
      qualityReview: {
        status: "approved",
        compensationBatchId: expect.any(String),
      },
    });
    expect(page.items[0].entitlementChanges.map((entry) => entry.action))
      .toEqual(expect.arrayContaining(["reserve", "consume", "compensate"]));
    expect(page.items[0].entitlementChanges.some((entry) => entry.reviewId === review.id)).toBe(true);
  });

  it("uses stable keyset pagination without duplicates or skipped records", () => {
    const { user, newest, middle, oldest, service } = fixture();
    const first = service.listPage(user.id, { limit: 1 });
    const second = service.listPage(user.id, { limit: 1, cursor: first.nextCursor });
    const third = service.listPage(user.id, { limit: 1, cursor: second.nextCursor });

    expect(first.items.map((item) => item.castingId)).toEqual([newest.id]);
    expect(second.items.map((item) => item.castingId)).toEqual([middle.id]);
    expect(third.items.map((item) => item.castingId)).toEqual([oldest.id]);
    expect(third.nextCursor).toBeNull();
  });

  it("never returns another user's records and rejects malformed pagination input", () => {
    const { otherUser, service } = fixture();
    expect(service.listPage(otherUser.id, {}).items).toEqual([]);
    expect(() => service.listPage(otherUser.id, { cursor: "not-a-valid-cursor" }))
      .toThrow("HISTORY_CURSOR_INVALID");
    expect(() => service.listPage(otherUser.id, { limit: 51 }))
      .toThrow("HISTORY_PAGE_SIZE_INVALID");
  });
});
