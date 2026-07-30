import {
  castingRepository,
  entitlementRepository,
  privacyRepository,
  readingRepository,
  repo,
} from "@/server/repository";
import { getCurrentUser, getAnonymousHash } from "@/lib/auth/session";
import { decryptJson } from "@/lib/crypto";
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
const historyService = new HistoryService({
  privacyRepository,
  castingRepository,
  readingRepository,
});
const productionMode = process.env.NODE_ENV === "production";

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

function date(value: unknown): Date | null {
  return value == null ? null : value instanceof Date ? value : new Date(String(value));
}

function postgresSession(row: Record<string, unknown>): CastingSession {
  return {
    id: String(row.id),
    userId: row.user_id == null ? null : String(row.user_id),
    anonymousSessionHash: row.anonymous_session_hash == null ? null : String(row.anonymous_session_hash),
    anonymousHashKeyVersion: row.anonymous_hash_key_version == null ? null : String(row.anonymous_hash_key_version),
    method: row.method as CastingSession["method"],
    lifecycle: row.lifecycle as CastingSession["lifecycle"],
    riskStatus: row.risk_status as CastingSession["riskStatus"],
    scene: row.scene as CastingSession["scene"],
    interpretationGoal: row.interpretation_goal as CastingSession["interpretationGoal"],
    currentQuestionVersionId: row.current_question_version_id == null ? null : String(row.current_question_version_id),
    questionFingerprint: row.question_fingerprint == null ? null : String(row.question_fingerprint),
    fingerprintKeyVersion: row.fingerprint_key_version == null ? null : String(row.fingerprint_key_version),
    algorithmVersion: String(row.algorithm_version),
    firstIrreversibleStepAt: date(row.first_irreversible_step_at),
    castingExpiresAt: date(row.casting_expires_at),
    completedAt: date(row.completed_at),
    revealExpiresAt: date(row.reveal_expires_at),
    revealedAt: date(row.revealed_at),
    duplicateOfCastingId: row.duplicate_of_casting_id == null ? null : String(row.duplicate_of_casting_id),
    deletedAt: date(row.deleted_at),
    purgeAfter: date(row.purge_after),
    createdAt: date(row.created_at)!,
    updatedAt: date(row.updated_at)!,
  };
}

export async function loadCastingSnapshot(castingId: string) {
  const user = await getCurrentUser();
  const anonHash = await getAnonymousHash();
  if (productionMode) {
    const { getProductionRuntime } = await import("@/server/runtime/production");
    const production = await getProductionRuntime();
    return production.application.loadCastingSnapshot({
      castingId,
      userId: user?.id ?? null,
      anonymousSessionHash: anonHash,
      now: new Date(),
    });
  }
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
  if (productionMode) {
    const { getProductionRuntime } = await import("@/server/runtime/production");
    const production = await getProductionRuntime();
    const snapshot = await production.application.loadCastingSnapshot({
      castingId,
      userId: user?.id ?? null,
      anonymousSessionHash: anonHash,
      now: new Date(),
    });
    if (!snapshot) return null;
    const sessionRows = await production.sql`select * from casting_sessions where id = ${castingId}`;
    const row = sessionRows[0];
    if (!row) return null;
    const session = postgresSession(row);
    const canRead = snapshot.canReadResult;
    let context = "";
    if (canRead && session.currentQuestionVersionId) {
      const questionRows = await production.sql`
        select * from question_versions where id = ${session.currentQuestionVersionId}
      `;
      const question = questionRows[0];
      if (question) {
        context = decryptJson<{ context: string }>({
          v: question.encryption_key_version,
          iv: question.iv,
          tag: question.auth_tag,
          data: question.ciphertext,
        }, "context", `${castingId}:${question.id}`).context;
      }
    }
    const steps = await production.sql`
      select step_kind, line_index, change_index, line_value
      from casting_steps where casting_session_id = ${castingId}
      order by line_index asc, change_index asc nulls first
    `;
    const now = Date.now();
    return {
      session,
      owns: true,
      isAuthed: !!user,
      context,
      result: snapshot.result ? {
        primaryHexagramNumber: snapshot.result.primaryNumber,
        primaryName: snapshot.result.primaryName,
        movingLinePositions: snapshot.result.movingLinePositions,
        relatingHexagramNumber: snapshot.result.relatingNumber,
        relatingName: snapshot.result.relatingName,
        lineValues: snapshot.result.lineValues,
        algorithmVersion: snapshot.result.algorithmVersion,
        classicMappingVersion: snapshot.result.classicMappingVersion,
      } : null,
      preview: snapshot.preview,
      reading: snapshot.reading ? {
        status: snapshot.reading.status,
        report: snapshot.reading.report,
        id: snapshot.reading.id,
      } : null,
      steps: steps.map((step) => ({
        stepKind: String(step.step_kind),
        lineIndex: Number(step.line_index),
        changeIndex: step.change_index == null ? null : Number(step.change_index),
        lineValue: step.line_value == null ? null : Number(step.line_value),
      })),
      clocks: {
        castingExpired: session.castingExpiresAt != null && session.castingExpiresAt.getTime() <= now,
        revealExpired: session.revealExpiresAt != null && session.revealExpiresAt.getTime() <= now,
      },
    };
  }

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

export async function loadHistory(filter: HistoryFilter = {}) {
  const user = await getCurrentUser();
  if (!user) return [];
  if (productionMode) {
    const { getProductionRuntime } = await import("@/server/runtime/production");
    const production = await getProductionRuntime();
    const rows = await production.sql`
      select c.id, c.method, c.scene, c.lifecycle, c.risk_status, c.created_at,
        r.primary_hexagram_number, p.status as preview_status, rd.status as reading_status
      from casting_sessions c
      left join cast_results r on r.casting_session_id = c.id
      left join previews p on p.casting_session_id = c.id
      left join readings rd on rd.casting_session_id = c.id
      where c.user_id = ${user.id} and c.deleted_at is null and c.lifecycle <> 'discarded_duplicate'
      order by c.created_at desc
    `;
    return rows.map((row) => ({
      id: String(row.id),
      method: row.method as CastingMethod,
      scene: row.scene as Scene,
      lifecycle: String(row.lifecycle),
      riskStatus: String(row.risk_status),
      createdAt: date(row.created_at)!,
      primaryName: row.primary_hexagram_number == null
        ? null
        : hexagramByNumber(Number(row.primary_hexagram_number)).englishName,
      hasPreview: row.preview_status === "completed",
      hasReading: row.reading_status === "completed",
    })).filter((item) => (
      (filter.method == null || item.method === filter.method)
      && (filter.scene == null || item.scene === filter.scene)
      && (filter.hasPreview == null || item.hasPreview === filter.hasPreview)
      && (filter.hasReading == null || item.hasReading === filter.hasReading)
    ));
  }
  return historyService.list(user.id, filter);
}

export async function loadRecoverableCasts() {
  const user = await getCurrentUser();
  if (!user) return [];
  if (productionMode) {
    const { getProductionRuntime } = await import("@/server/runtime/production");
    const production = await getProductionRuntime();
    const rows = await production.sql`
      select * from casting_sessions
      where user_id = ${user.id} and lifecycle = 'user_deleted' and purge_after > now()
      order by deleted_at desc
    `;
    return rows.map((row) => postgresSession(row));
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
  if (productionMode) {
    const { getProductionRuntime } = await import("@/server/runtime/production");
    const production = await getProductionRuntime();
    const [balance] = await production.sql`
      select
        coalesce(sum(quantity_available) filter (where expires_at > now()), 0)::integer as available,
        coalesce(sum(quantity_available) filter (
          where expires_at > now() and expires_at < now() + interval '30 days'
        ), 0)::integer as expiring_soon
      from entitlement_batches where user_id = ${user.id}
    `;
    return { available: Number(balance.available), expiringSoon: Number(balance.expiring_soon) };
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
