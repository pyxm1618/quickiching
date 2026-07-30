import type {
  CastingLifecycle,
  CastingMethod,
  InterpretationGoal,
  LineValue,
  RiskStatus,
  Scene,
} from "@/domain/casting/types";
import type { CastResult, CastingRiskDecision, CastingSession, CastingStep, QuestionVersion } from "./models";

export type CreateCastingSessionInput = {
  method: CastingMethod;
  scene: Scene;
  interpretationGoal: InterpretationGoal;
  userId: string | null;
  anonHash: string | null;
  algorithmVersion: string;
};

export type RecordCoinStepInput = {
  castingSessionId: string;
  lineIndex: number;
  create: () => { rawRecord: unknown; lineValue: LineValue };
};

export type RecordCoinStepOutcome = {
  step: CastingStep;
  completed: boolean;
};

export interface CastingRepository {
  hasActiveCast(ownerId: string, isUser: boolean): boolean;
  findActiveCasting(ownerId: string, isUser: boolean): CastingSession | undefined;
  createCastingSession(input: CreateCastingSessionInput): CastingSession;
  getCastingSession(castingId: string): CastingSession | undefined;
  ownsCasting(castingId: string, userId: string | null, anonHash: string | null): boolean;
  canReadRevealedResult(castingId: string, userId: string | null): boolean;
  transitionCasting(castingId: string, to: CastingLifecycle): CastingSession;
  addQuestionVersion(input: {
    castingSessionId: string;
    context: string;
    versionNumber: number;
    reason: string;
  }): Readonly<QuestionVersion>;
  getLatestQuestionContext(castingSessionId: string): string;
  getQuestionVersionCount(castingSessionId: string): number;
  saveStep(input: {
    castingSessionId: string;
    stepKind: string;
    lineIndex: number;
    changeIndex: number | null;
    rawRecord: unknown;
    lineValue: LineValue | null;
  }): CastingStep;
  getOrCreateStep(input: {
    castingSessionId: string;
    stepKind: string;
    lineIndex: number;
    changeIndex: number | null;
    create: () => { rawRecord: unknown; lineValue: LineValue | null };
  }): CastingStep;
  recordCoinStep(input: RecordCoinStepInput): Promise<RecordCoinStepOutcome>;
  getSteps(castingSessionId: string): CastingStep[];
  saveCastResult(input: {
    castingSessionId: string;
    lineValues: LineValue[];
    methodCalculation: unknown;
  }): CastResult;
  getCastResult(castingSessionId: string): CastResult | undefined;
  recordRiskCheck(input: {
    castingSessionId: string;
    ruleVersion: string;
    matchedRuleCodes: string[];
    reasonCode: string;
    status: RiskStatus;
  }): void;
  getRiskDecision(castingSessionId: string): CastingRiskDecision | undefined;
  acquireQuestionLock(input: {
    userId: string;
    fingerprint: string;
    keyVersion: string;
    winningCastingId: string;
    now: Date;
  }): { won: boolean; winningCastingId: string };
  revealWithQuestionLock(input: {
    castingId: string;
    userId: string;
    fingerprint: string;
    keyVersion: string;
    now: Date;
  }): { revealed: boolean; duplicate: boolean; winningCastingId?: string };
  evaluateSessionClocks(session: CastingSession, now: Date): { castingExpired: boolean; revealExpired: boolean };
}
