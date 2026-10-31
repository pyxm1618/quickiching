import { repo } from "@/server/repository";
import { getCurrentUser, getAnonymousHash } from "@/lib/auth/session";
import { hexagramByNumber } from "@/domain/casting/hexagrams/king-wen";
import { evaluateRisk } from "@/domain/risk/engine";
import type { CastingSession } from "@/server/repository";
import type { DeepReadingContextSnapshot } from "@/domain/generation/deep-reading-contract";
import { decryptDeepReadingContextSnapshot } from "@/server/generation/deep-reading-snapshot";
import { calculateDeepReadingContextSnapshotHash } from "@/server/generation/integrity";

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
  reading: { status: string; report: Record<string, unknown> | null; id: string | null; snapshot: DeepReadingContextSnapshot | null } | null;
  steps: { stepKind: string; lineIndex: number; changeIndex: number | null; lineValue: number | null }[];
  clocks: { castingExpired: boolean; revealExpired: boolean };
};

export async function loadCastingView(castingId: string): Promise<CastingView | null> {
  const user = await getCurrentUser({ allowUnavailable: true });
  const anonHash = await getAnonymousHash();

  if (process.env.DATABASE_ADAPTER_MODE === "postgres" && process.env.DATABASE_URL) {
    const { getPostgresClient } = await import("@/server/db/client");
    const sql = getPostgresClient();
    const rows = await sql`
      select
        c.id, c.user_id, c.method, c.lifecycle, c.risk_status, c.scene,
        c.interpretation_goal, c.generation_epoch, c.deleted_at, c.created_at, c.updated_at,
        q.id as question_version_id, q.ciphertext as question_ciphertext,
        q.iv as question_iv, q.auth_tag as question_auth_tag,
        q.encryption_key_version as question_encryption_key_version,
        r.line_values, r.primary_hexagram_number, r.moving_line_positions,
        r.relating_hexagram_number, r.algorithm_version, r.classic_mapping_version,
        d.job_id as reading_job_id, d.output as reading_output,
        ds.ciphertext as snapshot_ciphertext, ds.iv as snapshot_iv, ds.auth_tag as snapshot_auth_tag,
        ds.encryption_key_version as snapshot_encryption_key_version, ds.snapshot_hash
      from casting_sessions c
      left join lateral (
        select * from question_versions
        where casting_id = c.id
        order by version_number desc
        limit 1
      ) q on true
      left join cast_results r on r.casting_id = c.id
      left join deep_reading_results d on d.casting_id = c.id
      left join deep_reading_context_snapshots ds on ds.casting_id = c.id
      where c.id = ${castingId} and c.deleted_at is null
      limit 1
    ` as Array<Record<string, any>>;

    const row = rows[0];
    if (!row) return null;

    const owns = user ? String(row.user_id) === user.id : false;
    if (!owns) return null;

    let context = "";
    if (row.question_version_id != null) {
      try {
        const { decryptQuestionForGeneration } = await import("@/server/generation/question-crypto");
        context = decryptQuestionForGeneration(row);
      } catch {
        context = "";
      }
    }

    const hexNum = row.primary_hexagram_number != null ? Number(row.primary_hexagram_number) : null;
    const relNum = row.relating_hexagram_number != null ? Number(row.relating_hexagram_number) : null;
    const lineVals = (row.line_values as number[]) ?? [];
    const movingLines = (row.moving_line_positions as number[]) ?? [];

    const result = hexNum != null
      ? {
          primaryHexagramNumber: hexNum,
          primaryName: hexagramByNumber(hexNum).englishName,
          movingLinePositions: movingLines,
          relatingHexagramNumber: relNum,
          relatingName: relNum ? hexagramByNumber(relNum).englishName : null,
          lineValues: lineVals,
          algorithmVersion: String(row.algorithm_version ?? "three-coin-v1"),
          classicMappingVersion: String(row.classic_mapping_version ?? "king-wen-v1"),
        }
      : null;

    let completedSnapshot: DeepReadingContextSnapshot | null = null;
    if (row.reading_output != null && row.snapshot_ciphertext != null) {
      const snapshot = decryptDeepReadingContextSnapshot(castingId, {
        ciphertext: String(row.snapshot_ciphertext),
        iv: String(row.snapshot_iv),
        authTag: String(row.snapshot_auth_tag),
        encryptionKeyVersion: String(row.snapshot_encryption_key_version),
      });
      if (calculateDeepReadingContextSnapshotHash(snapshot) !== String(row.snapshot_hash)) {
        throw new Error("DEEP_READING_SNAPSHOT_INTEGRITY_INVALID");
      }
      completedSnapshot = snapshot;
    }
    const reading = row.reading_output != null
      ? { status: "completed", report: row.reading_output, id: String(row.reading_job_id ?? ""), snapshot: completedSnapshot }
      : null;

    const session: CastingSession = {
      id: String(row.id),
      userId: row.user_id ? String(row.user_id) : null,
      anonymousSessionHash: null,
      anonymousHashKeyVersion: null,
      method: row.method,
      lifecycle: row.lifecycle,
      riskStatus: row.risk_status,
      scene: row.scene,
      interpretationGoal: row.interpretation_goal,
      currentQuestionVersionId: row.question_version_id ? String(row.question_version_id) : null,
      questionFingerprint: null,
      fingerprintKeyVersion: null,
      algorithmVersion: String(row.algorithm_version ?? "three-coin-v1"),
      firstIrreversibleStepAt: null,
      castingExpiresAt: null,
      completedAt: null,
      revealExpiresAt: null,
      revealedAt: null,
      duplicateOfCastingId: null,
      deletedAt: null,
      purgeAfter: null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };

    return {
      session,
      owns,
      isAuthed: !!user,
      context,
      result,
      preview: null,
      reading,
      steps: lineVals.map((v, i) => ({
        stepKind: "coin",
        lineIndex: i,
        changeIndex: null,
        lineValue: v,
      })),
      clocks: { castingExpired: false, revealExpired: false },
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
  const steps = repo.getSteps(castingId).map((s) => ({
    stepKind: s.stepKind,
    lineIndex: s.lineIndex,
    changeIndex: s.changeIndex,
    lineValue: s.lineValue,
  }));
  const clocks = repo.evaluateSessionClocks(session, new Date());
  return {
    session,
    owns,
    isAuthed: !!user,
    context,
    result,
    preview: preview ? { status: preview.status, relevanceStatement: preview.relevanceStatement } : null,
    reading: reading
      ? { status: reading.status, report: reading.report, id: reading.id, snapshot: null }
      : null,
    steps,
    clocks,
  };
}

export async function loadHistory(
  resolvedUser?: { id: string; email: string } | null,
  locale: "en" | "zh-Hans" = "en",
): Promise<
  Array<{
    id: string;
    method: string;
    scene: string;
    lifecycle: string;
    riskStatus: string;
    createdAt: Date;
    primaryName: string | null;
    question: string | null;
    hasPreview: boolean;
    hasReading: boolean;
  }>
> {
  const user = resolvedUser === undefined ? await getCurrentUser() : resolvedUser;
  if (!user) return [];

  if (process.env.DATABASE_ADAPTER_MODE === "postgres" && process.env.DATABASE_URL) {
    const { getPostgresClient } = await import("@/server/db/client");
    const sql = getPostgresClient();
    const rows = await sql`
      select
        s.id, s.method, s.scene, s.lifecycle, s.risk_status, s.created_at,
        c.primary_hexagram_number, c.line_values,
        q.id as question_version_id, q.ciphertext as question_ciphertext,
        q.iv as question_iv, q.auth_tag as question_auth_tag,
        q.encryption_key_version as question_encryption_key_version,
        p.casting_id as preview_id,
        d.casting_id as reading_id
      from casting_sessions s
      inner join cast_results c on c.casting_id = s.id
      left join lateral (
        select * from question_versions where casting_id = s.id
        order by version_number desc limit 1
      ) q on true
      left join preview_results p on p.casting_id = s.id
      left join deep_reading_results d on d.casting_id = s.id
      where s.user_id = ${user.id} and s.deleted_at is null
        and s.lifecycle = 'revealed'
      order by s.created_at desc
    ` as Array<Record<string, any>>;

    const { decryptQuestionForGeneration } = await import("@/server/generation/question-crypto");
    return rows.filter((r) => Array.isArray(r.line_values) && r.line_values.length === 6
      && r.line_values.every((value: unknown) => typeof value === "number" && [6, 7, 8, 9].includes(value))
      && Number.isInteger(r.primary_hexagram_number) && r.primary_hexagram_number >= 1 && r.primary_hexagram_number <= 64
    ).map((r) => {
      const hexNum = r.primary_hexagram_number != null ? Number(r.primary_hexagram_number) : null;
      return {
        id: String(r.id),
        question: r.question_version_id == null ? null : decryptQuestionForGeneration(r),
        method: String(r.method),
        scene: String(r.scene),
        lifecycle: String(r.lifecycle),
        riskStatus: String(r.risk_status),
        createdAt: new Date(r.created_at),
        primaryName: hexNum ? (locale === "zh-Hans" ? hexagramByNumber(hexNum).chineseName : hexagramByNumber(hexNum).englishName) : null,
        hasPreview: r.preview_id != null,
        hasReading: r.reading_id != null,
      };
    });
  }

  return repo.listCastsForUser(user.id).filter((s) =>
    repo.canReadRevealedResult(s.id, user.id) && !!repo.getCastResult(s.id)
  ).map((s) => {
    const cr = repo.getCastResult(s.id);
    const preview = repo.getPreview(s.id);
    const reading = repo.getReadingByCasting(s.id);
    return {
      id: s.id,
      question: repo.getLatestQuestionContext(s.id) || null,
      method: s.method,
      scene: s.scene,
      lifecycle: s.lifecycle,
      riskStatus: s.riskStatus,
      createdAt: s.createdAt,
      primaryName: cr ? (locale === "zh-Hans" ? hexagramByNumber(cr.primaryHexagramNumber).chineseName : hexagramByNumber(cr.primaryHexagramNumber).englishName) : null,
      hasPreview: !!preview && preview.status === "completed",
      hasReading: !!reading && reading.status === "completed",
    };
  });
}

export async function loadEntitlementBalance(
  resolvedUser?: { id: string; email: string } | null,
): Promise<{ available: number; expiringSoon: number }> {
  const user = resolvedUser === undefined ? await getCurrentUser() : resolvedUser;
  if (!user) return { available: 0, expiringSoon: 0 };

  if (process.env.DATABASE_ADAPTER_MODE === "postgres" && process.env.DATABASE_URL) {
    const { getPostgresClient } = await import("@/server/db/client");
    const sql = getPostgresClient();
    const rows = await sql`
      select
        coalesce(sum(quantity_available), 0)::integer as available,
        coalesce(sum(case when expires_at < clock_timestamp() + interval '30 days' then quantity_available else 0 end), 0)::integer as expiring_soon
      from entitlement_batches
      where user_id = ${user.id} and expires_at > clock_timestamp()
    ` as Array<Record<string, any>>;

    return {
      available: Number(rows[0]?.available ?? 0),
      expiringSoon: Number(rows[0]?.expiring_soon ?? 0),
    };
  }

  const batches = repo.getBatches(user.id);
  const now = new Date();
  let available = 0;
  let expiringSoon = 0;
  for (const b of batches) {
    if (b.expiresAt.getTime() > now.getTime()) {
      available += b.quantityAvailable;
      if (b.expiresAt.getTime() - now.getTime() < 30 * 24 * 3600 * 1000) expiringSoon += b.quantityAvailable;
    }
  }
  return { available, expiringSoon };
}

export { evaluateRisk };
