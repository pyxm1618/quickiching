import type { ContentLocale } from "@/i18n/config";
import type { DeterministicVerdict } from "@/domain/interpretation/deterministic/verdict";
import type {
  CommercialReadingReportV2,
  DeterministicFacts,
  GeneratedReading,
} from "./schemas";

// Joins the code-computed half of a deep reading with the written half into the
// stored commercial-reading-v2 report.
//
// Both the production workflow and the offline adapter assemble through here, so
// what a developer sees locally has the same shape — and the same provenance
// rules — as what production persists. The deterministic fields are copied from
// the verdict, never from the writer's output, so what the reader sees as 「依据」
// cannot drift.

export type ReadingVariant = DeterministicFacts["readingVariant"];

export const READING_DISCLAIMER: Record<ContentLocale, string> = {
  "zh-Hans": "本解读用于反思与自我澄清，不构成决定论预言，也不替代医疗、法律、财务或其他专业建议。",
  en: "This reading is for reflection and self-clarification. It is not a deterministic prediction"
    + " and does not replace medical, legal, financial or other professional advice.",
};

export function readingVariantFor(movingLinePositions: readonly number[]): ReadingVariant {
  if (movingLinePositions.length === 0) return "still_hexagram";
  if (movingLinePositions.length === 6) return "all_lines_moving";
  if (movingLinePositions.length > 1) return "multiple_moving";
  return "standard";
}

export function assembleReadingReport(input: {
  verdict: DeterministicVerdict;
  generated: GeneratedReading;
  readingVariant: ReadingVariant;
  locale: ContentLocale;
}): CommercialReadingReportV2 {
  const { verdict } = input;
  const quotes = [
    { role: "primary" as const, quote: verdict.oracle.primary },
    ...verdict.oracle.supporting.map((quote) => ({ role: "supporting" as const, quote })),
  ].map(({ role, quote }) => ({
    role,
    hexagramNumber: quote.hexagramNumber,
    hexagramChineseName: quote.hexagramChineseName,
    label: quote.label,
    text: quote.text,
    sourceWork: quote.source.work,
    sourceUrl: quote.source.textSourceUrl,
  }));

  return {
    schemaVersion: "commercial-reading-v2",
    locale: input.locale,
    readingVariant: input.readingVariant,
    deterministic: {
      primaryHexagramNumber: verdict.primaryHexagram.number,
      relatingHexagramNumber: verdict.relatingHexagram?.number ?? null,
      nuclearHexagramNumber: verdict.nuclearHexagram.number,
      movingLinePositions: [...verdict.movingLinePositions],
      changeRuleId: verdict.changeRule.ruleId,
      direction: verdict.direction,
      tiYong: verdict.tiYong
        ? {
            tiTrigram: verdict.tiYong.ti.trigram,
            yongTrigram: verdict.tiYong.yong.trigram,
            relation: verdict.tiYong.relation,
          }
        : null,
      quotes,
    },
    generated: input.generated,
    disclaimer: READING_DISCLAIMER[input.locale],
  };
}
