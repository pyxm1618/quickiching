import type { InterpretationGoal, Scene } from "@/domain/casting/types";
import {
  assertMethodEvidenceMatchesResult,
  type CastingMethodEvidence,
  type MethodEvidenceResult,
  verifiedHexagramResult,
} from "@/domain/casting/method-evidence";
import { evaluateRisk } from "@/domain/risk/engine";
import type { PreviewOutput, ReadingReport } from "@/domain/readings/types";
import { DomainError } from "@/server/errors/domain-error";
import { runtimeConfig } from "@/server/config";
import { generateLocalPreview, generateLocalReading } from "./local-adapter";
import { validatePreviewOutput, validateReadingReport } from "./output-validator";

export type GenerationInput = {
  result: MethodEvidenceResult;
  methodEvidence: CastingMethodEvidence;
  scene: Scene;
  interpretationGoal: InterpretationGoal;
  context: string;
};

export function assertPersonalizedGenerationAllowed(input: GenerationInput): void {
  assertMethodEvidenceMatchesResult(input.methodEvidence, input.result);
  const decision = evaluateRisk(input.context, input.scene);
  if (decision.status !== "allowed") {
    throw new DomainError(
      "RISK_BLOCKED",
      "Personalized generation is not available for this question.",
      false,
    );
  }
}

export async function runRiskGatedGeneration<TOutput>(input: GenerationInput, operations: {
  generate(verifiedResult: ReturnType<typeof verifiedHexagramResult>): Promise<unknown> | unknown;
  validate(output: unknown, input: GenerationInput): TOutput;
}): Promise<TOutput> {
  assertPersonalizedGenerationAllowed(input);
  const verifiedResult = verifiedHexagramResult(input.methodEvidence, input.result);
  const output = await operations.generate(verifiedResult);
  const validated = operations.validate(output, input);
  // Re-run current evidence and risk rules immediately before the caller can persist output
  // or consume an entitlement. Production adapters must use this same boundary.
  assertPersonalizedGenerationAllowed(input);
  return validated;
}

export async function runPreview(input: GenerationInput): Promise<PreviewOutput> {
  const config = runtimeConfig();
  if (config.ai !== "local") throw new Error("AI_SDK_PATH_NOT_CONFIGURED");
  return runRiskGatedGeneration(input, {
    generate: (result) => generateLocalPreview({
      result,
      scene: input.scene,
      context: input.context,
    }),
    validate: validatePreviewOutput,
  });
}

export async function runReading(input: GenerationInput): Promise<ReadingReport> {
  const config = runtimeConfig();
  if (config.ai !== "local") throw new Error("AI_SDK_PATH_NOT_CONFIGURED");
  return runRiskGatedGeneration(input, {
    generate: (result) => generateLocalReading({
      result,
      methodEvidence: input.methodEvidence,
      scene: input.scene,
      goal: input.interpretationGoal,
      context: input.context,
    }),
    validate: validateReadingReport,
  });
}
