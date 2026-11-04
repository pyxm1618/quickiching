import {
  deepReadingContextSnapshotSchema,
  readingReportSchema as activeReadingReportSchema,
} from "./deep-reading-contract";

export type AiDeepReadingViewModel = {
  schemaVersion: "ai-deep-reading-view-v1";
  coreLead: string;
  coreDetail: string;
  whyItems: string[];
  changeItems: string[];
  actionSignals: string[];
  observeSignals: string[];
  nextSteps: string[];
  disclaimer: string;
};

export type DeepReadingPresentationContext = {
  question: string;
  createdAt?: string;
};

function compactUnique(items: Array<string | null | undefined>, limit = 3): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const value = item?.replace(/\s+/g, " ").trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
    if (result.length >= limit) break;
  }
  return result;
}

function sentencePoints(value: string, limit = 3): string[] {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const matches = normalized.match(/[^.!?。！？]+(?:[.!?。！？]+|$)/gu) ?? [normalized];
  return compactUnique(matches, limit);
}

function splitCoreAnswer(value: string): { lead: string; detail: string } {
  const paragraphs = value
    .split(/\n{2,}/u)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (paragraphs.length > 1) {
    return { lead: paragraphs[0], detail: paragraphs.slice(1).join(" ") };
  }
  const sentences = sentencePoints(value, 8);
  if (sentences.length <= 1) return { lead: value.trim(), detail: "" };
  return { lead: sentences[0], detail: sentences.slice(1).join(" ") };
}

export function normalizeDeepReadingContext(snapshot: unknown): DeepReadingPresentationContext | null {
  const parsed = deepReadingContextSnapshotSchema.safeParse(snapshot);
  if (!parsed.success) return null;
  return {
    question: parsed.data.coreQuestionAtCast,
    createdAt: parsed.data.snapshotAt,
  };
}

export function normalizeDeepReadingViewModel(
  report: unknown,
  snapshot?: unknown,
): AiDeepReadingViewModel | null {
  const parsedSnapshot = deepReadingContextSnapshotSchema.safeParse(snapshot);
  const contextSnapshot = parsedSnapshot.success ? parsedSnapshot.data : null;

  const active = activeReadingReportSchema.safeParse(report);
  if (active.success) {
    const core = splitCoreAnswer(active.data.directAnswer);
    return {
      schemaVersion: "ai-deep-reading-view-v1",
      coreLead: core.lead,
      coreDetail: core.detail,
      whyItems: sentencePoints(active.data.whyThisReading, 3),
      changeItems: compactUnique([
        contextSnapshot?.knowledge.structuralChange,
        contextSnapshot?.knowledge.relating?.coreMeaning,
        ...active.data.whatMattersMost,
      ], 3),
      actionSignals: compactUnique(active.data.whatMattersMost, 3),
      observeSignals: compactUnique([
        ...(contextSnapshot?.knowledge.changingLines.map((line) => line.caution) ?? []),
        ...sentencePoints(active.data.uncertaintyAndBoundaries, 3),
      ], 3),
      nextSteps: compactUnique(active.data.whatToDoNext, 3),
      disclaimer: active.data.disclaimer,
    };
  }

  return null;
}
