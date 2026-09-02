import { z } from "zod";

const lineValueSchema = z.union([z.literal(6), z.literal(7), z.literal(8), z.literal(9)]);

export const deterministicFactsSchema = z.object({
  method: z.enum(["three_coin", "yarrow_stalk", "mei_hua_current_time"]),
  algorithmVersion: z.string().min(1).max(120),
  classicMappingVersion: z.string().min(1).max(120),
  lineValuesBottomUp: z.tuple([
    lineValueSchema,
    lineValueSchema,
    lineValueSchema,
    lineValueSchema,
    lineValueSchema,
    lineValueSchema,
  ]),
  primaryHexagramNumber: z.number().int().min(1).max(64),
  movingLinePositions: z.array(z.number().int().min(1).max(6)).max(6),
  relatingHexagramNumber: z.number().int().min(1).max(64).nullable(),
  readingVariant: z.enum(["standard", "still_hexagram", "multiple_moving", "all_lines_moving"]),
}).strict();

const boundedText = (max: number) => z.string().trim().min(1).max(max);

export const previewOutputSchema = z.object({
  schemaVersion: z.literal("commercial-preview-v1"),
  relevanceStatement: boundedText(900),
  surfaceThemes: z.array(boundedText(120)).min(1).max(3),
  boundary: boundedText(500),
  disclaimer: boundedText(500),
}).strict();

// Legacy v1 reading shape, frozen. No adapter produces it any more: the offline
// local adapter and the paid path both emit commercial-reading-v2 below, where
// the classical citations are real quotations with a source rather than licence
// placeholders. It is retained because rows written under this version still
// exist and src/legacy/commercial/ is preserved against it, which is also why
// the "pending_license" literal stays — it is what those rows say.
const basisReferenceSchema = z.object({
  source: z.enum(["king_wen_judgment", "king_wen_line", "relating_judgment"]),
  hexagramNumber: z.number().int().min(1).max(64),
  linePosition: z.number().int().min(1).max(6).optional(),
  status: z.literal("pending_license"),
}).strict();

export const readingReportSchema = z.object({
  schemaVersion: z.literal("commercial-reading-v1"),
  readingVariant: z.enum(["standard", "still_hexagram", "multiple_moving", "all_lines_moving"]),
  coreSummary: boundedText(2400),
  currentStage: boundedText(1800),
  primaryHexagramPattern: boundedText(2400),
  changeMechanism: boundedText(2400),
  possibleDirection: boundedText(2400),
  obstaclesAndBlindSpots: boundedText(2400),
  turningConditions: boundedText(2400),
  conditionalActionDirection: boundedText(2400),
  uncertaintyAndBoundaries: boundedText(2400),
  interpretiveBasisReferences: z.array(basisReferenceSchema).max(20),
  disclaimer: boundedText(600),
}).strict();

// ---------------------------------------------------------------------------
// commercial-reading-v2
//
// The paid reading is split in two. The deterministic half is computed from the
// cast by classical rule (see src/domain/interpretation/deterministic) and is
// never produced by a model. The generated half is the model's application of
// that fixed result to the user's question.
//
// generatedReadingSchema is what the provider is asked for; readingReportV2Schema
// is what gets persisted and rendered.
// ---------------------------------------------------------------------------

export const VERDICT_DIRECTIONS = [
  "favorable",
  "flowing",
  "workable",
  "draining",
  "obstructed",
] as const;

// "undetermined" is the honest answer when Ti-Yong does not apply: the moving
// lines span both trigrams, so no classical direction can be derived.
export const verdictEchoSchema = z.enum([...VERDICT_DIRECTIONS, "undetermined"]);

export const generatedReadingSchema = z.object({
  // Must equal the direction the deterministic layer computed. Any other value
  // means the model tried to re-decide the verdict and the output is rejected.
  verdictEcho: verdictEchoSchema,
  questionRestatement: boundedText(600),
  oracleApplication: boundedText(2400),
  currentStage: boundedText(1800),
  structuralReading: boundedText(2400),
  changeMechanism: boundedText(2400),
  obstacles: boundedText(2400),
  turningConditions: boundedText(2400),
  conditionalGuidance: boundedText(2400),
  uncertaintyAndBoundaries: boundedText(1800),
}).strict();

const oracleQuoteSchema = z.object({
  role: z.enum(["primary", "supporting"]),
  hexagramNumber: z.number().int().min(1).max(64),
  hexagramChineseName: z.string().min(1).max(16),
  label: z.string().min(1).max(64),
  text: z.string().min(1).max(600),
  sourceWork: z.string().min(1).max(120),
  sourceUrl: z.string().min(1).max(600),
}).strict();

export const readingReportV2Schema = z.object({
  schemaVersion: z.literal("commercial-reading-v2"),
  // The language the generated half was written in. Stored so a later render
  // never shows a reader a reading generated for another language.
  locale: z.enum(["en", "zh-Hans"]),
  readingVariant: z.enum(["standard", "still_hexagram", "multiple_moving", "all_lines_moving"]),
  deterministic: z.object({
    primaryHexagramNumber: z.number().int().min(1).max(64),
    relatingHexagramNumber: z.number().int().min(1).max(64).nullable(),
    nuclearHexagramNumber: z.number().int().min(1).max(64),
    movingLinePositions: z.array(z.number().int().min(1).max(6)).max(6),
    // Identifiers, not prose: the stored report is rendered per locale, so it
    // must not freeze one language's wording at generation time.
    changeRuleId: z.string().min(1).max(40),
    direction: z.enum(VERDICT_DIRECTIONS).nullable(),
    tiYong: z.object({
      tiTrigram: z.string().min(1).max(8),
      yongTrigram: z.string().min(1).max(8),
      relation: z.string().min(1).max(40),
    }).strict().nullable(),
    quotes: z.array(oracleQuoteSchema).min(1).max(8),
  }).strict(),
  generated: generatedReadingSchema,
  disclaimer: boundedText(600),
}).strict();

export type GeneratedReading = z.infer<typeof generatedReadingSchema>;
export type CommercialReadingReportV2 = z.infer<typeof readingReportV2Schema>;
export type VerdictEcho = z.infer<typeof verdictEchoSchema>;

export type DeterministicFacts = z.infer<typeof deterministicFactsSchema>;
export type CommercialPreviewOutput = z.infer<typeof previewOutputSchema>;
export type CommercialReadingReport = z.infer<typeof readingReportSchema>;
