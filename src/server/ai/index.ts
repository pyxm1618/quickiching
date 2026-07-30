import type { HexagramResult, InterpretationGoal, Scene } from "@/domain/casting/types";
import { assertMethodEvidenceMatchesResult, type CastingMethodEvidence } from "@/domain/casting/method-evidence";
import { evaluateRisk } from "@/domain/risk/engine";
import type { PreviewOutput, ReadingReport } from "@/domain/readings/types";
import { DomainError } from "@/server/errors/domain-error";
import { runtimeConfig } from "@/server/config";
import { generateLocalPreview, generateLocalReading } from "./local-adapter";
import { validatePreviewOutput, validateReadingReport } from "./output-validator";

export type GenerationInput = {
  result: HexagramResult;
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
  generate(): Promise<unknown> | unknown;
  validate(output: unknown, input: GenerationInput): TOutput;
}): Promise<TOutput> {
  assertPersonalizedGenerationAllowed(input);
  const output = await operations.generate();
  const validated = operations.validate(output, input);
  // Deliberately re-run the current risk engine immediately before the caller may persist output
  // or consume an entitlement. Production adapters must use this same boundary.
  assertPersonalizedGenerationAllowed(input);
  return validated;
}

export async function runPreview(input: GenerationInput): Promise<PreviewOutput> {
  const config = runtimeConfig();
  if (config.ai !== "local") throw new Error("AI_SDK_PATH_NOT_CONFIGURED");
  return runRiskGatedGeneration(input, {
    generate: () => generateLocalPreview({
      result: input.result,
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
    generate: () => generateLocalReading({
      result: input.result,
      methodEvidence: input.methodEvidence,
      scene: input.scene,
      goal: input.interpretationGoal,
      context: input.context,
    }),
    validate: validateReadingReport,
  });
}
