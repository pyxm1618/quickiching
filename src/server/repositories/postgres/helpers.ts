import { randomBytes } from "node:crypto";
import type {
  CastResult,
  CastingSession,
  CastingStep,
  LoginIntent,
  Preview,
  QualityReview,
  Reading,
  Reservation,
  User,
} from "@/server/repositories/models";
import type * as schema from "@/server/db/schema";

export function postgresId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

export function mapUser(row: typeof schema.users.$inferSelect): User {
  return { id: row.id, email: row.email, createdAt: row.createdAt };
}

export function mapCasting(row: typeof schema.castingSessions.$inferSelect): CastingSession {
  return {
    id: row.id,
    userId: row.userId,
    anonymousSessionHash: row.anonymousSessionHash,
    anonymousHashKeyVersion: row.anonymousHashKeyVersion,
    method: row.method as CastingSession["method"],
    lifecycle: row.lifecycle,
    riskStatus: row.riskStatus,
    scene: row.scene as CastingSession["scene"],
    interpretationGoal: row.interpretationGoal as CastingSession["interpretationGoal"],
    currentQuestionVersionId: row.currentQuestionVersionId,
    questionFingerprint: row.questionFingerprint,
    fingerprintKeyVersion: row.fingerprintKeyVersion,
    algorithmVersion: row.algorithmVersion,
    firstIrreversibleStepAt: row.firstIrreversibleStepAt,
    castingExpiresAt: row.castingExpiresAt,
    completedAt: row.completedAt,
    revealExpiresAt: row.revealExpiresAt,
    revealedAt: row.revealedAt,
    duplicateOfCastingId: row.duplicateOfCastingId,
    deletedAt: row.deletedAt,
    purgeAfter: row.purgeAfter,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapStep(row: typeof schema.castingSteps.$inferSelect): CastingStep {
  return {
    id: row.id,
    castingSessionId: row.castingId,
    stepKind: row.stepKind,
    lineIndex: row.lineIndex,
    changeIndex: row.changeIndex,
    rawRecord: row.rawRecord,
    lineValue: row.lineValue as CastingStep["lineValue"],
    algorithmVersion: row.algorithmVersion,
    createdAt: row.createdAt,
  };
}

export function mapResult(row: typeof schema.castResults.$inferSelect): CastResult {
  return {
    castingSessionId: row.castingId,
    lineValues: row.lineValues as CastResult["lineValues"],
    primaryHexagramNumber: row.primaryHexagramNumber,
    movingLinePositions: row.movingLinePositions,
    relatingHexagramNumber: row.relatingHexagramNumber,
    methodCalculation: row.methodCalculation,
    resultHmac: row.resultHmac,
    algorithmVersion: row.algorithmVersion,
    classicMappingVersion: row.classicMappingVersion,
    createdAt: row.createdAt,
  };
}

export function mapIntent(row: typeof schema.loginIntents.$inferSelect): LoginIntent {
  return {
    id: row.id,
    castingSessionId: row.castingId,
    anonymousSessionHash: row.anonymousSessionHash,
    nonceHash: row.nonceHash,
    nonceKeyVersion: row.nonceKeyVersion,
    allowedCallbackPath: row.allowedCallbackPath,
    expiresAt: row.expiresAt,
    consumedAt: row.consumedAt,
    createdAt: row.createdAt,
  };
}

export function mapPreview(row: typeof schema.previews.$inferSelect): Preview {
  return {
    id: row.id,
    castingSessionId: row.castingId,
    status: row.status,
    relevanceStatement: row.relevanceStatement,
    schemaVersion: row.schemaVersion,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapReading(row: typeof schema.readings.$inferSelect): Reading {
  return {
    id: row.id,
    castingSessionId: row.castingId,
    status: row.status,
    reservationId: row.activeReservationId,
    report: row.report,
    schemaVersion: row.schemaVersion,
    generationEpoch: row.generationEpoch,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapReservation(row: typeof schema.reservations.$inferSelect): Reservation {
  return {
    id: row.id,
    readingId: row.readingId,
    batchId: row.batchId,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapReview(row: typeof schema.qualityReviews.$inferSelect): QualityReview {
  return {
    id: row.id,
    readingId: row.readingId,
    userId: row.userId,
    status: row.status,
    reason: row.reason,
    responseDueAt: row.responseDueAt,
    supplementedAt: row.supplementedAt,
    decidedAt: row.decidedAt,
    compensationBatchId: row.compensationBatchId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function databaseErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const value = error as { code?: unknown };
  return typeof value.code === "string" ? value.code : undefined;
}
