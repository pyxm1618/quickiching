import { repo } from "@/server/repository";
import { getCurrentUser, getAnonymousHash } from "@/lib/auth/session";
import { hexagramByNumber } from "@/domain/casting/hexagrams/king-wen";
import { evaluateRisk } from "@/domain/risk/engine";
import type { CastingSession } from "@/server/repository";

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

export async function loadCastingView(castingId: string): Promise<CastingView | null> {
  const user = await getCurrentUser({ allowUnavailable: true });
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
      ? { status: reading.status, report: reading.report, id: reading.id }
      : null,
    steps,
    clocks,
  };
}

export async function loadHistory(): Promise<
  Array<{
    id: string;
    method: string;
    scene: string;
    lifecycle: string;
    riskStatus: string;
    createdAt: Date;
    primaryName: string | null;
    hasPreview: boolean;
    hasReading: boolean;
  }>
> {
  const user = await getCurrentUser();
  if (!user) return [];

  if (process.env.DATABASE_ADAPTER_MODE === "postgres" && process.env.DATABASE_URL) {
    const { getPostgresClient } = await import("@/server/db/client");
    const sql = getPostgresClient();
    const rows = await sql`
      select
        s.id, s.method, s.scene, s.lifecycle, s.risk_status, s.created_at,
        c.primary_hexagram_number,
        p.id as preview_id,
        d.casting_id as reading_id
      from casting_sessions s
      left join cast_results c on c.casting_id = s.id
      left join preview_results p on p.casting_id = s.id
      left join deep_reading_results d on d.casting_id = s.id
      where s.user_id = ${user.id} and s.deleted_at is null
      order by s.created_at desc
      limit 50
    ` as Array<Record<string, any>>;

    return rows.map((r) => {
      const hexNum = r.primary_hexagram_number != null ? Number(r.primary_hexagram_number) : null;
      return {
        id: String(r.id),
        method: String(r.method),
        scene: String(r.scene),
        lifecycle: String(r.lifecycle),
        riskStatus: String(r.risk_status),
        createdAt: new Date(r.created_at),
        primaryName: hexNum ? hexagramByNumber(hexNum).englishName : null,
        hasPreview: r.preview_id != null,
        hasReading: r.reading_id != null,
      };
    });
  }

  return repo.listCastsForUser(user.id).map((s) => {
    const cr = repo.getCastResult(s.id);
    const preview = repo.getPreview(s.id);
    const reading = repo.getReadingByCasting(s.id);
    return {
      id: s.id,
      method: s.method,
      scene: s.scene,
      lifecycle: s.lifecycle,
      riskStatus: s.riskStatus,
      createdAt: s.createdAt,
      primaryName: cr ? hexagramByNumber(cr.primaryHexagramNumber).englishName : null,
      hasPreview: !!preview && preview.status === "completed",
      hasReading: !!reading && reading.status === "completed",
    };
  });
}

export async function loadEntitlementBalance(): Promise<{ available: number; expiringSoon: number }> {
  const user = await getCurrentUser();
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
