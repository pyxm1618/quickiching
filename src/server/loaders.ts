import { repo } from "@/server/repository";
import { getCurrentUser, getAnonymousHash } from "@/lib/auth/session";
import { isAuthCapabilityEnabled } from "@/server/auth/capability";
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
  // Public V1 remains readable if the optional commercial Auth adapter is
  // unavailable; protected loaders keep the strict default below.
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

export type AccountHistoryEntry = {
  id: string;
  method: string;
  scene: string;
  createdAt: Date;
  primaryName: string | null;
  hasPreview: boolean;
  hasReading: boolean;
};

export type AccountOverviewView = {
  credits: { available: number; expiringSoon: number };
  history: AccountHistoryEntry[];
};

export class AccountDataUnavailableError extends Error {
  readonly code = "ACCOUNT_DATA_UNAVAILABLE";

  constructor() {
    super("ACCOUNT_DATA_UNAVAILABLE");
    this.name = "AccountDataUnavailableError";
  }
}

// Credits and history are financial and privacy state. There is deliberately no
// fallback store here: a signed-in account page must either show what the
// database holds or say it cannot be read. Silently rendering an empty balance
// from another source would tell a paying user they own nothing.
export async function loadAccountOverview(): Promise<AccountOverviewView> {
  if (!isAuthCapabilityEnabled()) throw new AccountDataUnavailableError();

  const user = await getCurrentUser();
  if (!user) return { credits: { available: 0, expiringSoon: 0 }, history: [] };

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new AccountDataUnavailableError();

  try {
    const { getCommercialDatabaseConnection } = await import("@/server/db/client");
    const { createPostgresAccountRepository } = await import("@/server/account/postgres-repository");
    const { client } = getCommercialDatabaseConnection(databaseUrl);
    const overview = await createPostgresAccountRepository({ sql: client }).getAccountOverview(user.id);

    return {
      credits: overview.credits,
      history: overview.history.map((entry) => ({
        id: entry.id,
        method: entry.method,
        scene: entry.scene,
        createdAt: entry.createdAt,
        primaryName: entry.primaryHexagramNumber
          ? hexagramByNumber(entry.primaryHexagramNumber).englishName
          : null,
        hasPreview: entry.hasPreview,
        hasReading: entry.hasReading,
      })),
    };
  } catch {
    throw new AccountDataUnavailableError();
  }
}

export { evaluateRisk };
