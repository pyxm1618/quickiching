import {
  deepReadingContextSnapshotSchema,
  legacyDeepReadingReportSchema,
  readingReportSchema as activeReadingReportSchema,
} from "./deep-reading-contract";
import { readingReportSchema as commercialReadingReportSchema } from "./schemas";

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
  legacyReadOnly: boolean;
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
    legacyReadOnly: parsed.data.schemaVersion === "deep-reading-context-v1",
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

  const legacyV2 = legacyDeepReadingReportSchema.safeParse(report);
  if (legacyV2.success) {
    const core = splitCoreAnswer(legacyV2.data.directAnswer);
    return {
      schemaVersion: "ai-deep-reading-view-v1",
      coreLead: core.lead,
      coreDetail: core.detail,
      whyItems: sentencePoints(legacyV2.data.situationMapping, 3),
      changeItems: compactUnique([
        contextSnapshot?.knowledge.structuralChange,
        legacyV2.data.conditionalDirection,
        ...legacyV2.data.keyTensions,
      ], 3),
      actionSignals: compactUnique(legacyV2.data.signalsToWatch, 3),
      observeSignals: compactUnique([
        ...legacyV2.data.keyTensions,
        ...sentencePoints(legacyV2.data.uncertaintyAndBoundaries, 2),
      ], 3),
      nextSteps: compactUnique([
        ...sentencePoints(legacyV2.data.practicalReflection, 3),
        ...sentencePoints(legacyV2.data.conditionalDirection, 2),
      ], 3),
      disclaimer: legacyV2.data.disclaimer,
    };
  }

  const legacyV1 = commercialReadingReportSchema.safeParse(report);
  if (legacyV1.success) {
    const core = splitCoreAnswer(legacyV1.data.coreSummary);
    return {
      schemaVersion: "ai-deep-reading-view-v1",
      coreLead: core.lead,
      coreDetail: core.detail,
      whyItems: compactUnique([
        ...sentencePoints(legacyV1.data.currentStage, 2),
        ...sentencePoints(legacyV1.data.primaryHexagramPattern, 2),
      ], 3),
      changeItems: compactUnique([
        ...sentencePoints(legacyV1.data.changeMechanism, 2),
        ...sentencePoints(legacyV1.data.possibleDirection, 2),
      ], 3),
      actionSignals: compactUnique([
        ...sentencePoints(legacyV1.data.turningConditions, 2),
        ...sentencePoints(legacyV1.data.conditionalActionDirection, 2),
      ], 3),
      observeSignals: compactUnique([
        ...sentencePoints(legacyV1.data.obstaclesAndBlindSpots, 2),
        ...sentencePoints(legacyV1.data.uncertaintyAndBoundaries, 2),
      ], 3),
      nextSteps: compactUnique([
        ...sentencePoints(legacyV1.data.conditionalActionDirection, 3),
        ...sentencePoints(legacyV1.data.turningConditions, 2),
      ], 3),
      disclaimer: legacyV1.data.disclaimer,
    };
  }

  return null;
}
