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

export type DeterministicFacts = z.infer<typeof deterministicFactsSchema>;
export type CommercialPreviewOutput = z.infer<typeof previewOutputSchema>;
export type CommercialReadingReport = z.infer<typeof readingReportSchema>;
