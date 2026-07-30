import type { HexagramResult, InterpretationGoal, Scene } from "@/domain/casting/types";
import { evaluateRisk } from "@/domain/risk/engine";
import type { PreviewOutput, ReadingReport } from "@/domain/readings/types";
import { DomainError } from "@/server/errors/domain-error";
import { runtimeConfig } from "@/server/config";
import { generateLocalPreview, generateLocalReading } from "./local-adapter";
import { validatePreviewOutput, validateReadingReport } from "./output-validator";

export type GenerationInput = {
  result: HexagramResult;
  scene: Scene;
  interpretationGoal: InterpretationGoal;
  context: string;
};

function assertPersonalizedGenerationAllowed(input: GenerationInput): void {
  const decision = evaluateRisk(input.context, input.scene);
  if (decision.status !== "allowed") {
    throw new DomainError(
      "RISK_BLOCKED",
      "Personalized generation is not available for this question.",
      false,
    );
  }
}

export async function runPreview(input: GenerationInput): Promise<PreviewOutput> {
  assertPersonalizedGenerationAllowed(input);
  const config = runtimeConfig();
  if (config.ai !== "local") throw new Error("AI_SDK_PATH_NOT_CONFIGURED");
  const output = validatePreviewOutput(
    generateLocalPreview({ result: input.result, scene: input.scene, context: input.context }),
    input,
  );
  assertPersonalizedGenerationAllowed(input);
  return output;
}

export async function runReading(input: GenerationInput): Promise<ReadingReport> {
  assertPersonalizedGenerationAllowed(input);
  const config = runtimeConfig();
  if (config.ai !== "local") throw new Error("AI_SDK_PATH_NOT_CONFIGURED");
  const output = validateReadingReport(generateLocalReading({
    result: input.result,
    scene: input.scene,
    goal: input.interpretationGoal,
    context: input.context,
  }), input);
  assertPersonalizedGenerationAllowed(input);
  return output;
}
