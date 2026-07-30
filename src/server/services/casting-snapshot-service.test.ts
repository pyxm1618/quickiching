import { describe, expect, it } from "vitest";
import { ALGORITHM_VERSIONS } from "@/domain/casting/types";
import { createMemoryRepositories } from "@/server/repositories/memory";
import { CastingSnapshotService } from "./casting-snapshot-service";

function createCasting(revealed: boolean) {
  const repositories = createMemoryRepositories();
  const user = repositories.identityRepository.createUser("snapshot@example.com");
  const casting = repositories.castingRepository.createCastingSession({
    method: "yarrow_stalk",
    scene: "career",
    interpretationGoal: "what_do_i_need_to_see_clearly",
    userId: revealed ? user.id : null,
    anonHash: revealed ? null : "anonymous-owner",
    algorithmVersion: ALGORITHM_VERSIONS.yarrow_stalk,
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
  for (let changeIndex = 0; changeIndex < 5; changeIndex++) {
    repositories.castingRepository.saveStep({
      castingSessionId: casting.id,
      stepKind: "yarrow_change",
      lineIndex: Math.floor(changeIndex / 3),
      changeIndex: changeIndex % 3,
      rawRecord: { endingStalks: 40 },
      lineValue: changeIndex === 2 ? 8 : null,
    });
  }
  return { repositories, casting, user };
}

describe("CastingSnapshotService", () => {
  it("returns progress-only state to the anonymous owner and never result or question fields", () => {
    const { repositories, casting } = createCasting(false);
    const service = new CastingSnapshotService({
      castingRepository: repositories.castingRepository,
      readingRepository: repositories.readingRepository,
    });

    const snapshot = service.load({
      castingId: casting.id,
      userId: null,
      anonymousSessionHash: "anonymous-owner",
      now: new Date(),
    });

    expect(snapshot).toMatchObject({
      castingId: casting.id,
      method: "yarrow_stalk",
      phase: "ritual",
      progress: { completedSteps: 5, totalSteps: 18 },
      riskStatus: "allowed",
      canReadResult: false,
    });
    expect(snapshot).not.toHaveProperty("context");
    expect(snapshot.result).toBeNull();
    expect(snapshot.preview).toBeNull();
    expect(snapshot.reading).toBeNull();
  });

  it("derives reload progress from persisted steps rather than a forged client count", () => {
    const { repositories, casting } = createCasting(false);
    const service = new CastingSnapshotService({
      castingRepository: repositories.castingRepository,
      readingRepository: repositories.readingRepository,
    });

    expect(service.load({
      castingId: casting.id,
      userId: null,
      anonymousSessionHash: "anonymous-owner",
      now: new Date(),
    })?.progress).toEqual({ completedSteps: 5, totalSteps: 18 });
  });

  it("returns display-safe result and generated content only to the revealed authenticated owner", async () => {
    const { repositories, casting, user } = createCasting(true);
    for (let index = 5; index < 18; index++) {
      repositories.castingRepository.saveStep({
        castingSessionId: casting.id,
        stepKind: "yarrow_change",
        lineIndex: Math.floor(index / 3),
        changeIndex: index % 3,
        rawRecord: { endingStalks: index % 3 === 2 ? 32 : 40 },
        lineValue: index % 3 === 2 ? 8 : null,
      });
    }
    repositories.castingRepository.saveCastResult({
      castingSessionId: casting.id,
      lineValues: [8, 8, 8, 8, 8, 8],
      methodCalculation: { kind: "yarrow" },
    });
    repositories.castingRepository.transitionCasting(casting.id, "revealed");
    repositories.readingRepository.savePreviewSuccess(casting.id, "A fixed preview tied to this context and result.");
    const reading = repositories.readingRepository.getOrCreateReading(casting.id);
    const entitlement = repositories.entitlementRepository.grantEntitlement({
      userId: user.id,
      productId: "one",
      quantity: 1,
      amountUsd: 2.99,
    });
    expect(entitlement.quantityAvailable).toBe(1);
    const reservation = repositories.entitlementRepository.freezeForReading(reading.id, user.id, new Date());
    if (!("reservationId" in reservation)) throw new Error("expected reservation");
    repositories.readingRepository.markReadingReserved(reading.id, reservation.reservationId, new Date());
    repositories.readingRepository.completeReading(
      reading.id,
      reservation.reservationId,
      { coreSummary: "completed" },
      new Date(),
    );

    const service = new CastingSnapshotService({
      castingRepository: repositories.castingRepository,
      readingRepository: repositories.readingRepository,
    });
    const snapshot = service.load({
      castingId: casting.id,
      userId: user.id,
      anonymousSessionHash: null,
      now: new Date(),
    });

    expect(snapshot).toMatchObject({
      phase: "result",
      canReadResult: true,
      result: { lineValues: [8, 8, 8, 8, 8, 8] },
      preview: { relevanceStatement: expect.stringContaining("fixed preview") },
      reading: { report: { coreSummary: "completed" } },
    });
  });

  it("returns null for a non-owner even when the casting id is valid", () => {
    const { repositories, casting } = createCasting(false);
    const service = new CastingSnapshotService({
      castingRepository: repositories.castingRepository,
      readingRepository: repositories.readingRepository,
    });

    expect(service.load({
      castingId: casting.id,
      userId: null,
      anonymousSessionHash: "forged-owner",
      now: new Date(),
    })).toBeNull();
  });
});
