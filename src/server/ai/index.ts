import type { ContentLocale } from "@/i18n/config";
import type { HexagramResult, InterpretationGoal, Scene } from "@/domain/casting/types";
import { generateLocalPreview, generateLocalReading } from "./local-adapter";
import type { CommercialReadingReportV2 } from "@/domain/generation/schemas";
import type { PreviewOutput } from "@/domain/readings/types";
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

// The deep reading is written in one language and stored with it. The locale is
// resolved by the caller and passed in explicitly; it is never defaulted here,
// so a reading can never be generated for a language nobody asked for.
export type ReadingGenerationInput = GenerationInput & { locale: ContentLocale };

export async function runPreview(input: GenerationInput): Promise<PreviewOutput> {
  const config = runtimeConfig();
  if (config.ai !== "local") throw new Error("AI_SDK_PATH_NOT_CONFIGURED");
  return generateLocalPreview({ result: input.result, scene: input.scene, context: input.context });
}

export async function runReading(input: ReadingGenerationInput): Promise<CommercialReadingReportV2> {
  const config = runtimeConfig();
  if (config.ai !== "local") throw new Error("AI_SDK_PATH_NOT_CONFIGURED");
  return generateLocalReading({
    result: input.result,
    scene: input.scene,
    goal: input.interpretationGoal,
    context: input.context,
    locale: input.locale,
  });
}
