import { ALGORITHM_VERSIONS, type CastingMethod, type InterpretationGoal, type LineValue, type Scene } from "@/domain/casting/types";
import { generateThreeCoinLine } from "@/domain/casting/three-coin/algorithm";
import { generateYarrowChange } from "@/domain/casting/yarrow/algorithm";
import { meiHuaFromUtc, type MeiHuaResult } from "@/domain/casting/mei-hua/algorithm";
import type { RiskDecision } from "@/domain/risk/engine";
import { DomainError } from "@/server/errors/domain-error";
import { assertCastingMutationAllowed, nextMissingCoinLine, nextYarrowCoordinate } from "@/server/casting-guards";
import type { CastingRepository } from "@/server/repositories/casting-repository";
import {
  coinLineProgress,
  findCoinStep,
  findYarrowStep,
  yarrowChangeProgress,
  type CoinLineIndex,
  type CoinLineProgress,
  type YarrowChangeIndex,
  type YarrowChangeProgress,
} from "./casting-steps";

export type CastingClock = { now(): Date };
export type CastingRandomSource = {
  randomBit(): boolean;
  randomInt(maxExclusive: number): number;
};
export type CastingRiskService = {
  evaluate(question: string, scene: Scene): RiskDecision;
};

export type CastingServiceDependencies = {
  castingRepository: CastingRepository;
  clock: CastingClock;
  randomSource: CastingRandomSource;
  riskService: CastingRiskService;
};

export class CastingService {
  constructor(private readonly dependencies: CastingServiceDependencies) {}

  createDraft(input: {
    method: CastingMethod;
    scene: Scene;
    interpretationGoal: InterpretationGoal;
    userId: string | null;
    anonHash: string | null;
  }): { castingId: string; method: CastingMethod; lifecycle: "draft" } {
    const { castingRepository } = this.dependencies;
    const ownerId = input.userId ?? input.anonHash;
    if (ownerId) {
      const active = castingRepository.findActiveCasting(ownerId, input.userId != null);
      if (active?.lifecycle === "draft") {
        castingRepository.transitionCasting(active.id, "user_deleted");
      } else if (active) {
        const clocks = castingRepository.evaluateSessionClocks(active, this.dependencies.clock.now());
        const timedOut = active.lifecycle === "casting" ? clocks.castingExpired : clocks.revealExpired;
        if (timedOut) castingRepository.transitionCasting(active.id, "expired");
      }
    }
    const session = castingRepository.createCastingSession({
      ...input,
      algorithmVersion: ALGORITHM_VERSIONS[input.method],
    });
    return { castingId: session.id, method: session.method, lifecycle: "draft" };
  }

  submitQuestion(castingId: string, question: string): {
    riskStatus: RiskDecision["status"];
    reasonCode: string;
    emergency: boolean;
  } {
    const { castingRepository, riskService } = this.dependencies;
    const session = castingRepository.getCastingSession(castingId);
    if (!session) throw new DomainError("CASTING_NOT_FOUND", "Casting session not found", false);
    if (session.currentQuestionVersionId) {
      if (castingRepository.getLatestQuestionContext(castingId) !== question) {
        throw new DomainError("QUESTION_IMMUTABLE", "The casting question can no longer be changed.", false);
      }
      const replayRisk = castingRepository.getRiskDecision(castingId);
      if (!replayRisk) throw new Error("CASTING_RISK_DECISION_MISSING");
      return {
        riskStatus: replayRisk.status,
        reasonCode: replayRisk.reasonCode,
        emergency: replayRisk.status === "emergency_blocked",
      };
    }
    if (session.lifecycle !== "draft") {
      throw new DomainError("CASTING_NOT_ACTIVE", "This casting cannot be changed in its current state.", false);
    }
    const risk = riskService.evaluate(question, session.scene);
    castingRepository.recordRiskCheck({
      castingSessionId: castingId,
      ruleVersion: risk.ruleVersion,
      matchedRuleCodes: risk.matchedRuleCodes,
      reasonCode: risk.reasonCode,
      status: risk.status,
    });
    castingRepository.addQuestionVersion({
      castingSessionId: castingId,
      context: question,
      versionNumber: 1,
      reason: "initial",
    });
    if (risk.status === "emergency_blocked") {
      castingRepository.transitionCasting(castingId, "emergency_blocked");
    }
    return {
      riskStatus: risk.status,
      reasonCode: risk.reasonCode,
      emergency: risk.status === "emergency_blocked",
    };
  }

  async recordCoinLine(castingId: string, lineIndex: CoinLineIndex): Promise<CoinLineProgress> {
    const { castingRepository } = this.dependencies;
    const steps = castingRepository.getSteps(castingId);
    const existing = findCoinStep(steps, lineIndex);
    const session = castingRepository.getCastingSession(castingId);
    if (!session) throw new DomainError("CASTING_NOT_FOUND", "Casting session not found", false);
    if (session.method !== "three_coin") {
      throw new DomainError("CASTING_METHOD_MISMATCH", "This casting cannot be changed in its current state.", false);
    }
    if (session.lifecycle === "expired") {
      throw new DomainError("CASTING_EXPIRED", "This casting cannot be changed in its current state.", false);
    }
    const clocks = castingRepository.evaluateSessionClocks(session, this.dependencies.clock.now());
    const clockExpired = session.lifecycle === "casting"
      ? clocks.castingExpired
      : session.lifecycle === "awaiting_reveal" && clocks.revealExpired;
    if (clockExpired) {
      castingRepository.transitionCasting(castingId, "expired");
      throw new DomainError("CASTING_EXPIRED", "This casting cannot be changed in its current state.", false);
    }
    if (session.lifecycle === "awaiting_reveal" && existing && castingRepository.getCastResult(castingId)) {
      return coinLineProgress(existing, steps);
    }
    assertCastingMutationAllowed(session, "three_coin", this.dependencies.clock.now());
    if (!existing && nextMissingCoinLine(steps) !== lineIndex) {
      throw new DomainError("CASTING_STEP_OUT_OF_ORDER", "This casting cannot be changed in its current state.", false);
    }
    const outcome = await castingRepository.recordCoinStep({
      castingSessionId: castingId,
      lineIndex,
      create: () => {
        const generated = generateThreeCoinLine(lineIndex, this.dependencies.randomSource.randomBit);
        return { rawRecord: generated, lineValue: generated.lineValue };
      },
    });
    return coinLineProgress(outcome.step, castingRepository.getSteps(castingId));
  }

  recordYarrowChange(
    castingId: string,
    lineIndex: CoinLineIndex,
    changeIndex: YarrowChangeIndex,
  ): YarrowChangeProgress {
    const { castingRepository } = this.dependencies;
    const steps = castingRepository.getSteps(castingId);
    const existing = findYarrowStep(steps, lineIndex, changeIndex);
    const session = castingRepository.getCastingSession(castingId);
    if (!session) throw new DomainError("CASTING_NOT_FOUND", "Casting session not found", false);
    if (session.method !== "yarrow_stalk") {
      throw new DomainError("CASTING_METHOD_MISMATCH", "This casting cannot be changed in its current state.", false);
    }
    if (session.lifecycle === "expired") {
      throw new DomainError("CASTING_EXPIRED", "This casting cannot be changed in its current state.", false);
    }
    const clocks = castingRepository.evaluateSessionClocks(session, this.dependencies.clock.now());
    const clockExpired = session.lifecycle === "casting"
      ? clocks.castingExpired
      : session.lifecycle === "awaiting_reveal" && clocks.revealExpired;
    if (clockExpired) {
      castingRepository.transitionCasting(castingId, "expired");
      throw new DomainError("CASTING_EXPIRED", "This casting cannot be changed in its current state.", false);
    }
    assertCastingMutationAllowed(session, "yarrow_stalk", this.dependencies.clock.now());
    if (existing) return yarrowChangeProgress(existing, steps);
    const next = nextYarrowCoordinate(steps);
    if (!next || next.lineIndex !== lineIndex || next.changeIndex !== changeIndex) {
      throw new DomainError("CASTING_STEP_OUT_OF_ORDER", "This casting cannot be changed in its current state.", false);
    }
    const previousStalks = changeIndex === 0
      ? 49
      : (findYarrowStep(steps, lineIndex, (changeIndex - 1) as YarrowChangeIndex)!.rawRecord as { endingStalks: number }).endingStalks;
    const persisted = castingRepository.getOrCreateStep({
      castingSessionId: castingId,
      stepKind: "yarrow_change",
      lineIndex,
      changeIndex,
      create: () => {
        const generated = generateYarrowChange(
          lineIndex,
          changeIndex,
          previousStalks,
          this.dependencies.randomSource.randomInt,
        );
        const lineValue = changeIndex === 2 ? generated.endingStalks / 4 as 6 | 7 | 8 | 9 : null;
        return { rawRecord: generated, lineValue };
      },
    });
    return yarrowChangeProgress(persisted, castingRepository.getSteps(castingId));
  }

  completeYarrow(castingId: string): { completed: true } {
    const { castingRepository } = this.dependencies;
    const session = castingRepository.getCastingSession(castingId);
    if (!session) throw new DomainError("CASTING_NOT_FOUND", "Casting session not found", false);
    if (session.method !== "yarrow_stalk") {
      throw new DomainError("CASTING_METHOD_MISMATCH", "This casting cannot be changed in its current state.", false);
    }
    const existingResult = castingRepository.getCastResult(castingId);
    if (existingResult) return { completed: true };
    if (session.lifecycle === "casting" && castingRepository.evaluateSessionClocks(
      session,
      this.dependencies.clock.now(),
    ).castingExpired) {
      castingRepository.transitionCasting(castingId, "expired");
      throw new DomainError("CASTING_EXPIRED", "This casting cannot be changed in its current state.", false);
    }
    assertCastingMutationAllowed(session, "yarrow_stalk", this.dependencies.clock.now());
    const steps = castingRepository.getSteps(castingId).filter((step) => step.stepKind === "yarrow_change");
    if (steps.length !== 18) {
      throw new DomainError("CASTING_INCOMPLETE", "All 18 changes are required", false);
    }
    const lineValues: LineValue[] = [0, 1, 2, 3, 4, 5].map((lineIndex) =>
      steps.find((step) => step.lineIndex === lineIndex && step.changeIndex === 2)!.lineValue!,
    );
    castingRepository.saveCastResult({
      castingSessionId: castingId,
      lineValues,
      methodCalculation: { kind: "yarrow", steps: steps.map((step) => step.rawRecord) },
    });
    return { completed: true };
  }

  recordMeiHua(castingId: string, ianaTimeZone: string): {
    completed: true;
  } {
    const { castingRepository } = this.dependencies;
    const session = castingRepository.getCastingSession(castingId);
    if (!session) throw new DomainError("CASTING_NOT_FOUND", "Casting session not found", false);
    if (session.method !== "mei_hua_current_time") {
      throw new DomainError("CASTING_METHOD_MISMATCH", "This casting cannot be changed in its current state.", false);
    }
    if (castingRepository.getCastResult(castingId)) {
      return { completed: true };
    }
    const steps = castingRepository.getSteps(castingId);
    const persistedStep = steps.find((step) => step.stepKind === "mei_hua");
    if (!persistedStep) {
      assertCastingMutationAllowed(session, "mei_hua_current_time", this.dependencies.clock.now());
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: ianaTimeZone }).format();
      } catch {
        throw new DomainError("INVALID_TIME_ZONE", "Invalid request input", false, "ianaTimeZone");
      }
    }
    const step = persistedStep ?? castingRepository.getOrCreateStep({
      castingSessionId: castingId,
      stepKind: "mei_hua",
      lineIndex: 0,
      changeIndex: null,
      create: () => {
        const result = meiHuaFromUtc(this.dependencies.clock.now().getTime(), ianaTimeZone);
        return {
          rawRecord: { result },
          lineValue: result.lineValuesBottomUp[0],
        };
      },
    });
    const result = (step.rawRecord as { result: MeiHuaResult }).result;
    castingRepository.saveCastResult({
      castingSessionId: castingId,
      lineValues: [...result.lineValuesBottomUp],
      methodCalculation: result.methodCalculation,
    });
    return { completed: true };
  }
}
