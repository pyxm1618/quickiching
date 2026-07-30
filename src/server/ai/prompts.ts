import type { GenerationInput } from "./index";
import { buildClassicReferences } from "@/domain/classics";

export const PREVIEW_PROMPT_VERSION = "preview-v2.1.0";
export const READING_PROMPT_VERSION = "reading-v2.1.0";
export const OUTPUT_REVIEW_PROMPT_VERSION = "output-review-v2.1.0";

function facts(input: GenerationInput): string {
  return JSON.stringify({
    scene: input.scene,
    interpretationGoal: input.interpretationGoal,
    context: input.context,
    method: input.result.method,
    algorithmVersion: input.result.algorithmVersion,
    classicMappingVersion: input.result.classicMappingVersion,
    lineValuesBottomUp: input.result.lineValuesBottomUp,
    primaryHexagramNumber: input.result.primaryHexagramNumber,
    movingLinePositions: input.result.movingLinePositions,
    relatingHexagramNumber: input.result.relatingHexagramNumber,
    controlledReferences: buildClassicReferences(input.result),
  });
}

export function previewPrompt(input: GenerationInput) {
  return {
    version: PREVIEW_PROMPT_VERSION,
    system: [
      "You create a bounded I Ching relevance preview for cultural reflection.",
      "Return only the requested schema.",
      "Do not reveal paid conclusions: no current-stage label, forecast, turning condition, or action direction.",
      "Do not provide medical, legal, financial, safety, or other professional advice.",
      "Do not quote or invent classic passages. Use the controlled facts only.",
    ].join(" "),
    prompt: `Write one or two sentences, 25-70 words, connecting the user's context to the hexagram imagery without prediction or instruction.\nFACTS=${facts(input)}`,
  };
}

export function readingPrompt(input: GenerationInput) {
  return {
    version: READING_PROMPT_VERSION,
    system: [
      "You create a fixed ten-module I Ching reflection report for a specific supplied context.",
      "Return only the requested schema and include exactly the controlled reference records supplied in FACTS.",
      "Distinguish observations, possible directions, and uncertainty. Never present certainty or a command.",
      "Do not provide professional advice or replace medical, legal, financial, or safety professionals.",
      "Do not quote or invent classic passages. Do not alter casting facts, moving lines, method, or reference IDs.",
      "Each module must be substantively personalized to the supplied context and not generic filler.",
    ].join(" "),
    prompt: `Generate the complete report. Explain evidence for the stage and change mechanism, observable turning conditions, reversible conditional orientation, and explicit boundaries.\nFACTS=${facts(input)}`,
  };
}

export function outputReviewPrompt(input: GenerationInput, candidate: unknown) {
  return {
    version: OUTPUT_REVIEW_PROMPT_VERSION,
    system: [
      "You are an independent output-quality reviewer.",
      "Review the candidate against the supplied casting facts and safety constraints.",
      "Reject factual mismatch, invented classic quotations, direct commands, absolute predictions, professional advice, missing personalization, or schema-shaped filler.",
      "Approval does not override deterministic validation; return only the review schema.",
    ].join(" "),
    prompt: `FACTS=${facts(input)}\nCANDIDATE=${JSON.stringify(candidate)}`,
  };
}
