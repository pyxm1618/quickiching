import type { PublicReadingMethod } from "@/domain/public-reading/types";
import { clearPublicReadingSession } from "@/lib/public-reading-session";
import { clearThreeCoinReading, THREE_COIN_SESSION_STORAGE_KEY } from "@/lib/three-coin-session";
import { clearManualCastDraft, MANUAL_CAST_DRAFT_STORAGE_KEY } from "@/lib/manual-cast-draft";

/**
 * C6 — Storage ownership: method session keys.
 *
 * A method session holds active/partial casting state only, plus the
 * exceptional sealed facts of a failed handoff. It never holds a completed
 * reading that is already durable elsewhere.
 */
export const YARROW_SESSION_STORAGE_KEY = "quickiching:public-v1:yarrow-v2";
export const MEI_HUA_SESSION_STORAGE_KEY = "quickiching:public-v1:mei-hua-number-time-v1";
export const MANUAL_SESSION_STORAGE_KEY = "quickiching:public-v1:manual-cast";

const METHOD_SESSION_KEYS: Record<PublicReadingMethod, readonly string[]> = {
  "three-coin": [THREE_COIN_SESSION_STORAGE_KEY],
  "yarrow-stalks": [YARROW_SESSION_STORAGE_KEY],
  "mei-hua-yi-shu": [MEI_HUA_SESSION_STORAGE_KEY],
  manual: [MANUAL_SESSION_STORAGE_KEY, MANUAL_CAST_DRAFT_STORAGE_KEY],
};

export function methodSessionStorageKeys(method: PublicReadingMethod): readonly string[] {
  return METHOD_SESSION_KEYS[method];
}

/**
 * Retires exactly one method's active session. Unrelated method progress is
 * never touched.
 */
export function retireMethodSession(method: PublicReadingMethod): void {
  if (method === "three-coin") {
    clearThreeCoinReading();
    return;
  }
  if (method === "manual") clearManualCastDraft();
  clearPublicReadingSession(METHOD_SESSION_KEYS[method][0]!);
}

/** Reads the raw keys directly so verification cannot be satisfied by parsing. */
export function isMethodSessionRetired(method: PublicReadingMethod): boolean {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return false;
    return METHOD_SESSION_KEYS[method].every((key) => window.sessionStorage.getItem(key) === null);
  } catch {
    return false;
  }
}
