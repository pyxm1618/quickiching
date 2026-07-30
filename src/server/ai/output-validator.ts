import { buildClassicReferences } from "@/domain/classics";
import {
  assertMethodEvidenceMatchesResult,
  type CastingMethodEvidence,
  type MethodEvidenceResult,
  verifiedHexagramResult,
} from "@/domain/casting/method-evidence";
import type {
  HexagramResult,
  InterpretationGoal,
  Scene,
} from "@/domain/casting/types";
import type { PreviewOutput, ReadingReport, ReadingVariant } from "@/domain/readings/types";
import { previewOutputSchema, readingReportSchema } from "./schemas";

export type OutputValidationInput = {
  result: MethodEvidenceResult;
  methodEvidence: CastingMethodEvidence;
  scene: Scene;
  interpretationGoal: InterpretationGoal;
  context: string;
};

const PREVIEW_LEAK = /\b(?:definitely|certainly|guaranteed|will (?:happen|improve|fail)|cannot be prevented|next (?:week|month|year)|entering (?:a|the) .{0,24}stage|decisive turning point|favorable timing)\b/i;
const DIRECTIVE = /\b(?:you should|you must|you need to|you have to|quit your|resign|buy (?:the|this|that)|sell (?:the|this|that)|stop taking|file (?:a|the) lawsuit)\b/i;
const IMPERATIVE_LINE = /(?:^|[.!?]\s+)(?:quit|resign|buy|sell|stop|start|take|file|plead|invest|leave)\b/im;
const ABSOLUTE_PREDICTION = /\b(?:definitely|certainly|guaranteed|inevitable|will happen|will succeed|will fail|cannot be prevented|without any doubt)\b/i;

function invalid(code: string): never {
  throw new Error(code);
}

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function expectedVariant(result: HexagramResult): ReadingVariant {
  const moving = result.movingLinePositions.length;
  if (moving === 0) return "still_hexagram";
  if (moving === 6) return "all_lines_moving";
  if (moving > 1) return "multiple_moving";
  return "standard";
}

function canonicalReference(value: ReadingReport["interpretiveBasisReferences"][number]): string {
  return JSON.stringify({
    referenceId: value.referenceId,
    sourceVersion: value.sourceVersion,
    hexagramNumber: value.hexagramNumber,
    linePosition: value.linePosition ?? null,
    kind: value.kind,
  });
}

function assertReferenceIntegrity(report: ReadingReport, result: HexagramResult): void {
  const expected = new Set(buildClassicReferences(result).map(canonicalReference));
  const actual = new Set(report.interpretiveBasisReferences.map(canonicalReference));
  if (expected.size !== actual.size || [...expected].some((reference) => !actual.has(reference))) {
    invalid("AI_REFERENCE_INTEGRITY_INVALID");
  }
}

function assertResultIntegrity(report: ReadingReport, result: HexagramResult): void {
  if (report.readingVariant !== expectedVariant(result)) {
    invalid("AI_RESULT_INTEGRITY_INVALID");
  }
  const mechanism = report.changeMechanism.toLowerCase();
  for (const linePosition of result.movingLinePositions) {
    if (!mechanism.includes(`line ${linePosition}`) && !mechanism.includes(`position ${linePosition}`)) {
      invalid("AI_RESULT_INTEGRITY_INVALID");
    }
  }
  if (result.movingLinePositions.length === 0 && !/\b(?:no moving line|still hexagram|stabilizing)\b/i.test(mechanism)) {
    invalid("AI_RESULT_INTEGRITY_INVALID");
  }
}

function assertMethodEvidenceDisclosed(report: ReadingReport, evidence: CastingMethodEvidence): void {
  const basis = report.interpretiveBasis.toLowerCase();
  switch (evidence.method) {
    case "three_coin":
      if (!/(?:six|6).{0,30}(?:three-coin|coin).{0,30}(?:round|record|value)/i.test(basis)) {
        invalid("AI_METHOD_EVIDENCE_OMITTED");
      }
      return;
    case "yarrow_stalk":
      if (!/(?:eighteen|18).{0,30}yarrow.{0,30}(?:change|record|remainder)/i.test(basis)) {
        invalid("AI_METHOD_EVIDENCE_OMITTED");
      }
      return;
    case "mei_hua_current_time":
      if (!/lunisolar/i.test(basis)
        || !/(?:time zone|timezone)/i.test(basis)
        || !/body/i.test(basis)
        || !/use/i.test(basis)) {
        invalid("AI_METHOD_EVIDENCE_OMITTED");
      }
      return;
    default: {
      const exhaustive: never = evidence;
      return exhaustive;
    }
  }
}

function assertContextRelevance(report: ReadingReport, input: OutputValidationInput): void {
  const stopWords = new Set(["about", "after", "before", "should", "could", "would", "their", "there", "which", "while", "considering"]);
  const tokens = input.context
    .normalize("NFKC")
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((token) => token.length >= 5 && !stopWords.has(token)) ?? [];
  const reportText = JSON.stringify(report).toLowerCase();
  if (tokens.length > 0 && !tokens.some((token) => reportText.includes(token))) {
    invalid("AI_CONTEXT_RELEVANCE_INVALID");
  }
}

function assertReadingStructure(report: ReadingReport): void {
  const sentenceCount = report.coreSummary.split(/[.!?]+/).filter((sentence) => sentence.trim()).length;
  if (sentenceCount < 3 || sentenceCount > 5) invalid("AI_OUTPUT_STRUCTURE_INVALID");
  if (!/\b(?:maintain|holding|current interpretation|support)\b/i.test(report.turningConditions)
    || !/\b(?:re-evaluate|reassess|reconsider|call for re-evaluation)\b/i.test(report.turningConditions)) {
    invalid("AI_OUTPUT_STRUCTURE_INVALID");
  }
}

function assertSafety(text: string): void {
  if (DIRECTIVE.test(text) || IMPERATIVE_LINE.test(text) || ABSOLUTE_PREDICTION.test(text)) {
    invalid("AI_OUTPUT_SAFETY_INVALID");
  }
}

export function validatePreviewOutput(output: unknown, input: OutputValidationInput): PreviewOutput {
  assertMethodEvidenceMatchesResult(input.methodEvidence, input.result);
  const parsed = previewOutputSchema.safeParse(output);
  if (!parsed.success) invalid("AI_OUTPUT_SCHEMA_INVALID");
  const words = countWords(parsed.data.relevanceStatement);
  if (words < 25 || words > 55) invalid("AI_PREVIEW_LENGTH_INVALID");
  if (DIRECTIVE.test(parsed.data.relevanceStatement) || PREVIEW_LEAK.test(parsed.data.relevanceStatement)) {
    invalid("AI_OUTPUT_SAFETY_INVALID");
  }
  const contextTokens = input.context.toLowerCase().match(/[a-z0-9]+/g)?.filter((token) => token.length >= 5) ?? [];
  if (contextTokens.length && !contextTokens.some((token) => parsed.data.relevanceStatement.toLowerCase().includes(token))) {
    invalid("AI_CONTEXT_RELEVANCE_INVALID");
  }
  return parsed.data;
}

export function validateReadingReport(output: unknown, input: OutputValidationInput): ReadingReport {
  const verifiedResult = verifiedHexagramResult(input.methodEvidence, input.result);
  const parsed = readingReportSchema.safeParse(output);
  if (!parsed.success) invalid("AI_OUTPUT_SCHEMA_INVALID");
  const report = parsed.data as ReadingReport;
  assertReadingStructure(report);
  assertResultIntegrity(report, verifiedResult);
  assertReferenceIntegrity(report, verifiedResult);
  assertMethodEvidenceDisclosed(report, input.methodEvidence);
  assertContextRelevance(report, input);
  assertSafety(JSON.stringify(report));
  return report;
}
