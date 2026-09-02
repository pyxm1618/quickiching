import {
  generatedReadingSchema,
  previewOutputSchema,
  type DeterministicFacts,
} from "@/domain/generation/schemas";
import { buildPreviewPrompt } from "./boundary";
import { buildDeepReadingPrompt } from "./deep-reading-prompt";
import type {
  OutputReviewDecision,
  OutputReviewer,
  PreviewProvider,
  ProviderGenerationResult,
  ProviderInput,
  ReadingProviderInput,
} from "./types";
import { z } from "zod";
import type { ZodType } from "zod";

type RuntimeEnv = Record<string, string | undefined>;

function required(env: RuntimeEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error("AI_ADAPTER_CONFIGURATION_UNAVAILABLE");
  return value;
}

function positiveInteger(env: RuntimeEnv, name: string): number | undefined {
  const value = env[name]?.trim();
  if (!value) return undefined;
  if (!/^\d+$/.test(value) || Number(value) < 1 || !Number.isSafeInteger(Number(value))) {
    throw new Error("AI_ADAPTER_CONFIGURATION_UNAVAILABLE");
  }
  return Number(value);
}

function configured(env: RuntimeEnv): boolean {
  return env.AI_ADAPTER_MODE === "ai-sdk"
    && Boolean(env.AI_GATEWAY_API_KEY?.trim())
    && Boolean(env.AI_GATEWAY_BASE_URL?.trim())
    && Boolean(env.AI_SDK_GATEWAY_BASE_URL?.trim())
    && Boolean(env.AI_MODEL_PREVIEW?.trim())
    && Boolean(env.AI_MODEL_OUTPUT_REVIEW?.trim())
    && Boolean(env.AI_MAX_OUTPUT_TOKENS?.trim())
    && Boolean(env.AI_MAX_REVIEW_OUTPUT_TOKENS?.trim());
}

function usage(value: unknown): ProviderGenerationResult["tokenUsage"] {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as { inputTokens?: unknown; outputTokens?: unknown; totalTokens?: unknown };
  const integer = (candidateValue: unknown) => typeof candidateValue === "number" && Number.isSafeInteger(candidateValue) && candidateValue >= 0
    ? candidateValue
    : undefined;
  return {
    input: integer(candidate.inputTokens),
    output: integer(candidate.outputTokens),
    total: integer(candidate.totalTokens),
  };
}

function providerRequestId(result: { response?: { id?: unknown } }): string | undefined {
  return typeof result.response?.id === "string" ? result.response.id : undefined;
}

// The upstream is an OpenAI-compatible endpoint reached directly, not Vercel's
// AI Gateway. The AI_GATEWAY_* names are kept because they are what the
// capability matrix declares as dependencies; "gateway" here means whichever
// endpoint serves the models, currently DeepSeek.
function gatewayOptions(env: RuntimeEnv): { apiKey: string; baseURL: string } {
  return {
    apiKey: required(env, "AI_GATEWAY_API_KEY"),
    baseURL: required(env, "AI_SDK_GATEWAY_BASE_URL"),
  };
}

export function assertAiSdkAdapterConfigured(env: RuntimeEnv = process.env): void {
  if (!configured(env)) throw new Error("AI_ADAPTER_CONFIGURATION_UNAVAILABLE");
  if (positiveInteger(env, "AI_MAX_OUTPUT_TOKENS") === undefined) {
    throw new Error("AI_ADAPTER_CONFIGURATION_UNAVAILABLE");
  }
  if (positiveInteger(env, "AI_MAX_REVIEW_OUTPUT_TOKENS") === undefined) {
    throw new Error("AI_ADAPTER_CONFIGURATION_UNAVAILABLE");
  }
}

export async function createAiSdkGenerationProvider(env: RuntimeEnv = process.env): Promise<PreviewProvider> {
  assertAiSdkAdapterConfigured(env);
  const [{ generateText, Output }, { createDeepSeek }] = await Promise.all([
    import("ai"),
    import("@ai-sdk/deepseek"),
  ]);
  const gateway = createDeepSeek(gatewayOptions(env));
  const previewModel = required(env, "AI_MODEL_PREVIEW");
  const deepReadingModel = env.AI_MODEL_DEEP_READING?.trim();
  const maxOutputTokens = positiveInteger(env, "AI_MAX_OUTPUT_TOKENS");

  async function generateObject(
    input: ProviderInput,
    model: string,
    system: string,
    user: string,
    schema: ZodType<unknown>,
    signal: AbortSignal,
  ): Promise<ProviderGenerationResult> {
    const result = await generateText({
      model: gateway.languageModel(model),
      system,
      prompt: user,
      output: Output.object({ schema }),
      maxRetries: 0,
      ...(maxOutputTokens ? { maxOutputTokens } : {}),
      abortSignal: signal,
      // Keep request and response bodies out of SDK result/telemetry retention.
      include: { requestBody: false, requestMessages: false, responseBody: false },
    });
    if (!result.output) throw new Error("AI_SCHEMA_INVALID");
    return {
      output: result.output,
      deterministicFacts: input.facts,
      requestId: providerRequestId(result),
      tokenUsage: usage(result.usage),
    };
  }

  return {
    provider: "vercel-ai-gateway",
    model: previewModel,
    generatePreview(input, signal) {
      const prompt = buildPreviewPrompt(input);
      return generateObject(input, previewModel, prompt.system, prompt.user, previewOutputSchema, signal);
    },
    generateReading(input, signal) {
      if (!deepReadingModel) return Promise.reject(new Error("DEEP_READING_NOT_CONFIGURED"));
      // The verdict is decided before the model is called; the prompt carries it
      // in as fixed input and the model only returns its application.
      const prompt = buildDeepReadingPrompt(input);
      return generateObject(input, deepReadingModel, prompt.system, prompt.user, generatedReadingSchema, signal);
    },
  };
}

export async function createAiSdkOutputReviewer(env: RuntimeEnv = process.env): Promise<OutputReviewer> {
  assertAiSdkAdapterConfigured(env);
  const [{ generateText, Output }, { createDeepSeek }] = await Promise.all([
    import("ai"),
    import("@ai-sdk/deepseek"),
  ]);
  const gateway = createDeepSeek(gatewayOptions(env));
  const model = required(env, "AI_MODEL_OUTPUT_REVIEW");
  const maxOutputTokens = positiveInteger(env, "AI_MAX_REVIEW_OUTPUT_TOKENS");
  const reviewSchema = z.object({
    status: z.enum(["pass", "fail"]),
    reasonCodes: z.array(z.string().min(1).max(80)).max(10),
    schemaValid: z.boolean(),
    safetyPass: z.boolean(),
    factConsistencyPass: z.boolean(),
  }).strict();

  return {
    reviewerModel: model,
    async review(input, signal): Promise<OutputReviewDecision> {
      const result = await generateText({
        model: gateway.languageModel(model),
        system: "Review only the supplied structured output and verified facts. Do not infer or store user identity, question text, chain-of-thought, or provider raw output. Return only the review schema.",
        prompt: JSON.stringify({ output: input.output, verifiedFacts: input.facts }),
        output: Output.object({ schema: reviewSchema }),
        maxRetries: 0,
        ...(maxOutputTokens ? { maxOutputTokens } : {}),
        abortSignal: signal,
        include: { requestBody: false, requestMessages: false, responseBody: false },
      });
      if (!result.output) throw new Error("AI_SCHEMA_INVALID");
      return result.output;
    },
  };
}

export type { DeterministicFacts };
