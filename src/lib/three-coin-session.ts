import { ALGORITHM_VERSIONS, type LineValue } from "@/domain/casting/types";
import type { CoinFace, ThreeCoinStep } from "@/domain/casting/three-coin/algorithm";
import {
  clearPublicReadingSession,
  readPublicReadingSession,
  restartPublicReadingSession,
  writePublicReadingSession,
  type PublicReadingSession,
} from "@/lib/public-reading-session";

export const THREE_COIN_SESSION_STORAGE_KEY = "quickiching:public-v1:three-coin";

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
  if (Array.isArray(value)) {
    const steps = parseThreeCoinSteps(JSON.stringify(value));
    return steps.length === value.length ? { steps } : null;
  }
  if (!isRecord(value) || !Array.isArray(value.steps)) return null;
  const steps = parseThreeCoinSteps(JSON.stringify(value.steps));
  return steps.length === value.steps.length ? { steps } : null;
}

export function readThreeCoinSession(): ThreeCoinReadingSession | null {
  try {
    return readPublicReadingSession(THREE_COIN_SESSION_STORAGE_KEY, parseThreeCoinSessionData);
  } catch (error) {
    if (error instanceof Error && error.message === "PUBLIC_READING_SESSION_UNAVAILABLE") {
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

export function readThreeCoinSteps(): ThreeCoinStep[] {
  try {
    return readThreeCoinSession()?.data?.steps ?? [];
  } catch {
    throw new Error("THREE_COIN_SESSION_READ_FAILED");
  }
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
    return writePublicReadingSession(THREE_COIN_SESSION_STORAGE_KEY, { steps: [...steps] });
  } catch (error) {
    if (error instanceof Error && ["THREE_COIN_SESSION_UNAVAILABLE", "THREE_COIN_SESSION_EMPTY"].includes(error.message)) throw error;
    throw new Error("THREE_COIN_SESSION_WRITE_FAILED");
  }
}

export function clearThreeCoinReading(): void {
  try {
    clearPublicReadingSession(THREE_COIN_SESSION_STORAGE_KEY);
  } catch (error) {
    if (error instanceof Error && error.message === "PUBLIC_READING_SESSION_UNAVAILABLE") throw new Error("THREE_COIN_SESSION_UNAVAILABLE");
    throw new Error("THREE_COIN_SESSION_CLEAR_FAILED");
  }
}

export function restartThreeCoinReading(): ThreeCoinReadingSession {
  try {
    return restartPublicReadingSession(THREE_COIN_SESSION_STORAGE_KEY) as ThreeCoinReadingSession;
  } catch {
    throw new Error("THREE_COIN_SESSION_RESTART_FAILED");
  }
}
