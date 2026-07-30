import {
  castingRepository,
  entitlementRepository,
  privacyRepository,
  readingRepository,
  repo,
} from "@/server/repository";
import { getCurrentUser, getAnonymousHash } from "@/lib/auth/session";
import { hexagramByNumber } from "@/domain/casting/hexagrams/king-wen";
import { evaluateRisk } from "@/domain/risk/engine";
import type { CastingMethod, Scene } from "@/domain/casting/types";
import type { CastingSession } from "@/server/repository";
import { CastingSnapshotService } from "@/server/services/casting-snapshot-service";
import { HistoryService, type HistoryFilter } from "@/server/services/history-service";
import { runtimeConfig } from "@/server/config";
import { createPostgresPersistence } from "@/server/repositories/postgres";
import { PostgresCastingApplicationService } from "@/server/services/postgres-casting-service";
import { PostgresAccountApplicationService } from "@/server/services/postgres-account-service";

const castingSnapshotService = new CastingSnapshotService({ castingRepository, readingRepository });
const historyService = new HistoryService({ privacyRepository, castingRepository, readingRepository });

export type CastingView = {
  session: CastingSession;
  owns: boolean;
  isAuthed: boolean;
  context: string;
  result: {
    primaryHexagramNumber: number;
    primaryName: string;
    movingLinePositions: number[];
    relatingHexagramNumber: number | null;
    relatingName: string | null;
    lineValues: number[];
    algorithmVersion: string;
    classicMappingVersion: string;
  } | null;
  preview: { status: string; relevanceStatement: string | null } | null;
  reading: { status: string; report: Record<string, unknown> | null; id: string | null } | null;
  steps: { stepKind: string; lineIndex: number; changeIndex: number | null; lineValue: number | null }[];
  clocks: { castingExpired: boolean; revealExpired: boolean };
};

async function withProductionServices<T>(handler: (services: {
  casting: PostgresCastingApplicationService;
  account: PostgresAccountApplicationService;
}) => Promise<T>): Promise<T> {
  const config = runtimeConfig();
  if (config.mode !== "production") throw new Error("PRODUCTION_CONFIGURATION_REQUIRED");
  const persistence = createPostgresPersistence(config.credentials.databaseUrl);
  try {
    return await handler({
      casting: new PostgresCastingApplicationService({
        sql: persistence.sql,
        atomicRepository: persistence.atomicRepository,
        config,
      }),
      account: new PostgresAccountApplicationService(persistence.sql),
    });
  } finally {
    await persistence.close();
  }
}

export async function loadCastingSnapshot(castingId: string) {
  const user = await getCurrentUser();
  const anonymousSessionHash = await getAnonymousHash();
  if (runtimeConfig().mode === "production") {
    return withProductionServices(({ casting }) => casting.snapshot({
      castingId,
      userId: user?.id ?? null,
      anonymousSessionHash,
      now: new Date(),
    }));
  }
  return castingSnapshotService.load({
    castingId,
    userId: user?.id ?? null,
    anonymousSessionHash,
    now: new Date(),
  });
}

export async function loadCastingView(castingId: string): Promise<CastingView | null> {
  const user = await getCurrentUser();
  const anonymousSessionHash = await getAnonymousHash();
  if (runtimeConfig().mode === "production") {
    return withProductionServices(({ account }) => account.loadCastingView({
      castingId,
      userId: user?.id ?? null,
      anonymousSessionHash,
      now: new Date(),
    }));
  }
  const session = repo.getCastingSession(castingId);
  if (!session) return null;
  const owns = repo.ownsCasting(castingId, user?.id ?? null, anonymousSessionHash);
  const canReadResult = repo.canReadRevealedResult(castingId, user?.id ?? null);
  const context = canReadResult ? repo.getLatestQuestionContext(castingId) : "";
  const resultRecord = canReadResult ? repo.getCastResult(castingId) : undefined;
  const result = resultRecord
    ? {
        primaryHexagramNumber: resultRecord.primaryHexagramNumber,
        primaryName: hexagramByNumber(resultRecord.primaryHexagramNumber).englishName,
        movingLinePositions: resultRecord.movingLinePositions,
        relatingHexagramNumber: resultRecord.relatingHexagramNumber,
        relatingName: resultRecord.relatingHexagramNumber
          ? hexagramByNumber(resultRecord.relatingHexagramNumber).englishName
          : null,
        lineValues: resultRecord.lineValues,
        algorithmVersion: resultRecord.algorithmVersion,
        classicMappingVersion: resultRecord.classicMappingVersion,
      }
    : null;
  const preview = canReadResult ? repo.getPreview(castingId) : undefined;
  const reading = canReadResult ? repo.getReadingByCasting(castingId) : undefined;
  const steps = repo.getSteps(castingId).map((step) => ({
    stepKind: step.stepKind,
    lineIndex: step.lineIndex,
    changeIndex: step.changeIndex,
    lineValue: step.lineValue,
  }));
  const clocks = repo.evaluateSessionClocks(session, new Date());
  return {
    session,
    owns,
    isAuthed: Boolean(user),
    context,
    result,
    preview: preview ? { status: preview.status, relevanceStatement: preview.relevanceStatement } : null,
    reading: reading ? { status: reading.status, report: reading.report, id: reading.id } : null,
    steps,
    clocks,
  };
}

export async function loadHistory(filter: HistoryFilter = {}) {
  const user = await getCurrentUser();
  if (!user) return [];
  if (runtimeConfig().mode === "production") {
    return withProductionServices(({ account }) => account.history(user.id, filter));
  }
  return historyService.list(user.id, filter);
}

export async function loadRecoverableCasts() {
  const user = await getCurrentUser();
  if (!user) return [];
  if (runtimeConfig().mode === "production") {
    return withProductionServices(({ account }) => account.recoverableCasts(user.id, new Date()));
  }
  return privacyRepository.listRecoverableDeletedCasts(user.id, new Date());
}

export function parseHistoryFilter(input: Record<string, string | string[] | undefined>): HistoryFilter {
  const method = typeof input.method === "string" ? input.method : undefined;
  const scene = typeof input.scene === "string" ? input.scene : undefined;
  return {
    method: ["three_coin", "yarrow_stalk", "mei_hua_current_time"].includes(method ?? "")
      ? method as CastingMethod
      : undefined,
    scene: ["career", "relationships", "wealth", "timing", "choices", "personal_growth", "other"].includes(scene ?? "")
      ? scene as Scene
      : undefined,
    hasPreview: input.hasPreview === "true" ? true : input.hasPreview === "false" ? false : undefined,
    hasReading: input.hasReading === "true" ? true : input.hasReading === "false" ? false : undefined,
  };
}

export async function loadEntitlementBalance(): Promise<{ available: number; expiringSoon: number }> {
  const user = await getCurrentUser();
  if (!user) return { available: 0, expiringSoon: 0 };
  if (runtimeConfig().mode === "production") {
    return withProductionServices(({ account }) => account.entitlementBalance(user.id, new Date()));
  }
  const batches = entitlementRepository.getBatches(user.id);
  const now = new Date();
  let available = 0;
  let expiringSoon = 0;
  for (const batch of batches) {
    if (batch.expiresAt.getTime() > now.getTime()) {
      available += batch.quantityAvailable;
      if (batch.expiresAt.getTime() - now.getTime() < 30 * 24 * 3600 * 1000) {
        expiringSoon += batch.quantityAvailable;
      }
    }
  }
  return { available, expiringSoon };
}

export { evaluateRisk };
