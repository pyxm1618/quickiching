import type {
  CastingLifecycle,
  CastingMethod,
  InterpretationGoal,
  LineValue,
  PreviewStatus,
  QualityReviewStatus,
  ReadingStatus,
  ReservationStatus,
  RiskStatus,
  Scene,
} from "@/domain/casting/types";

export type User = {
  id: string;
  email: string;
  deletionRequestedAt?: Date | null;
  anonymizedAt?: Date | null;
  createdAt: Date;
};
export type Session = { id: string; userId: string; createdAt: Date; expiresAt: Date };

export type AccountDeletionRequest = {
  userId: string;
  requestedAt: Date;
  purgeAfter: Date;
  castingLifecycleSnapshot: Record<string, CastingLifecycle>;
  restoredAt: Date | null;
  purgedAt: Date | null;
};

export type LoginIntent = {
  id: string;
  castingSessionId: string;
  anonymousSessionHash: string;
  nonceHash: string;
  nonceKeyVersion: string;
  expectedEmailHash: string | null;
  expectedEmailKeyVersion: string | null;
  allowedCallbackPath: string;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
};

export type CastingSession = {
  id: string;
  userId: string | null;
  anonymousSessionHash: string | null;
  anonymousHashKeyVersion: string | null;
  method: CastingMethod;
  lifecycle: CastingLifecycle;
  riskStatus: RiskStatus;
  scene: Scene;
  interpretationGoal: InterpretationGoal;
  currentQuestionVersionId: string | null;
  questionFingerprint: string | null;
  fingerprintKeyVersion: string | null;
  algorithmVersion: string;
  firstIrreversibleStepAt: Date | null;
  castingExpiresAt: Date | null;
  completedAt: Date | null;
  revealExpiresAt: Date | null;
  revealedAt: Date | null;
  duplicateOfCastingId: string | null;
  deletedAt: Date | null;
  purgeAfter: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type QuestionVersion = {
  id: string;
  castingSessionId: string;
  versionNumber: number;
  ciphertext: string;
  iv: string;
  authTag: string;
  encryptionKeyVersion: string;
  createdReason: string;
  createdAt: Date;
};

export type CastingRiskDecision = {
  castingSessionId: string;
  ruleVersion: string;
  matchedRuleCodes: string[];
  reasonCode: string;
  status: RiskStatus;
  createdAt: Date;
};

export type CastingStep = {
  id: string;
  castingSessionId: string;
  stepKind: string;
  lineIndex: number;
  changeIndex: number | null;
  rawRecord: unknown;
  lineValue: LineValue | null;
  algorithmVersion: string;
  createdAt: Date;
};

export type CastResult = {
  castingSessionId: string;
  lineValues: LineValue[];
  primaryHexagramNumber: number;
  movingLinePositions: number[];
  relatingHexagramNumber: number | null;
  methodCalculation: unknown;
  resultHmac: string;
  resultHmacKeyVersion?: string;
  algorithmVersion: string;
  classicMappingVersion: string;
  createdAt: Date;
};

export type QuestionLock = {
  userId: string;
  questionFingerprint: string;
  fingerprintKeyVersion: string;
  winningCastingId: string;
  lockedUntil: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type Preview = {
  id: string;
  castingSessionId: string;
  status: PreviewStatus;
  relevanceStatement: string | null;
  schemaVersion: string;
  createdAt: Date;
  updatedAt: Date;
};

export type Reading = {
  id: string;
  castingSessionId: string;
  status: ReadingStatus;
  reservationId: string | null;
  report: Record<string, unknown> | null;
  schemaVersion: string;
  generationEpoch: number;
  createdAt: Date;
  updatedAt: Date;
};

export type Reservation = {
  id: string;
  readingId: string;
  batchId: string;
  status: ReservationStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type Order = {
  id: string;
  userId: string;
  productId: string;
  amountUsd: number;
  currency: string;
  requestId: string;
  providerCheckoutId: string | null;
  status: "pending" | "paid" | "refunded" | "disputed";
  createdAt: Date;
  updatedAt: Date;
};

export type QualityReview = {
  id: string;
  readingId: string;
  userId: string;
  status: QualityReviewStatus;
  reason: string | null;
  responseDueAt: Date;
  supplementedAt: Date | null;
  decidedAt: Date | null;
  compensationBatchId: string | null;
  createdAt: Date;
  updatedAt: Date;
};
