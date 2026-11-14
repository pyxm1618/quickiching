import { meiHuaFromNumberAndTime } from "@/domain/casting/mei-hua/number-time";
import type { YarrowChange, YarrowLineResult } from "@/domain/casting/yarrow/algorithm";
import type { LineValue } from "@/domain/casting/types";
import { buildPublicReading } from "@/domain/public-reading/reading";
import type {
  PublicReading,
  PublicReadingEvidence,
  PublicReadingMethod,
} from "@/domain/public-reading/types";

/**
 * C3 — Reading Identity.
 *
 * `/readings/choice?session=A`, `/readings/result?session=A` and
 * `/readings/deep?session=A` may only ever resolve A:
 *
 *   exact server A → exact Pending A → EMPTY (fail closed)
 *
 * A missing session is never "the latest reading". Storage may contain B; that
 * must not change what A resolves to. Wrong Reading is worse than Empty State.
 */

export const READING_IDENTITY_MISSING_SESSION = "READING_IDENTITY_MISSING_SESSION";

export type ReadingIdentityResolution =
  | { kind: "ready"; reading: PublicReading; source: "server" | "pending" }
  | { kind: "empty"; reason: "missing-session" | "not-found" };

export function normalizeReadingSessionId(value: string | null | undefined): string | undefined {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || undefined;
}

export function resolveReadingIdentity(input: {
  sessionId?: string | null;
  serverReading?: PublicReading | null;
  readPending: (readingId: string) => PublicReading | null;
}): ReadingIdentityResolution {
  const sessionId = normalizeReadingSessionId(input.sessionId);
  // Fail closed before any storage read.
  if (!sessionId) return { kind: "empty", reason: "missing-session" };

  const server = input.serverReading;
  if (server && server.id === sessionId) return { kind: "ready", reading: server, source: "server" };

  let pending: PublicReading | null = null;
  try {
    pending = input.readPending(sessionId);
  } catch {
    pending = null;
  }
  if (pending && pending.id === sessionId) return { kind: "ready", reading: pending, source: "pending" };

  return { kind: "empty", reason: "not-found" };
}

export type ServerCastFacts = {
  castingId: string;
  createdAt: string;
  method: PublicReadingMethod;
  methodVersion?: string;
  question?: string;
  lineValuesBottomUp: readonly number[];
  methodCalculation: unknown;
  internalMethod?: "three_coin" | "yarrow_stalk" | "mei_hua_number_time" | "manual";
};

export function publicReadingFromServerCast(facts: ServerCastFacts): PublicReading {
  return buildPublicReading({
    id: facts.castingId,
    createdAt: facts.createdAt,
    method: facts.method,
    methodVersion: facts.methodVersion,
    question: facts.question,
    lineValuesBottomUp: facts.lineValuesBottomUp,
    evidence: serverBackedReadingEvidence(
      facts.method,
      facts.lineValuesBottomUp,
      facts.methodCalculation,
      facts.internalMethod,
    ),
  });
}

/**
 * Reconstructs the exact evidence the server persisted. Never invents cast
 * facts: an unavailable or inconsistent evidence payload throws.
 */
export function serverBackedReadingEvidence(
  method: PublicReadingMethod,
  lineValues: readonly number[],
  methodCalculation: unknown,
  internalMethod?: "three_coin" | "yarrow_stalk" | "mei_hua_number_time" | "manual",
): PublicReadingEvidence {
  if (method === "three-coin") return { kind: "three-coin", steps: [] };

  if (method === "yarrow-stalks") {
    const record = methodCalculation && typeof methodCalculation === "object"
      ? methodCalculation as Record<string, unknown>
      : null;
    const changes = record && Array.isArray(record.changes) ? record.changes as YarrowChange[] : null;
    if (!changes || changes.length !== 18) throw new Error("YARROW_READING_EVIDENCE_UNAVAILABLE");
    const lines: YarrowLineResult[] = Array.from({ length: 6 }, (_, rawIndex) => {
      const lineIndex = rawIndex as 0 | 1 | 2 | 3 | 4 | 5;
      const lineChanges = changes.filter((change) => change.lineIndex === lineIndex);
      const lineValue = lineValues[lineIndex] as LineValue;
      if (lineChanges.length !== 3 || ![6, 7, 8, 9].includes(lineValue)) {
        throw new Error("YARROW_READING_EVIDENCE_INVALID");
      }
      return {
        lineIndex,
        lineValue,
        changes: lineChanges,
        algorithmVersion: lineChanges[0]?.algorithmVersion ?? "yarrow-zhu-xi-digital-v2",
      };
    });
    return { kind: "yarrow-stalks", lines };
  }

  if (method === "mei-hua-yi-shu") {
    const record = methodCalculation && typeof methodCalculation === "object"
      ? methodCalculation as Record<string, unknown>
      : null;
    const utcMillis = record?.utcMillis;
    const ianaTimeZone = record?.ianaTimeZone;
    if (typeof utcMillis !== "number" || !Number.isFinite(utcMillis) || typeof ianaTimeZone !== "string") {
      throw new Error("MEI_HUA_READING_EVIDENCE_UNAVAILABLE");
    }
    const calculation = meiHuaFromNumberAndTime({ number: Number(record?.number), utcMillis, ianaTimeZone });
    if (calculation.lineValuesBottomUp.some((value, index) => value !== lineValues[index])) {
      throw new Error("MEI_HUA_READING_EVIDENCE_INVALID");
    }
    return { kind: "mei-hua-yi-shu", calculation };
  }

  if (method === "manual") {
    const record = methodCalculation && typeof methodCalculation === "object"
      ? methodCalculation as Record<string, unknown>
      : null;
    if (record?.mode === "line-values") return { kind: "manual", mode: "line-values" };
    if (record?.mode === "primary-changing"
      && Number.isInteger(record.primaryHexagramNumber)
      && Array.isArray(record.changingLines)
      && record.changingLines.every((line) => Number.isInteger(line) && Number(line) >= 1 && Number(line) <= 6)
      && new Set(record.changingLines).size === record.changingLines.length) {
      return {
        kind: "manual",
        mode: "primary-changing",
        primaryHexagramNumber: Number(record.primaryHexagramNumber),
        changingLines: record.changingLines.map(Number).sort((left, right) => left - right),
      };
    }
    throw new Error("MANUAL_READING_EVIDENCE_UNAVAILABLE");
  }

  throw new Error("READING_METHOD_EVIDENCE_UNAVAILABLE");
}

export function publicReadingMethodFromInternal(
  method: "three_coin" | "yarrow_stalk" | "mei_hua_number_time" | "manual" | undefined,
): PublicReadingMethod {
  return method === "yarrow_stalk"
    ? "yarrow-stalks"
    : method === "mei_hua_number_time"
      ? "mei-hua-yi-shu"
      : method === "manual"
        ? "manual"
        : "three-coin";
}
