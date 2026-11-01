import { ALGORITHM_VERSIONS, type LineValue } from "@/domain/casting/types";
import type { CoinFace, ThreeCoinStep } from "@/domain/casting/three-coin/algorithm";
import {
  clearPublicReadingSession,
  patchPublicReadingSession,
  readPublicReadingSession,
  readPublicReadingSessionState,
  writePublicReadingSession,
  type PublicReadingSession,
} from "@/lib/public-reading-session";

export const THREE_COIN_SESSION_STORAGE_KEY = "quickiching:public-v1:three-coin";
const STRICT_THREE_COIN_SESSION = { allowLegacyEnvelope: false } as const;

export type CompletedThreeCoinSteps = readonly [
  ThreeCoinStep,
  ThreeCoinStep,
  ThreeCoinStep,
  ThreeCoinStep,
  ThreeCoinStep,
  ThreeCoinStep,
];

export type ThreeCoinSessionData = { steps: ThreeCoinStep[] };
export type ThreeCoinReadingSession = PublicReadingSession<ThreeCoinSessionData>;

const LINE_VALUES = new Set<LineValue>([6, 7, 8, 9]);
const COIN_FACES = new Set<CoinFace>(["yin", "yang"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function coinFaceValue(face: CoinFace): number {
  return face === "yang" ? 3 : 2;
}

function isValidThreeCoinStep(value: unknown, expectedIndex: number): value is ThreeCoinStep {
  if (!isRecord(value)) return false;
  if (value.lineIndex !== expectedIndex) return false;
  if (!LINE_VALUES.has(value.lineValue as LineValue)) return false;
  if (value.algorithmVersion !== ALGORITHM_VERSIONS.three_coin) return false;
  if (!Array.isArray(value.coinFaces) || value.coinFaces.length !== 3) return false;
  if (!value.coinFaces.every((face) => COIN_FACES.has(face as CoinFace))) return false;

  const lineValue = value.coinFaces
    .map((face) => face as CoinFace)
    .reduce((sum, face) => sum + coinFaceValue(face), 0);
  return lineValue === value.lineValue;
}

export function parseThreeCoinSteps(raw: string | null): ThreeCoinStep[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length > 6) return [];
    return parsed.every((entry, index) => isValidThreeCoinStep(entry, index))
      ? parsed as ThreeCoinStep[]
      : [];
  } catch {
    return [];
  }
}

function parseThreeCoinSessionData(value: unknown): ThreeCoinSessionData | null {
  if (!isRecord(value) || !Array.isArray(value.steps)) return null;
  const steps = parseThreeCoinSteps(JSON.stringify(value.steps));
  return steps.length === value.steps.length ? { steps } : null;
}


function parseCompletedThreeCoinBackup(raw: string | null): ThreeCoinReadingSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!isRecord(value)
      || value.schemaVersion !== 1
      || typeof value.id !== "string"
      || value.id.trim().length === 0
      || typeof value.createdAt !== "string"
      || Number.isNaN(Date.parse(value.createdAt))
      || value.coreQuestionFrozenAtCast !== true
      || !("data" in value)) {
      return null;
    }
    const data = parseThreeCoinSessionData(value.data);
    if (!data || data.steps.length !== 6) return null;
    return {
      schemaVersion: 1,
      id: value.id,
      createdAt: value.createdAt,
      started: value.started === true,
      ...(typeof value.question === "string" && value.question ? { question: value.question } : {}),
      ...(typeof value.coreQuestionAtCast === "string" && value.coreQuestionAtCast
        ? { coreQuestionAtCast: value.coreQuestionAtCast }
        : {}),
      coreQuestionFrozenAtCast: true,
      data,
    };
  } catch {
    return null;
  }
}

export const THREE_COIN_BACKUP_STORAGE_KEY = "quickiching:public-v1:three-coin-completed-backup";

function safeLocalStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readThreeCoinSession(): ThreeCoinReadingSession | null {
  try {
    const session = readPublicReadingSession(THREE_COIN_SESSION_STORAGE_KEY, parseThreeCoinSessionData, STRICT_THREE_COIN_SESSION);
    if (session) return session;

    const backup = parseCompletedThreeCoinBackup(
      safeLocalStorage()?.getItem(THREE_COIN_BACKUP_STORAGE_KEY) ?? null,
    );
    if (!backup) return null;

    // This is the same formal session envelope, not a second session model.
    // Preserve identity across auth/cross-tab return instead of minting a new cast id.
    window.sessionStorage.setItem(THREE_COIN_SESSION_STORAGE_KEY, JSON.stringify(backup));
    return backup;
  } catch (error) {
    if (error instanceof Error && ["PUBLIC_READING_SESSION_UNAVAILABLE", "PUBLIC_READING_SESSION_READ_FAILED"].includes(error.message)) {
      throw new Error("THREE_COIN_SESSION_UNAVAILABLE");
    }
    throw new Error("THREE_COIN_SESSION_READ_FAILED");
  }
}

export function completedThreeCoinSteps(steps: readonly ThreeCoinStep[]): CompletedThreeCoinSteps | null {
  if (steps.length !== 6) return null;
  if (!steps.every((entry, index) => isValidThreeCoinStep(entry, index))) return null;
  return steps as unknown as CompletedThreeCoinSteps;
}

export function writeThreeCoinSteps(steps: readonly ThreeCoinStep[]): ThreeCoinReadingSession {
  if (steps.length > 6 || !steps.every((entry, index) => isValidThreeCoinStep(entry, index))) {
    throw new Error("THREE_COIN_SESSION_INVALID_STEPS");
  }

  try {
    if (steps.length === 0) {
      clearThreeCoinReading();
      throw new Error("THREE_COIN_SESSION_EMPTY");
    }
    const session = writePublicReadingSession(THREE_COIN_SESSION_STORAGE_KEY, { steps: [...steps] }, STRICT_THREE_COIN_SESSION);
    if (steps.length === 6) {
      try {
        safeLocalStorage()?.setItem(THREE_COIN_BACKUP_STORAGE_KEY, JSON.stringify(session));
      } catch {
        // ignore
      }
    }
    return session;
  } catch (error) {
    if (error instanceof Error && ["THREE_COIN_SESSION_UNAVAILABLE", "THREE_COIN_SESSION_EMPTY"].includes(error.message)) throw error;
    throw new Error("THREE_COIN_SESSION_WRITE_FAILED");
  }
}

export function clearThreeCoinReading(): void {
  try {
    clearPublicReadingSession(THREE_COIN_SESSION_STORAGE_KEY);
    try {
      safeLocalStorage()?.removeItem(THREE_COIN_BACKUP_STORAGE_KEY);
    } catch {
      // ignore
    }
  } catch (error) {
    if (error instanceof Error && error.message === "PUBLIC_READING_SESSION_UNAVAILABLE") throw new Error("THREE_COIN_SESSION_UNAVAILABLE");
    throw new Error("THREE_COIN_SESSION_CLEAR_FAILED");
  }
}


export function readThreeCoinQuestionState(): {
  started: boolean;
  question?: string;
  coreQuestionAtCast?: string;
  coreQuestionFrozenAtCast: boolean;
} {
  return readPublicReadingSessionState(
    THREE_COIN_SESSION_STORAGE_KEY,
    [],
    STRICT_THREE_COIN_SESSION,
  );
}

export function patchThreeCoinQuestionSession(patch: {
  started: boolean;
  question?: string;
  coreQuestionAtCast?: string | null;
  coreQuestionFrozenAtCast?: boolean;
}): boolean {
  return patchPublicReadingSession(
    THREE_COIN_SESSION_STORAGE_KEY,
    patch,
    [],
    STRICT_THREE_COIN_SESSION,
  );
}
