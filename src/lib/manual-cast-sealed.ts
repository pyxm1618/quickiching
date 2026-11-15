import { buildPublicReading } from "@/domain/public-reading/reading";
import { manualFromLineValues } from "@/domain/public-reading/manual";
import type {
  PublicLineTuple,
  PublicReading,
  PublicReadingEvidence,
} from "@/domain/public-reading/types";
import { MANUAL_SESSION_STORAGE_KEY } from "@/lib/method-session-retirement";
import { readPublicReadingSession } from "@/lib/public-reading-session";
import type { ManualMode } from "@/lib/manual-cast-draft";

/**
 * Manual sealed completed facts — the authoritative Manual method session.
 *
 * A fresh Manual completion keeps these immutable facts in the Manual method
 * session when handoff fails (C2 sealed recovery). Reload reconstruction must
 * rebuild the exact completed reading from them, including the frozen core
 * question, so Retry Handoff never mints a different reading or loses the
 * question that was bound at cast time.
 */
export type ManualSealedFacts = {
  id: string;
  createdAt: string;
  question?: string;
  coreQuestionAtCast?: string;
  mode: ManualMode;
  lineValuesBottomUp: PublicLineTuple;
  evidence: PublicReadingEvidence;
};

type ManualSessionData = Omit<ManualSealedFacts, "id" | "createdAt" | "question" | "coreQuestionAtCast">;

function readManualEvidence(value: unknown, mode: ManualMode): Extract<PublicReadingEvidence, { kind: "manual" }> | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { kind?: unknown; mode?: unknown; primaryHexagramNumber?: unknown; changingLines?: unknown };
  if (candidate.kind !== "manual" || candidate.mode !== mode) return null;
  if (mode === "line-values") return { kind: "manual", mode };
  if (!Number.isInteger(candidate.primaryHexagramNumber) || Number(candidate.primaryHexagramNumber) < 1 || Number(candidate.primaryHexagramNumber) > 64) return null;
  if (!Array.isArray(candidate.changingLines) || candidate.changingLines.some((line) => !Number.isInteger(line) || Number(line) < 1 || Number(line) > 6) || new Set(candidate.changingLines).size !== candidate.changingLines.length) return null;
  const changingLines = candidate.changingLines.map((line) => Number(line)).sort((left, right) => left - right);
  return { kind: "manual", mode, primaryHexagramNumber: Number(candidate.primaryHexagramNumber), changingLines };
}

function parseManualData(value: unknown): ManualSessionData | null {
  try {
    if (!value || typeof value !== "object") return null;
    const parsed = value as Partial<ManualSealedFacts>;
    if ((parsed.mode !== "line-values" && parsed.mode !== "primary-changing") || !Array.isArray(parsed.lineValuesBottomUp) || parsed.lineValuesBottomUp.length !== 6) return null;
    const values = manualFromLineValues(parsed.lineValuesBottomUp);
    const evidence = readManualEvidence(parsed.evidence, parsed.mode);
    if (!evidence) return null;
    return { mode: parsed.mode, lineValuesBottomUp: values, evidence };
  } catch {
    return null;
  }
}

/** Reads the exact sealed Manual facts, including the frozen core question. */
export function readManualSealedFacts(): ManualSealedFacts | null {
  try {
    const session = readPublicReadingSession(MANUAL_SESSION_STORAGE_KEY, parseManualData);
    if (!session?.data) return null;
    return {
      id: session.id,
      createdAt: session.createdAt,
      ...(session.question ? { question: session.question } : {}),
      ...(session.coreQuestionAtCast ? { coreQuestionAtCast: session.coreQuestionAtCast } : {}),
      ...session.data,
    };
  } catch {
    return null;
  }
}

/**
 * Reload reconstruction of the sealed completed reading.
 *
 * The frozen core question stored with the cast wins over the live question,
 * so a Retry Handoff rebuilds the exact same completed reading.
 */
export function manualReadingFromSealedFacts(
  facts: ManualSealedFacts,
  fallbackQuestion?: string,
): PublicReading | null {
  try {
    return buildPublicReading({
      id: facts.id,
      createdAt: facts.createdAt,
      method: "manual",
      question: facts.coreQuestionAtCast ?? facts.question ?? fallbackQuestion,
      lineValuesBottomUp: facts.lineValuesBottomUp,
      evidence: facts.evidence,
    });
  } catch {
    return null;
  }
}
