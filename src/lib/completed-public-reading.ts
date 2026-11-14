import { manualFromPrimaryAndChangingLines, normalizeManualChangingLines } from "@/domain/public-reading/manual";
import {
  PUBLIC_METHOD_VERSIONS,
  type PublicReading,
  type PublicReadingMethod,
} from "@/domain/public-reading/types";
import { removePendingCompletedReading } from "@/lib/pending-completed-reading";
import { retireMethodSession } from "@/lib/method-session-retirement";

/**
 * Shared completed-reading helpers.
 *
 * The completed-reading singleton (`quickiching:public-v1:completed-reading`) is
 * retired. Completed handoff is owned by the exact-id Pending store
 * (`pending-completed-reading.ts`) and by the single Reading Handoff owner
 * (`reading-handoff.ts`). This module only owns the canonical Choice path, the
 * server save projection, and the New Reading reset.
 */

export function completedPublicReadingPath(id: string, zh = false): string {
  return `${zh ? "/zh" : ""}/readings/choice?session=${encodeURIComponent(id)}`;
}

export function publicReadingSaveInput(reading: PublicReading) {
  const method = reading.method === "three-coin"
    ? "three_coin"
    : reading.method === "yarrow-stalks"
      ? "yarrow_stalk"
      : reading.method === "mei-hua-yi-shu"
        ? "mei_hua_number_time"
        : reading.method === "manual"
          ? "manual"
          : null;
  if (!method) throw new Error("UNSUPPORTED_READING_METHOD");
  if (reading.methodVersion !== PUBLIC_METHOD_VERSIONS[reading.method]) {
    throw new Error("UNSUPPORTED_READING_METHOD_VERSION");
  }

  let methodCalculation: Record<string, unknown> | undefined;
  if (reading.evidence.kind === "yarrow-stalks") {
    if (!Array.isArray(reading.evidence.lines) || reading.evidence.lines.length !== 6) throw new Error("INVALID_YARROW_EVIDENCE");
    methodCalculation = { changes: reading.evidence.lines.flatMap((line) => line.changes) };
  } else if (reading.evidence.kind === "mei-hua-yi-shu") {
    const source = reading.evidence.calculation.methodCalculation;
    if (!Number.isSafeInteger(source.number) || Number(source.number) <= 0
      || !Number.isSafeInteger(source.utcMillis) || typeof source.ianaTimeZone !== "string") throw new Error("INVALID_MEI_HUA_EVIDENCE");
    methodCalculation = { number: Number(source.number), utcMillis: Number(source.utcMillis), ianaTimeZone: source.ianaTimeZone };
  } else if (reading.evidence.kind === "manual") {
    if (reading.evidence.mode === "line-values") {
      methodCalculation = { mode: "line-values" };
    } else {
      const primaryHexagramNumber = reading.evidence.primaryHexagramNumber;
      const changingLines = normalizeManualChangingLines(reading.evidence.changingLines ?? []);
      if (!Number.isInteger(primaryHexagramNumber) || primaryHexagramNumber! < 1 || primaryHexagramNumber! > 64) {
        throw new Error("INVALID_MANUAL_EVIDENCE");
      }
      const expected = manualFromPrimaryAndChangingLines(primaryHexagramNumber!, changingLines);
      if (!expected.every((value, index) => value === reading.lineValuesBottomUp[index])) {
        throw new Error("INVALID_MANUAL_EVIDENCE");
      }
      methodCalculation = { mode: "primary-changing", primaryHexagramNumber, changingLines };
    }
  } else if (method !== "three_coin") {
    throw new Error("READING_METHOD_EVIDENCE_REQUIRED");
  }

  return {
    clientCastingId: reading.id,
    method,
    algorithmVersion: reading.methodVersion,
    lineValuesBottomUp: reading.lineValuesBottomUp,
    question: reading.question,
    ...(methodCalculation ? { methodCalculation } : {}),
  };
}

const METHOD_ENTRY_PATHS: Record<PublicReadingMethod, string> = {
  // C8: Three Coin New Reading returns to the canonical Root entry.
  "three-coin": "/",
  "yarrow-stalks": "/methods/yarrow-stalks",
  "mei-hua-yi-shu": "/methods/mei-hua-yi-shu",
  manual: "/methods/manual-cast",
};

/**
 * New Reading: retires only the exact method session and the exact pending
 * record, then returns the localized canonical entry. Unrelated partial
 * progress is preserved.
 */
export function clearCompletedReadingForRestart(
  method: PublicReadingMethod,
  zh = false,
  readingId?: string | null,
): string {
  const entry = METHOD_ENTRY_PATHS[method];
  if (readingId) removePendingCompletedReading(readingId);
  retireMethodSession(method);
  if (zh) return entry === "/" ? "/zh" : `/zh${entry}`;
  return entry;
}
