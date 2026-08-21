import type { ContentLocale } from "@/i18n/config";

export type SeoToken = {
  value: string;
  start: number;
  end: number;
};

export type KeywordFamilyMatch = {
  phrase: string;
  start: number;
  end: number;
};

export type KeywordQualityInput = {
  text: string;
  locale: ContentLocale;
  primary: string;
  approvedFamily: readonly string[];
};

export type KeywordQualityMeasurement = {
  tokenCount: number;
  primaryOccurrences: number;
  primaryDensity: number;
  familyCoveredTokens: number;
  familyDensity: number;
  familyMatches: KeywordFamilyMatch[];
};

export type LanguageContamination = {
  count: number;
  samples: string[];
};

export const PRIMARY_DENSITY_RANGE = { min: 0.01, max: 0.02 } as const;
export const FAMILY_DENSITY_RANGE = { min: 0.03, max: 0.05 } as const;

function normalize(value: string): string {
  return value.normalize("NFKC");
}

function normalizeForMatch(value: string): string {
  return normalize(value).toLocaleLowerCase("en-US");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function englishPhrasePattern(phrase: string): RegExp | null {
  const words = normalizeForMatch(phrase).trim().split(/\s+/u).filter(Boolean);
  if (words.length === 0) return null;
  const source = words.map(escapeRegExp).join("\\s+");
  return new RegExp(`(?<![\\p{L}\\p{N}])${source}(?![\\p{L}\\p{N}])`, "giu");
}

function phraseSpans(text: string, phrase: string, locale: ContentLocale): KeywordFamilyMatch[] {
  const normalizedText = normalizeForMatch(text);
  const normalizedPhrase = normalizeForMatch(phrase).trim();
  if (!normalizedPhrase) return [];

  if (locale === "en") {
    const pattern = englishPhrasePattern(normalizedPhrase);
    if (!pattern) return [];
    return [...normalizedText.matchAll(pattern)].map((match) => ({
      phrase: normalizedPhrase,
      start: match.index,
      end: match.index + match[0].length,
    }));
  }

  const spans: KeywordFamilyMatch[] = [];
  let cursor = 0;
  while (cursor <= normalizedText.length - normalizedPhrase.length) {
    const start = normalizedText.indexOf(normalizedPhrase, cursor);
    if (start < 0) break;
    spans.push({ phrase: normalizedPhrase, start, end: start + normalizedPhrase.length });
    cursor = start + normalizedPhrase.length;
  }
  return spans;
}

export function tokenizeWithSpans(text: string, locale: ContentLocale): SeoToken[] {
  const normalizedText = normalize(text);
  if (locale === "en") {
    return [...normalizedText.matchAll(/[\p{L}\p{N}]+/gu)].map((match) => ({
      value: match[0],
      start: match.index,
      end: match.index + match[0].length,
    }));
  }

  const segmenter = new Intl.Segmenter("zh-Hans", { granularity: "word" });
  return [...segmenter.segment(normalizedText)]
    .filter((segment) => segment.isWordLike)
    .map((segment) => ({
      value: segment.segment,
      start: segment.index,
      end: segment.index + segment.segment.length,
    }));
}

export function countExactPhrase(text: string, phrase: string, locale: ContentLocale): number {
  return phraseSpans(text, phrase, locale).length;
}

function matchLongestNonOverlapping(
  text: string,
  phrases: readonly string[],
  locale: ContentLocale,
): KeywordFamilyMatch[] {
  const candidates = [...new Set(phrases.map((phrase) => normalizeForMatch(phrase).trim()).filter(Boolean))]
    .sort((left, right) => {
      const tokenDifference = tokenizeWithSpans(right, locale).length - tokenizeWithSpans(left, locale).length;
      return tokenDifference || right.length - left.length || left.localeCompare(right);
    });
  const accepted: KeywordFamilyMatch[] = [];

  for (const phrase of candidates) {
    for (const span of phraseSpans(text, phrase, locale)) {
      const overlaps = accepted.some((match) => span.start < match.end && span.end > match.start);
      if (!overlaps) accepted.push(span);
    }
  }

  return accepted.sort((left, right) => left.start - right.start || left.end - right.end);
}

export function measureKeywordQuality(input: KeywordQualityInput): KeywordQualityMeasurement {
  const normalizedText = normalize(input.text);
  const tokens = tokenizeWithSpans(normalizedText, input.locale);
  const familyMatches = matchLongestNonOverlapping(normalizedText, input.approvedFamily, input.locale);
  const familyCoveredTokens = tokens.filter((token) =>
    familyMatches.some((match) => token.start < match.end && token.end > match.start),
  ).length;
  const primaryOccurrences = countExactPhrase(normalizedText, input.primary, input.locale);
  const denominator = Math.max(tokens.length, 1);

  return {
    tokenCount: tokens.length,
    primaryOccurrences,
    primaryDensity: primaryOccurrences / denominator,
    familyCoveredTokens,
    familyDensity: familyCoveredTokens / denominator,
    familyMatches,
  };
}

export function findLanguageContamination(text: string, locale: ContentLocale): LanguageContamination {
  if (locale === "en") {
    const matches = normalize(text).match(/\p{Script=Han}/gu) ?? [];
    return { count: matches.length, samples: [...new Set(matches)].slice(0, 12) };
  }

  const matches = (normalize(text).match(/\p{Script=Latin}[\p{Script=Latin}\p{M}'’\-]*/gu) ?? [])
    .filter((word) => [...word].length >= 2);
  return { count: matches.length, samples: [...new Set(matches)].slice(0, 12) };
}
