import type { ContentLocale } from "@/i18n/config";

export type DensityReviewRulingGroup = {
  id: string;
  locale: ContentLocale;
  numbers: readonly number[];
  rationale: string;
};

const ALL_HEXAGRAM_NUMBERS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
  17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
  33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48,
  49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64,
] as const;

const CHINESE_SCENE_NUMBERS = [8, 13, 15, 16, 22, 24, 25, 28, 39, 43, 44, 45, 48, 56] as const;
const CHINESE_STANDARD_NUMBERS = ALL_HEXAGRAM_NUMBERS.filter((number) => !CHINESE_SCENE_NUMBERS.some((sceneNumber) => sceneNumber === number));

/**
 * These are editorial rulings for out-of-band density warnings, not generated
 * excuses. Membership is explicit so a new warning without a reviewed content
 * class fails the audit instead of receiving a universal explanation.
 */
export const DENSITY_REVIEW_RULING_GROUPS: readonly DensityReviewRulingGroup[] = [
  {
    id: "en-authored-classical-detail",
    locale: "en",
    numbers: ALL_HEXAGRAM_NUMBERS,
    rationale: "The English detail set preserves the independently authored interpretation catalog, fixed Judgment and Image provenance, six changing-line records, and the unchanging reading. The page-specific content already answers the entity and line intents; adding exact family repetitions merely to reach a numeric band would reduce editorial clarity and risk rewriting the approved English page structure.",
  },
  {
    id: "zh-classical-entity-detail",
    locale: "zh-Hans",
    numbers: CHINESE_STANDARD_NUMBERS,
    rationale: "This standard Chinese detail group keeps the fixed classical quotations, six localized line explanations, 本卦与之卦 terminology, and a page-specific modern guidance set together. The protected entity phrases can therefore sit above the soft band on some pages without adding repetitive卦名句；the ruling is to retain useful explanation and accept the measured exception.",
  },
  {
    id: "zh-approved-scene-detail",
    locale: "zh-Hans",
    numbers: CHINESE_SCENE_NUMBERS,
    rationale: "The approved Chinese scene pages include one additional relationship, work, or fortune module from the workbook allowlist. That module supplies a distinct reflective use case rather than a keyword block, so the protected phrase ratio may exceed the soft band; the content remains bounded, probabilistic, and specific to the allowed scene.",
  },
];

const RULING_BY_KEY = new Map(
  DENSITY_REVIEW_RULING_GROUPS.flatMap((group) => group.numbers.map((number) => [`${group.locale}:${number}`, group] as const)),
);

export function densityReviewRulingFor(locale: ContentLocale, number: number): DensityReviewRulingGroup | null {
  return RULING_BY_KEY.get(`${locale}:${number}`) ?? null;
}
