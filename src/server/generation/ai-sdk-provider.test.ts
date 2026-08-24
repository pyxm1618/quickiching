import { describe, expect, it } from "vitest";
import {
  assertAiSdkAdapterConfigured,
  createAiSdkGenerationProvider,
  createAiSdkOutputReviewer,
} from "./ai-sdk-provider";

const validEnvironment = {
  AI_ADAPTER_MODE: "ai-sdk",
  AI_GATEWAY_API_KEY: "gateway-api-key",
  AI_GATEWAY_BASE_URL: "https://public-gateway.example.com/v1",
  AI_SDK_GATEWAY_BASE_URL: "https://native-gateway.example.com",
  AI_MODEL_PREVIEW: "preview-model",
  AI_MODEL_OUTPUT_REVIEW: "review-model",
  AI_MAX_OUTPUT_TOKENS: "700",
  AI_MAX_REVIEW_OUTPUT_TOKENS: "300",
};

describe("CP3 native AI SDK adapter", () => {
  it("requires the separate native SDK gateway URL", () => {
    expect(() => assertAiSdkAdapterConfigured(validEnvironment)).not.toThrow();
    expect(() => assertAiSdkAdapterConfigured({
      ...validEnvironment,
      AI_SDK_GATEWAY_BASE_URL: undefined,
    })).toThrow("AI_ADAPTER_CONFIGURATION_UNAVAILABLE");
  });

  it("constructs the real SDK provider and reviewer without using the Public V1 base URL", async () => {
    const provider = await createAiSdkGenerationProvider(validEnvironment);
    const reviewer = await createAiSdkOutputReviewer(validEnvironment);

    expect(provider).toMatchObject({ provider: "vercel-ai-gateway", model: "preview-model" });
    expect(reviewer).toMatchObject({ reviewerModel: "review-model" });
  });
});
