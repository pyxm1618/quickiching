import {
  castingRepository,
  entitlementRepository,
  historyRepository,
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

const castingSnapshotService = new CastingSnapshotService({
  castingRepository,
  readingRepository,
});
const historyService = new HistoryService({ historyRepository });

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

export async function loadCastingSnapshot(castingId: string) {
  const user = await getCurrentUser();
  const anonHash = await getAnonymousHash();
  return castingSnapshotService.load({
    castingId,
    userId: user?.id ?? null,
    anonymousSessionHash: anonHash,
    now: new Date(),
  });
}

export async function loadCastingView(castingId: string): Promise<CastingView | null> {
  const user = await getCurrentUser();
  const anonHash = await getAnonymousHash();
  const session = repo.getCastingSession(castingId);
  if (!session) return null;
  const owns = repo.ownsCasting(castingId, user?.id ?? null, anonHash);
  const canReadResult = repo.canReadRevealedResult(castingId, user?.id ?? null);
  const context = canReadResult ? repo.getLatestQuestionContext(castingId) : "";
  const cr = canReadResult ? repo.getCastResult(castingId) : undefined;
  const result = cr
    ? {
        primaryHexagramNumber: cr.primaryHexagramNumber,
        primaryName: hexagramByNumber(cr.primaryHexagramNumber).englishName,
        movingLinePositions: cr.movingLinePositions,
        relatingHexagramNumber: cr.relatingHexagramNumber,
        relatingName: cr.relatingHexagramNumber ? hexagramByNumber(cr.relatingHexagramNumber).englishName : null,
        lineValues: cr.lineValues,
        algorithmVersion: cr.algorithmVersion,
        classicMappingVersion: cr.classicMappingVersion,
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
    isAuthed: !!user,
    context,
    result,
    preview: preview ? { status: preview.status, relevanceStatement: preview.relevanceStatement } : null,
    reading: reading ? { status: reading.status, report: reading.report, id: reading.id } : null,
    steps,
    clocks,
  };
}

export type HistoryLoaderInput = HistoryFilter & {
  cursor?: string | null;
  limit?: number;
};

export async function loadHistoryPage(input: HistoryLoaderInput = {}) {
  const user = await getCurrentUser();
  if (!user) return { items: [], nextCursor: null };
  return historyService.listPage(user.id, input);
}

export async function loadHistory(filter: HistoryFilter = {}) {
  return (await loadHistoryPage({ ...filter, limit: 50 })).items;
}

export async function loadRecoverableCasts() {
  const user = await getCurrentUser();
  if (!user) return [];
  return privacyRepository.listRecoverableDeletedCasts(user.id, new Date());
}

export function parseHistoryFilter(input: Record<string, string | string[] | undefined>): HistoryLoaderInput {
  const method = typeof input.method === "string" ? input.method : undefined;
  const scene = typeof input.scene === "string" ? input.scene : undefined;
  const limitCandidate = typeof input.limit === "string" ? Number(input.limit) : undefined;
  return {
    method: ["three_coin", "yarrow_stalk", "mei_hua_current_time"].includes(method ?? "")
      ? method as CastingMethod
      : undefined,
    scene: ["career", "relationships", "wealth", "timing", "choices", "personal_growth", "other"].includes(scene ?? "")
      ? scene as Scene
      : undefined,
    hasPreview: input.hasPreview === "true" ? true : input.hasPreview === "false" ? false : undefined,
    hasReading: input.hasReading === "true" ? true : input.hasReading === "false" ? false : undefined,
    cursor: typeof input.cursor === "string" ? input.cursor : undefined,
    limit: Number.isSafeInteger(limitCandidate) ? limitCandidate : undefined,
  };
}

export async function loadEntitlementBalance(): Promise<{ available: number; expiringSoon: number }> {
  const user = await getCurrentUser();
  if (!user) return { available: 0, expiringSoon: 0 };
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
