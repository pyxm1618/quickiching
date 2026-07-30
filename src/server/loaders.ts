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
