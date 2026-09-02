import type { ContentLocale } from "@/i18n/config";
import type { DeterministicVerdict } from "@/domain/interpretation/deterministic/verdict";
import { generatedReadingSchema, type GeneratedReading } from "@/domain/generation/schemas";

// Layer 4 of the deep reading design. The existing generation_output_reviews
// pass asks a model to judge a model. These checks are mechanical: they compare
// the generated text against the deterministic verdict that produced it, so a
// model cannot quietly re-decide the reading or invent a quotation.

export type ReadingValidationFailure =
  | "SCHEMA_INVALID"
  | "VERDICT_ECHO_MISMATCH"
  | "QUOTE_FABRICATED"
  | "ABSOLUTE_PREDICTION"
  | "PROHIBITED_DIRECTIVE"
  | "GUIDANCE_NOT_CONDITIONAL"
  | "NOT_SPECIFIC_TO_QUESTION";

export type ReadingValidationResult = {
  valid: boolean;
  failures: ReadingValidationFailure[];
};

// Phrases that turn a reflective reading into a prediction or professional
// instruction. Every locale's patterns are always applied: a reading is
// rejected for an absolute prediction in any language, not only its own, so a
// language-mixed output cannot slip past its own locale's list.
const ABSOLUTE_PREDICTION_PATTERNS = [
  /必然[会将]?/,
  /一定[会能将]/,
  /注定/,
  /百分之百/,
  /绝对[会能不]/,
  /\bwill certainly\b/i,
  /\bis guaranteed to\b/i,
  /\bdestined to\b/i,
];

const PROHIBITED_DIRECTIVE_PATTERNS = [
  /停[止服]药|换药|加大剂量|不用去医院/,
  /(?:建议|应该|必须)(?:起诉|打官司|签署这份合同)/,
  /(?:全仓|满仓|梭哈|加杠杆)/,
  /\b(?:stop|discontinue) (?:taking )?(?:your )?medication\b/i,
  /\bsue (?:them|him|her)\b/i,
];

// Conditional markers, per output language. The product commits to giving a
// direction, but always as a condition rather than a forecast, so the guidance
// module must carry one in the language it was written in.
const CONDITIONAL_MARKERS: Record<ContentLocale, readonly string[]> = {
  "zh-Hans": ["若", "如果", "倘若", "一旦", "前提", "条件", "只要", "除非"],
  en: [" if ", "if ", " when ", " unless ", " provided ", " as long as ", " should you "],
};

/**
 * Whether a fragment carries phrasing this validator bans outright.
 *
 * Exported so a writer that composes text from untrusted input — the offline
 * adapter quoting the reader's own words back — can drop an offending fragment
 * before emitting it, instead of keeping a second copy of these patterns.
 */
export function hasProhibitedPhrasing(text: string): boolean {
  return ABSOLUTE_PREDICTION_PATTERNS.some((pattern) => pattern.test(text))
    || PROHIBITED_DIRECTIVE_PATTERNS.some((pattern) => pattern.test(text));
}

function allText(reading: GeneratedReading): string {
  return [
    reading.questionRestatement,
    reading.oracleApplication,
    reading.currentStage,
    reading.structuralReading,
    reading.changeMechanism,
    reading.obstacles,
    reading.turningConditions,
    reading.conditionalGuidance,
    reading.uncertaintyAndBoundaries,
  ].join("\n");
}

// Characters that carry no topical information on their own. A term made only
// of these (e.g. 「这件」) would match almost any text and cannot evidence that
// the reading engaged with the question.
const FUNCTION_CHARS = new Set(
  "我你他她它们的了是不在有会要和与或就都也还很如果这那些个么吗呢吧啊之其为以及对把被给让向从到再又或者应该可能需要之后之前时候什么怎么样".split(""),
);

/**
 * Candidate content terms from the user's question.
 *
 * CJK has no word boundaries and the repository has no segmenter, so Han runs
 * are expanded into 2-to-4 character sliding windows and the purely functional
 * ones dropped. This over-generates by design: the check it feeds only asks
 * whether the reading engaged with the question at all.
 */
export function questionKeyTerms(question: string): string[] {
  const terms = new Set<string>();

  for (const run of question.match(/[一-鿿]{2,}/g) ?? []) {
    for (let size = 2; size <= 4; size += 1) {
      for (let start = 0; start + size <= run.length; start += 1) {
        const term = run.slice(start, start + size);
        if ([...term].every((char) => FUNCTION_CHARS.has(char))) continue;
        terms.add(term);
      }
    }
  }

  for (const word of question.match(/[A-Za-z][A-Za-z'-]{3,}/g) ?? []) {
    terms.add(word.toLowerCase());
  }

  return [...terms];
}

function quotesAreFabricated(reading: GeneratedReading, verdict: DeterministicVerdict): boolean {
  const allowed = [verdict.oracle.primary.text, ...verdict.oracle.supporting.map((q) => q.text)]
    .map((text) => text.replace(/\s+/g, ""));

  // Anything the model put inside a quotation bracket must be one of the texts
  // it was given. Brackets are how the prompt asks it to mark quotations.
  const quoted = allText(reading).match(/[「『"]([^」』"]{2,})[」』"]/g) ?? [];
  return quoted.some((raw) => {
    const inner = raw.slice(1, -1).replace(/\s+/g, "");
    if (inner.length < 4) return false;
    return !allowed.some((text) => text.includes(inner) || inner.includes(text));
  });
}

export function validateGeneratedReading(
  candidate: unknown,
  verdict: DeterministicVerdict,
  question: string,
  locale: ContentLocale,
): ReadingValidationResult {
  const parsed = generatedReadingSchema.safeParse(candidate);
  if (!parsed.success) return { valid: false, failures: ["SCHEMA_INVALID"] };

  const reading = parsed.data;
  const failures: ReadingValidationFailure[] = [];

  const expectedEcho = verdict.direction ?? "undetermined";
  if (reading.verdictEcho !== expectedEcho) failures.push("VERDICT_ECHO_MISMATCH");

  if (quotesAreFabricated(reading, verdict)) failures.push("QUOTE_FABRICATED");

  const text = allText(reading);
  if (ABSOLUTE_PREDICTION_PATTERNS.some((pattern) => pattern.test(text))) {
    failures.push("ABSOLUTE_PREDICTION");
  }
  if (PROHIBITED_DIRECTIVE_PATTERNS.some((pattern) => pattern.test(text))) {
    failures.push("PROHIBITED_DIRECTIVE");
  }

  const guidance = ` ${reading.conditionalGuidance.toLowerCase()} `;
  if (!CONDITIONAL_MARKERS[locale].some((marker) => guidance.includes(marker.toLowerCase()))) {
    failures.push("GUIDANCE_NOT_CONDITIONAL");
  }

  const terms = questionKeyTerms(question);
  if (terms.length > 0) {
    const lowered = text.toLowerCase();
    const matched = terms.filter((term) => lowered.includes(term.toLowerCase()));
    // Over-generated n-grams make single hits cheap, so a short question needs
    // one match and anything richer needs two distinct ones.
    const required = terms.length >= 4 ? 2 : 1;
    if (matched.length < required) failures.push("NOT_SPECIFIC_TO_QUESTION");
  }

  return { valid: failures.length === 0, failures };
}
