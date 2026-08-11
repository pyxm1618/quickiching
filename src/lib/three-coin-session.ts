import { ALGORITHM_VERSIONS, type LineValue } from "@/domain/casting/types";
import type { CoinFace, ThreeCoinStep } from "@/domain/casting/three-coin/algorithm";

export const THREE_COIN_SESSION_STORAGE_KEY = "quickiching:public-v1:three-coin";

export type CompletedThreeCoinSteps = readonly [
  ThreeCoinStep,
  ThreeCoinStep,
  ThreeCoinStep,
  ThreeCoinStep,
  ThreeCoinStep,
  ThreeCoinStep,
];

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

export function completedThreeCoinSteps(steps: readonly ThreeCoinStep[]): CompletedThreeCoinSteps | null {
  if (steps.length !== 6) return null;
  if (!steps.every((entry, index) => isValidThreeCoinStep(entry, index))) return null;
  return steps as unknown as CompletedThreeCoinSteps;
}

export function readThreeCoinSteps(): ThreeCoinStep[] {
  if (typeof window === "undefined") return [];
  try {
    return parseThreeCoinSteps(window.sessionStorage.getItem(THREE_COIN_SESSION_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function writeThreeCoinSteps(steps: readonly ThreeCoinStep[]): boolean {
  if (typeof window === "undefined") return false;
  if (steps.length > 6 || !steps.every((entry, index) => isValidThreeCoinStep(entry, index))) {
    throw new Error("THREE_COIN_SESSION_INVALID_STEPS");
  }
  try {
    if (steps.length === 0) {
      window.sessionStorage.removeItem(THREE_COIN_SESSION_STORAGE_KEY);
    } else {
      window.sessionStorage.setItem(THREE_COIN_SESSION_STORAGE_KEY, JSON.stringify(steps));
    }
    return true;
  } catch {
    return false;
  }
}

export function clearThreeCoinReading(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(THREE_COIN_SESSION_STORAGE_KEY);
  } catch {
    // Browser storage can be unavailable; callers still reset their in-memory UI state.
  }
}
