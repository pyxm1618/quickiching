import { describe, expect, it } from "vitest";
import { createMemoryRepositories } from "@/server/repositories/memory";
import { HistoryService } from "./history-service";

function fixture() {
  const repositories = createMemoryRepositories();
  const user = repositories.identityRepository.createUser("history@example.com");
  const create = (method: "three_coin" | "yarrow_stalk", scene: "career" | "relationships") => {
    const casting = repositories.castingRepository.createCastingSession({
      method,
      scene,
      interpretationGoal: "what_do_i_need_to_see_clearly",
      userId: user.id,
      anonHash: null,
      algorithmVersion: method === "three_coin" ? "three-coin-v1" : "yarrow-v1",
    });
    repositories.castingRepository.addQuestionVersion({
      castingSessionId: casting.id,
      context: `A sufficiently detailed ${scene} question for account history`,
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
      rawRecord: {},
      lineValue,
    }));
    repositories.castingRepository.saveCastResult({
      castingSessionId: casting.id,
      lineValues: [...values],
      methodCalculation: {},
    });
    repositories.castingRepository.transitionCasting(casting.id, "revealed");
    return casting;
  };
  const career = create("three_coin", "career");
  const relationship = create("yarrow_stalk", "relationships");
  repositories.readingRepository.savePreviewSuccess(career.id, "completed preview");
  const service = new HistoryService({
    privacyRepository: repositories.privacyRepository,
    castingRepository: repositories.castingRepository,
    readingRepository: repositories.readingRepository,
  });
  return { user, career, relationship, service };
}

describe("HistoryService", () => {
  it("filters by method, scene, and generated-content state", () => {
    const { user, career, relationship, service } = fixture();

    expect(service.list(user.id, { method: "three_coin" }).map((item) => item.id)).toEqual([career.id]);
    expect(service.list(user.id, { scene: "relationships" }).map((item) => item.id)).toEqual([relationship.id]);
    expect(service.list(user.id, { hasPreview: true }).map((item) => item.id)).toEqual([career.id]);
    expect(service.list(user.id, { hasReading: true })).toEqual([]);
  });

  it("never returns another user's records or recoverable deletions", () => {
    const { service } = fixture();
    expect(service.list("usr_not-the-owner", {})).toEqual([]);
  });
});
