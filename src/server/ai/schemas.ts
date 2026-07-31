import * as z from "zod";

const boundedModule = z.string().trim().min(80).max(2200);

export const previewOutputSchema = z.object({
  relevanceStatement: z.string().trim().min(1).max(700),
}).strict();

export const interpretiveBasisReferenceSchema = z.object({
  referenceId: z.string().trim().min(1).max(160),
  sourceVersion: z.literal("legge-1899-v1"),
  hexagramNumber: z.number().int().min(1).max(64),
  linePosition: z.number().int().min(1).max(6).optional(),
  kind: z.enum(["judgment", "line", "relating_judgment"]),
}).strict();

export const readingReportSchema = z.object({
  readingVariant: z.enum(["standard", "still_hexagram", "multiple_moving", "all_lines_moving"]),
  coreSummary: z.string().trim().min(160).max(2200),
  currentStage: boundedModule,
  primaryHexagramPattern: boundedModule,
  changeMechanism: boundedModule,
  possibleDirection: boundedModule,
  obstaclesAndBlindSpots: boundedModule,
  turningConditions: boundedModule,
  conditionalActionDirection: boundedModule,
  uncertaintyAndBoundaries: boundedModule,
  interpretiveBasis: boundedModule,
  interpretiveBasisReferences: z.array(interpretiveBasisReferenceSchema).min(1).max(8),
}).strict();

export type PreviewOutputSchema = z.infer<typeof previewOutputSchema>;
export type ReadingReportSchema = z.infer<typeof readingReportSchema>;
