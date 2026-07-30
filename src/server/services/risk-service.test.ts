import { describe, expect, it } from "vitest";
import { ALGORITHM_VERSIONS } from "@/domain/casting/types";
import { evaluateRisk } from "@/domain/risk/engine";
import { createMemoryRepositories } from "@/server/repositories/memory";
import { RiskService } from "./risk-service";

function fixture(initialQuestion: string) {
  const repositories = createMemoryRepositories();
  const casting = repositories.castingRepository.createCastingSession({
    method: "three_coin",
    scene: "career",
    interpretationGoal: "what_do_i_need_to_see_clearly",
    userId: null,
    anonHash: "anonymous-owner",
    algorithmVersion: ALGORITHM_VERSIONS.three_coin,
  });
  const initial = evaluateRisk(initialQuestion, "career");
  repositories.castingRepository.addQuestionVersion({
    castingSessionId: casting.id,
    context: initialQuestion,
    versionNumber: 1,
    reason: "initial",
  });
  repositories.castingRepository.recordRiskCheck({
    castingSessionId: casting.id,
    ruleVersion: initial.ruleVersion,
    matchedRuleCodes: initial.matchedRuleCodes,
    reasonCode: initial.reasonCode,
    status: initial.status,
  });
  const service = new RiskService({
    castingRepository: repositories.castingRepository,
    evaluator: { evaluate: evaluateRisk },
  });
  return { repositories, casting, service };
}

describe("RiskService clarification", () => {
  it("appends a new immutable question version and re-evaluates an ambiguous question", () => {
    const { repositories, casting, service } = fixture(
      "Chemotherapy is part of the situation and I need guidance.",
    );

    const decision = service.clarifyQuestion(
      casting.id,
      "I work on marketing for a pharmaceutical company and want to understand project coordination.",
    );

    expect(decision.status).toBe("allowed");
    expect(repositories.castingRepository.getQuestionVersionCount(casting.id)).toBe(2);
    expect(repositories.castingRepository.getLatestQuestionContext(casting.id))
      .toContain("project coordination");
  });

  it("rejects clarification after an irreversible casting step", () => {
    const { repositories, casting, service } = fixture(
      "There is a court case involved. What should I do?",
    );
    repositories.castingRepository.saveStep({
      castingSessionId: casting.id,
      stepKind: "coin",
      lineIndex: 0,
      changeIndex: null,
      rawRecord: {},
      lineValue: 7,
    });

    expect(() => service.clarifyQuestion(
      casting.id,
      "I want to understand communication rather than make a legal decision.",
    )).toThrow("RISK_CLARIFICATION_CLOSED");
  });
});

describe("RiskService personalized generation gate", () => {
  it("returns the latest safe context after a fresh deterministic recheck", () => {
    const { casting, service } = fixture(
      "What should I understand about communication during this career transition?",
    );

    expect(service.recheckPersonalizedGeneration(casting.id)).toMatchObject({
      context: expect.stringContaining("communication"),
      decision: { status: "allowed" },
    });
  });

  it.each([
    "Should I change my insulin dose tonight?",
    "Should I buy Bitcoin?",
    "There is a court case involved. What should I do?",
  ])("blocks personalized generation for non-allowed risk state: %s", (question) => {
    const { casting, service } = fixture(question);
    expect(() => service.recheckPersonalizedGeneration(casting.id)).toThrow("RISK_BLOCKED");
  });
});
