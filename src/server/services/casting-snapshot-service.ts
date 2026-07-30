import { hexagramByNumber } from "@/domain/casting/hexagrams/king-wen";
import type { CastingMethod, RiskStatus } from "@/domain/casting/types";
import type { CastingRepository } from "@/server/repositories/casting-repository";
import type { ReadingRepository } from "@/server/repositories/reading-repository";

export type CastingSnapshotPhase = "input" | "ritual" | "reveal" | "result" | "crisis" | "expired";

export type CastingSnapshot = {
  castingId: string;
  method: CastingMethod;
  scene: string;
  interpretationGoal: string;
  lifecycle: string;
  riskStatus: RiskStatus;
  phase: CastingSnapshotPhase;
  progress: { completedSteps: number; totalSteps: number };
  canReadResult: boolean;
  result: {
    primaryName: string;
    primaryNumber: number;
    movingLinePositions: number[];
    relatingName: string | null;
    relatingNumber: number | null;
    lineValues: number[];
    algorithmVersion: string;
    classicMappingVersion: string;
  } | null;
  preview: { status: string; relevanceStatement: string | null } | null;
  reading: { id: string; status: string; report: Record<string, unknown> | null } | null;
};

export class CastingSnapshotService {
  constructor(private readonly dependencies: {
    castingRepository: CastingRepository;
    readingRepository: ReadingRepository;
  }) {}

  load(input: {
    castingId: string;
    userId: string | null;
    anonymousSessionHash: string | null;
    now: Date;
  }): CastingSnapshot | null {
    const { castingRepository, readingRepository } = this.dependencies;
    const session = castingRepository.getCastingSession(input.castingId);
    if (!session) return null;
    if (!castingRepository.ownsCasting(
      input.castingId,
      input.userId,
      input.anonymousSessionHash,
    )) return null;

    const steps = castingRepository.getSteps(input.castingId);
    const totalSteps = session.method === "three_coin" ? 6 : session.method === "yarrow_stalk" ? 18 : 1;
    const completedSteps = session.method === "mei_hua_current_time"
      ? Math.min(steps.filter((step) => step.stepKind === "mei_hua").length, 1)
      : session.method === "three_coin"
        ? steps.filter((step) => step.stepKind === "coin").length
        : steps.filter((step) => step.stepKind === "yarrow_change").length;
    const clocks = castingRepository.evaluateSessionClocks(session, input.now);
    const canReadResult = castingRepository.canReadRevealedResult(input.castingId, input.userId);
    const resultRecord = canReadResult ? castingRepository.getCastResult(input.castingId) : undefined;
    const previewRecord = canReadResult ? readingRepository.getPreview(input.castingId) : undefined;
    const readingRecord = canReadResult ? readingRepository.getReadingByCasting(input.castingId) : undefined;

    return {
      castingId: session.id,
      method: session.method,
      scene: session.scene,
      interpretationGoal: session.interpretationGoal,
      lifecycle: session.lifecycle,
      riskStatus: session.riskStatus,
      phase: this.phase(session.lifecycle, session.riskStatus, completedSteps, totalSteps, clocks),
      progress: { completedSteps, totalSteps },
      canReadResult,
      result: resultRecord ? {
        primaryName: hexagramByNumber(resultRecord.primaryHexagramNumber).englishName,
        primaryNumber: resultRecord.primaryHexagramNumber,
        movingLinePositions: [...resultRecord.movingLinePositions],
        relatingName: resultRecord.relatingHexagramNumber == null
          ? null
          : hexagramByNumber(resultRecord.relatingHexagramNumber).englishName,
        relatingNumber: resultRecord.relatingHexagramNumber,
        lineValues: [...resultRecord.lineValues],
        algorithmVersion: resultRecord.algorithmVersion,
        classicMappingVersion: resultRecord.classicMappingVersion,
      } : null,
      preview: previewRecord ? {
        status: previewRecord.status,
        relevanceStatement: previewRecord.relevanceStatement,
      } : null,
      reading: readingRecord ? {
        id: readingRecord.id,
        status: readingRecord.status,
        report: readingRecord.report,
      } : null,
    };
  }

  private phase(
    lifecycle: string,
    riskStatus: RiskStatus,
    completedSteps: number,
    totalSteps: number,
    clocks: { castingExpired: boolean; revealExpired: boolean },
  ): CastingSnapshotPhase {
    if (riskStatus === "emergency_blocked" || lifecycle === "emergency_blocked") return "crisis";
    if (clocks.castingExpired || clocks.revealExpired || lifecycle === "expired") return "expired";
    if (lifecycle === "revealed") return "result";
    if (lifecycle === "awaiting_reveal" || completedSteps >= totalSteps) return "reveal";
    if (lifecycle === "draft" && completedSteps === 0) return "ritual";
    return "ritual";
  }
}
