import type {
  CastingLifecycle,
  CastingMethod,
  InterpretationGoal,
  LineValue,
  RiskStatus,
  Scene,
} from "@/domain/casting/types";
import type {
  CastResult,
  CastingRiskDecision,
  CastingSession,
  CastingStep,
  LoginIntent,
  Preview,
  QualityReview,
  Reading,
  Reservation,
  User,
} from "@/server/repositories/models";
import type { FingerprintCandidate, RevealOutcome } from "@/server/repositories/reveal-repository";

export interface AsyncIdentityRepository {
  createUser(email: string, now: Date): Promise<User>;
  getUser(userId: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
}

export interface AsyncCastingRepository {
  createCasting(input: {
    method: CastingMethod;
    scene: Scene;
    interpretationGoal: InterpretationGoal;
    userId: string | null;
    anonymousSessionHash: string | null;
    anonymousHashKeyVersion: string | null;
    algorithmVersion: string;
    now: Date;
  }): Promise<CastingSession>;
  getCasting(castingId: string): Promise<CastingSession | undefined>;
  transitionCasting(castingId: string, lifecycle: CastingLifecycle, now: Date): Promise<CastingSession>;
  addQuestionVersion(input: {
    castingId: string;
    context: string;
    versionNumber: number;
    reason: string;
    now: Date;
  }): Promise<void>;
  getLatestQuestionContext(castingId: string): Promise<string>;
  recordRisk(input: {
    castingId: string;
    ruleVersion: string;
    matchedRuleCodes: string[];
    reasonCode: string;
    status: RiskStatus;
    now: Date;
  }): Promise<CastingRiskDecision>;
  recordStep(input: {
    castingId: string;
    stepKind: string;
    lineIndex: number;
    changeIndex: number | null;
    rawRecord: unknown;
    lineValue: LineValue | null;
    now: Date;
  }): Promise<CastingStep>;
  getSteps(castingId: string): Promise<CastingStep[]>;
  saveResult(input: {
    castingId: string;
    lineValues: LineValue[];
    methodCalculation: unknown;
    now: Date;
  }): Promise<CastResult>;
  getResult(castingId: string): Promise<CastResult | undefined>;
}

export interface AsyncLoginIntentRepository {
  create(input: {
    castingId: string;
    anonymousSessionHash: string;
    nonceHash: string;
    nonceKeyVersion: string;
    allowedCallbackPath: string;
    expiresAt: Date;
    now: Date;
  }): Promise<LoginIntent>;
  get(intentId: string): Promise<LoginIntent | undefined>;
}

export interface AsyncRevealRepository {
  consumeIntentAndReveal(input: {
    intentId: string;
    nonceHash: string;
    nonceKeyVersion: string;
    authenticatedUserId: string;
    callbackPath: string;
    fingerprintCandidates: FingerprintCandidate[];
    writeFingerprint: FingerprintCandidate;
    now: Date;
  }): Promise<RevealOutcome>;
}

export interface AsyncReadingRepository {
  getPreview(castingId: string): Promise<Preview | undefined>;
  getReading(readingId: string): Promise<Reading | undefined>;
  getReadingByCasting(castingId: string): Promise<Reading | undefined>;
  createReading(castingId: string, now: Date): Promise<Reading>;
}

export interface AsyncEntitlementRepository {
  reserveForReading(readingId: string, userId: string, now: Date): Promise<{ reservationId: string }>;
  getReservation(reservationId: string): Promise<Reservation | undefined>;
  consumeReservation(reservationId: string, eventId: string, now: Date): Promise<boolean>;
  releaseReservation(reservationId: string, eventId: string, expired: boolean, now: Date): Promise<boolean>;
}

export interface AsyncReviewRepository {
  createReview(input: {
    readingId: string;
    userId: string;
    reason: string;
    responseDueAt: Date;
    now: Date;
  }): Promise<QualityReview>;
  getReview(reviewId: string): Promise<QualityReview | undefined>;
}

export interface AsyncPrivacyRepository {
  listHistory(userId: string): Promise<CastingSession[]>;
  requestDeletion(castingId: string, userId: string, now: Date): Promise<CastingSession>;
  restore(castingId: string, userId: string, now: Date): Promise<CastingSession>;
  purgeDue(now: Date): Promise<number>;
}
