import * as z from "zod";

export const PERSONALIZED_REQUEST_SCHEMA_VERSION = "question-interpretation-request-v1" as const;
export const PERSONALIZED_RESPONSE_SCHEMA_VERSION = "question-interpretation-v1" as const;

export const PERSONALIZED_INTERPRETATION_DISCLAIMERS = {
  en: "For reflection only. This interpretation is not a prediction or medical, legal, financial, or safety advice. Use qualified help and real-world evidence for consequential decisions.",
  zh: "仅供反思。这份解读不是预测，也不是医疗、法律、财务或安全建议。涉及重大决定时，请依据现实证据并寻求合格的专业帮助。",
} as const;

const lineValueSchema = z.union([z.literal(6), z.literal(7), z.literal(8), z.literal(9)]);

export const personalizedInterpretationRequestSchema = z.object({
  schemaVersion: z.literal(PERSONALIZED_REQUEST_SCHEMA_VERSION),
  readingFingerprint: z.string().trim().min(1).max(256),
  question: z.string().trim().min(1).max(2_000),
  method: z.enum(["three-coin", "yarrow-stalks", "mei-hua-yi-shu", "manual"]),
  methodVersion: z.string().trim().min(1).max(100),
  lineValuesBottomUp: z.tuple([
    lineValueSchema,
    lineValueSchema,
    lineValueSchema,
    lineValueSchema,
    lineValueSchema,
    lineValueSchema,
  ]),
  primaryHexagram: z.number().int().min(1).max(64),
  changingLines: z.array(z.number().int().min(1).max(6)).max(6),
  relatingHexagram: z.number().int().min(1).max(64).nullable(),
  language: z.enum(["en", "zh"]),
  turnstileToken: z.string().trim().min(1).max(4_096).optional(),
}).strict();

const responseText = (max: number) => z.string().trim().min(1).max(max);

export const personalizedInterpretationResponseSchema = z.object({
  schemaVersion: z.literal(PERSONALIZED_RESPONSE_SCHEMA_VERSION),
  readingFingerprint: z.string().trim().min(1).max(256),
  summary: responseText(1_200),
  supports: z.array(responseText(500)).min(1).max(4),
  cautions: z.array(responseText(500)).min(1).max(4),
  changing: responseText(800).nullable(),
  nextReflections: z.array(responseText(500)).min(1).max(3),
  disclaimer: responseText(320),
}).strict();

export type PersonalizedInterpretationRequest = z.infer<typeof personalizedInterpretationRequestSchema>;
export type PersonalizedInterpretationResponse = z.infer<typeof personalizedInterpretationResponseSchema>;
