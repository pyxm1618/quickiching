import type { PublicReadingMethod } from "@/domain/public-reading/types";
import { completedThreeCoinSteps, readThreeCoinQuestionState, readThreeCoinSession } from "@/lib/three-coin-session";

/**
 * C1 — Passive Resume Authority.
 *
 * Persistence is not automatic resume, and a passive restore is not UI stage
 * authority. Every method component asks this owner what is resumable, renders
 * its normal entry state, and only restores the exact partial state after an
 * explicit user Resume action.
 */

export type ReadingResumeUnit = "lines" | "changes" | "steps" | "draft";

export type ReadingResumePartial = {
  completed: number;
  total: number;
  unit: ReadingResumeUnit;
};

export type ReadingResumeStage = "question-confirm" | "ritual" | "draft";

export type ReadingResumeState =
  | { kind: "none" }
  | {
      kind: "partial";
      method: PublicReadingMethod;
      readingId: string;
      progress: ReadingResumePartial;
      stage?: ReadingResumeStage;
    }
  | {
      /** A completed-but-not-durable cast. Never resumable; handoff retry only. */
      kind: "sealed";
      method: PublicReadingMethod;
      readingId: string;
    };

export const NO_READING_RESUME: ReadingResumeState = { kind: "none" };

/**
 * The single resume decision rule used by all four methods.
 *
 * Sealed completion outranks any leftover draft: a completed cast must never be
 * presented as a resumable partial casting flow.
 */
export function decideReadingResume(input: {
  method: PublicReadingMethod;
  partial: ReadingResumePartial | null;
  partialReadingId?: string | null;
  sealedReadingId?: string | null;
  stage?: ReadingResumeStage;
}): ReadingResumeState {
  const sealedId = input.sealedReadingId?.trim();
  if (sealedId) return { kind: "sealed", method: input.method, readingId: sealedId };

  const partialId = input.partialReadingId?.trim();
  const partial = input.partial;
  if (!partialId || !partial) return NO_READING_RESUME;
  if (!Number.isFinite(partial.completed) || !Number.isFinite(partial.total)) return NO_READING_RESUME;
  if (partial.total <= 0) return NO_READING_RESUME;
  if (partial.unit === "draft") {
    return { kind: "partial", method: input.method, readingId: partialId, progress: partial, stage: "draft" };
  }
  if (partial.completed <= 0 && input.stage !== "question-confirm") return NO_READING_RESUME;
  if (partial.completed >= partial.total) return NO_READING_RESUME;

  return {
    kind: "partial",
    method: input.method,
    readingId: partialId,
    progress: partial,
    ...(input.stage ? { stage: input.stage } : {}),
  };
}

/** Three Coin adapter: 1..5 stored lines are resumable, 6 are sealed completion. */
export function threeCoinResumeState(): ReadingResumeState {
  try {
    const session = readThreeCoinSession();
    if (!session) return NO_READING_RESUME;
    const steps = session.data?.steps ?? [];
    if (completedThreeCoinSteps(steps)) {
      return { kind: "sealed", method: "three-coin", readingId: session.id };
    }
    const questionState = readThreeCoinQuestionState();
    if (steps.length === 0 && !questionState.started && !questionState.question) return NO_READING_RESUME;
    return {
      kind: "partial",
      method: "three-coin",
      readingId: session.id,
      progress: {
        completed: steps.length,
        total: 6,
        unit: "lines",
      },
      stage: questionState.coreQuestionFrozenAtCast || steps.length > 0 ? "ritual" : "question-confirm",
    };
  } catch {
    return NO_READING_RESUME;
  }
}

export function resumeProgressLabel(state: ReadingResumeState, zh: boolean): string {
  if (state.kind !== "partial") return "";
  const { completed, total, unit } = state.progress;
  if (unit === "draft") return zh ? "已保存的草稿" : "saved draft";
  if (state.stage === "question-confirm" && completed === 0) return zh ? "已保存问题" : "question saved";
  if (unit === "changes") return zh ? `${completed} / ${total} 变` : `${completed} / ${total} changes`;
  if (unit === "steps") return zh ? `第 ${completed} / ${total} 步` : `step ${completed} / ${total}`;
  return zh ? `${completed} / ${total} 爻` : `${completed} / ${total} lines`;
}
