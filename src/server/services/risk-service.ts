import type { RiskDecision } from "@/domain/risk/engine";
import type { Scene } from "@/domain/casting/types";
import { DomainError } from "@/server/errors/domain-error";
import type { CastingRepository } from "@/server/repositories/casting-repository";

export type RiskServiceDependencies = {
  castingRepository: CastingRepository;
  evaluator: { evaluate(question: string, scene: Scene): RiskDecision };
};

export class RiskService {
  constructor(private readonly dependencies: RiskServiceDependencies) {}

  clarifyQuestion(castingId: string, context: string): RiskDecision {
    const { castingRepository, evaluator } = this.dependencies;
    const session = castingRepository.getCastingSession(castingId);
    if (!session) throw new DomainError("CASTING_NOT_FOUND", "Casting session not found", false);
    if (
      session.lifecycle !== "draft"
      || castingRepository.getSteps(castingId).length > 0
      || !["needs_clarification", "professional_decision_blocked"].includes(session.riskStatus)
    ) {
      throw new DomainError(
        "RISK_CLARIFICATION_CLOSED",
        "This question can no longer be clarified for the current casting.",
        false,
      );
    }

    const versionCount = castingRepository.getQuestionVersionCount(castingId);
    if (versionCount >= 3) {
      throw new DomainError(
        "RISK_CLARIFICATION_LIMIT",
        "The clarification limit has been reached for this casting.",
        false,
      );
    }

    const decision = evaluator.evaluate(context, session.scene);
    castingRepository.addQuestionVersion({
      castingSessionId: castingId,
      context,
      versionNumber: versionCount + 1,
      reason: "clarification",
    });
    castingRepository.recordRiskCheck({
      castingSessionId: castingId,
      ruleVersion: decision.ruleVersion,
      matchedRuleCodes: decision.matchedRuleCodes,
      reasonCode: decision.reasonCode,
      status: decision.status,
    });
    if (decision.status === "emergency_blocked") {
      castingRepository.transitionCasting(castingId, "emergency_blocked");
    }
    return decision;
  }

  recheckPersonalizedGeneration(castingId: string): {
    context: string;
    decision: RiskDecision;
  } {
    const { castingRepository, evaluator } = this.dependencies;
    const session = castingRepository.getCastingSession(castingId);
    if (!session) throw new DomainError("CASTING_NOT_FOUND", "Casting session not found", false);
    const context = castingRepository.getLatestQuestionContext(castingId);
    const decision = evaluator.evaluate(context, session.scene);
    castingRepository.recordRiskCheck({
      castingSessionId: castingId,
      ruleVersion: decision.ruleVersion,
      matchedRuleCodes: decision.matchedRuleCodes,
      reasonCode: decision.reasonCode,
      status: decision.status,
    });
    if (decision.status !== "allowed") {
      throw new DomainError(
        "RISK_BLOCKED",
        "Personalized generation is not available for this question.",
        false,
      );
    }
    return { context, decision };
  }
}
