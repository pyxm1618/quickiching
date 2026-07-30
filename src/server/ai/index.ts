import type { HexagramResult, InterpretationGoal, Scene } from "@/domain/casting/types";
import { generateLocalPreview, generateLocalReading } from "./local-adapter";
import type { PreviewOutput, ReadingReport } from "@/domain/readings/types";
import { runtimeConfig } from "@/server/config";

// Adapter dispatch. Production target is AI SDK v6 + AI Gateway (G-06 pending). Until that is
// configured and passes the golden-standard eval, the deterministic local generator is used so
// the full flow runs offline. The interface is intentionally thin (§4.3 allowed boundaries).

export type GenerationInput = {
  result: HexagramResult;
  scene: Scene;
  interpretationGoal: InterpretationGoal;
  context: string;
};

export async function runPreview(input: GenerationInput): Promise<PreviewOutput> {
  const config = runtimeConfig();
  if (config.ai !== "local") throw new Error("AI_SDK_PATH_NOT_CONFIGURED");
  return generateLocalPreview({ result: input.result, scene: input.scene, context: input.context });
}

export async function runReading(input: GenerationInput): Promise<ReadingReport> {
  const config = runtimeConfig();
  if (config.ai !== "local") throw new Error("AI_SDK_PATH_NOT_CONFIGURED");
  return generateLocalReading({
    result: input.result,
    scene: input.scene,
    goal: input.interpretationGoal,
    context: input.context,
  });
}
