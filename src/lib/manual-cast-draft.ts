import type { PublicLineTuple } from "@/domain/public-reading/types";
import { manualFromLineValues, manualFromPrimaryAndChangingLines, normalizeManualChangingLines } from "@/domain/public-reading/manual";

/**
 * C6 — Manual Cast draft ownership.
 *
 * The draft is active/partial casting state only. It is never a completed
 * reading and it is never a second session model: the sealed Manual facts stay
 * in the Manual method session, owned by the Reading Handoff boundary.
 */
export const MANUAL_CAST_DRAFT_STORAGE_KEY = "quickiching:public-v1:manual-cast:draft:v1";

export type ManualMode = "line-values" | "primary-changing";

export type ManualCastDraft = {
  schemaVersion: 1;
  questionKey: string | null;
  mode: ManualMode;
  lineValuesBottomUp: PublicLineTuple;
  primaryHexagram: number;
  changingLines: number[];
};

export function readManualCastDraft(questionKey: string | null): ManualCastDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(MANUAL_CAST_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const candidate = JSON.parse(raw) as Partial<ManualCastDraft>;
    if (candidate.schemaVersion !== 1 || candidate.questionKey !== questionKey) return null;
    if (candidate.mode !== "line-values" && candidate.mode !== "primary-changing") return null;
    if (!Array.isArray(candidate.lineValuesBottomUp)) return null;
    const lineValuesBottomUp = manualFromLineValues(candidate.lineValuesBottomUp);
    if (!Number.isInteger(candidate.primaryHexagram) || Number(candidate.primaryHexagram) < 1 || Number(candidate.primaryHexagram) > 64) return null;
    if (!Array.isArray(candidate.changingLines)) return null;
    const changingLines = normalizeManualChangingLines(candidate.changingLines);
    manualFromPrimaryAndChangingLines(Number(candidate.primaryHexagram), changingLines);
    return {
      schemaVersion: 1,
      questionKey,
      mode: candidate.mode,
      lineValuesBottomUp,
      primaryHexagram: Number(candidate.primaryHexagram),
      changingLines,
    };
  } catch {
    return null;
  }
}

export function writeManualCastDraft(draft: ManualCastDraft): void {
  try {
    window.sessionStorage.setItem(MANUAL_CAST_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Draft restoration is presentation-only; the authoritative cast save is separate.
  }
}

export function clearManualCastDraft(): void {
  try {
    window.sessionStorage.removeItem(MANUAL_CAST_DRAFT_STORAGE_KEY);
  } catch {
    // Best effort only; the completed reading lifecycle remains authoritative.
  }
}
