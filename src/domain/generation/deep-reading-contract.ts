import { z } from "zod";
import { deterministicFactsSchema } from "./schemas";

const goalSchema = z.enum([
  "what_do_i_need_to_see_clearly",
  "what_should_i_pay_attention_to_next",
  "how_should_i_act",
  "what_is_the_likely_direction",
]);

const sceneSchema = z.enum(["general", "career", "relationships", "decision", "timing", "wealth", "spiritual"]);
const boundedText = (maximum: number) => z.string().trim().max(maximum);
const contextList = z.array(z.string().trim().min(1).max(240)).max(8);

function codePointCount(value: string): number {
  return Array.from(value).length;
}

export const deepReadingContextEnrichmentSchema = z.object({
  contextNotes: boundedText(2000).default(""),
  options: contextList.default([]),
  constraints: contextList.default([]),
  concerns: contextList.default([]),
  interpretationGoal: goalSchema,
  locale: z.enum(["en", "zh-Hans"]),
}).strict().superRefine((context, issueContext) => {
  const contextText = [context.contextNotes, ...context.options, ...context.constraints, ...context.concerns]
    .filter(Boolean)
    .join(" ");
  if (codePointCount(contextText) < 24) {
    issueContext.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["contextNotes"],
      message: "Add at least 24 characters of relevant situation context.",
    });
  }
});

export const deepReadingEvidenceSchema = z.object({
  id: z.string().min(1).max(120),
  source: z.enum([
    "king_wen_judgment",
    "king_wen_image",
    "king_wen_line",
    "interpretation_theme",
    "interpretation_meaning",
    "interpretation_strength",
    "interpretation_challenge",
    "interpretation_orientation",
    "interpretation_structure",
    "interpretation_transition",
    "interpretation_stability",
    "line_theme",
    "line_meaning",
    "line_dynamic",
    "line_caution",
    "line_reflection",
    "relating_judgment",
    "relating_image",
    "relating_meaning",
  ]),
  hexagramNumber: z.number().int().min(1).max(64),
  linePosition: z.number().int().min(1).max(6).optional(),
  content: z.string().trim().min(1).max(4000),
}).strict().superRefine((evidence, issueContext) => {
  const isLine = evidence.source === "king_wen_line"
    || evidence.source.startsWith("line_");
  if (isLine && evidence.linePosition === undefined) {
    issueContext.addIssue({ code: z.ZodIssueCode.custom, path: ["linePosition"], message: "Line evidence needs a position." });
  }
  if (!isLine && evidence.linePosition !== undefined) {
    issueContext.addIssue({ code: z.ZodIssueCode.custom, path: ["linePosition"], message: "Non-line evidence cannot cite a line position." });
  }
});

export const deepReadingKnowledgeBundleSchema = z.object({
  version: z.string().min(1).max(120),
  primary: z.object({
    number: z.number().int().min(1).max(64),
    name: z.string().min(1),
    chineseName: z.string().min(1),
    judgment: z.string().min(1),
    image: z.string().min(1),
    interpretation: z.object({
      coreTheme: z.string().min(1),
      coreMeaning: z.string().min(1),
      strength: z.string().min(1),
      challenge: z.string().min(1),
      orientation: z.string().min(1),
      structureInterpretation: z.string().min(1),
      transitionTheme: z.string().min(1),
      stabilityTheme: z.string().min(1),
    }).strict(),
  }).strict(),
  changingLines: z.array(z.object({
    position: z.number().int().min(1).max(6),
    lineValue: z.union([z.literal(6), z.literal(9)]),
    classicalText: z.string().min(1),
    theme: z.string().min(1),
    meaning: z.string().min(1),
    changeDynamic: z.string().min(1),
    caution: z.string().min(1),
    reflection: z.string().min(1),
    synthesisPhrase: z.string().min(1),
  }).strict()).max(6),
  relating: z.object({
    number: z.number().int().min(1).max(64),
    name: z.string().min(1),
    chineseName: z.string().min(1),
    judgment: z.string().min(1),
    image: z.string().min(1),
    coreMeaning: z.string().min(1),
    orientation: z.string().min(1),
  }).strict().nullable(),
  structuralChange: z.string().min(1),
  evidence: z.array(deepReadingEvidenceSchema).min(1).max(100),
}).strict();

export const deepReadingContextSnapshotSchema = z.object({
  schemaVersion: z.literal("deep-reading-context-v1"),
  coreQuestionAtCast: z.string().trim().min(8).max(1000),
  context: deepReadingContextEnrichmentSchema,
  scene: sceneSchema,
  castMethod: z.literal("three_coin"),
  methodVersion: z.string().min(1).max(120),
  facts: deterministicFactsSchema,
  snapshotAt: z.string().datetime({ offset: true }),
  knowledgeVersion: z.string().min(1).max(120),
  risk: z.object({
    status: z.literal("allowed"),
    ruleVersion: z.string().min(1).max(120),
    reasonCode: z.string().min(1).max(120),
  }).strict(),
  knowledge: deepReadingKnowledgeBundleSchema,
}).strict();

export const readingReportSchema = z.object({
  schemaVersion: z.literal("deep-reading-v2"),
  readingVariant: z.enum(["standard", "still_hexagram", "multiple_moving", "all_lines_moving"]),
  directAnswer: z.string().trim().min(80).max(2400),
  situationMapping: z.string().trim().min(80).max(3000),
  keyTensions: z.array(z.string().trim().min(20).max(700)).min(1).max(4),
  conditionalDirection: z.string().trim().min(80).max(2400),
  signalsToWatch: z.array(z.string().trim().min(20).max(600)).min(1).max(5),
  practicalReflection: z.string().trim().min(80).max(2400),
  uncertaintyAndBoundaries: z.string().trim().min(80).max(2400),
  interpretiveBasisReferences: z.array(z.object({
    evidenceId: z.string().min(1).max(120),
  }).strict()).min(1).max(20),
  disclaimer: z.string().trim().min(20).max(600),
}).strict();

export type DeepReadingContextEnrichment = z.infer<typeof deepReadingContextEnrichmentSchema>;
export type DeepReadingKnowledgeBundle = z.infer<typeof deepReadingKnowledgeBundleSchema>;
export type DeepReadingContextSnapshot = z.infer<typeof deepReadingContextSnapshotSchema>;
export type DeepReadingReport = z.infer<typeof readingReportSchema>;

export type DeepReadingEvidenceScope = {
  primaryHexagramNumber: number;
  relatingHexagramNumber: number | null;
  movingLinePositions: readonly number[];
  readingVariant: DeepReadingContextSnapshot["facts"]["readingVariant"];
};

export function validateDeepReadingEvidence(
  candidate: unknown,
  knowledge: DeepReadingKnowledgeBundle,
  scope: DeepReadingEvidenceScope,
): { valid: boolean; invalidEvidenceIds: string[] } {
  const parsed = readingReportSchema.safeParse(candidate);
  if (!parsed.success || parsed.data.interpretiveBasisReferences.length === 0) {
    return { valid: false, invalidEvidenceIds: ["EVIDENCE_REQUIRED"] };
  }

  if (parsed.data.readingVariant !== scope.readingVariant) {
    return { valid: false, invalidEvidenceIds: ["READING_VARIANT_MISMATCH"] };
  }

  const evidenceById = new Map(knowledge.evidence.map((item) => [item.id, item]));
  const invalidEvidenceIds = [...new Set(parsed.data.interpretiveBasisReferences.flatMap(({ evidenceId }) => {
    const evidence = evidenceById.get(evidenceId);
    if (!evidence) return [evidenceId];
    if (evidence.source.startsWith("relating_") && evidence.hexagramNumber !== scope.relatingHexagramNumber) {
      return [evidenceId];
    }
    if (!evidence.source.startsWith("relating_") && evidence.hexagramNumber !== scope.primaryHexagramNumber) {
      return [evidenceId];
    }
    if (evidence.linePosition !== undefined && !scope.movingLinePositions.includes(evidence.linePosition)) {
      return [evidenceId];
    }
    return [];
  }))];

  return { valid: invalidEvidenceIds.length === 0, invalidEvidenceIds };
}

export function deepReadingVariantPolicy(variant: DeepReadingContextSnapshot["facts"]["readingVariant"]): string {
  switch (variant) {
    case "still_hexagram":
      return "Treat the primary hexagram as the stable pattern. Do not claim that a transition or relating hexagram exists.";
    case "standard":
      return "Use the single changing line as the central cast-specific evidence.";
    case "multiple_moving":
      return "Synthesize the active lines together, showing how their tensions relate. Do not mechanically repeat each line or declare one line a universal rule.";
    case "all_lines_moving":
      return "Treat the cast as a special all-lines-moving contrast between the primary and relating hexagrams. Do not apply the single-line policy; state the added interpretive uncertainty.";
  }
}
