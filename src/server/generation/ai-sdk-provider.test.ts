import { describe, expect, it } from "vitest";
import { buildDeepReadingPrompt, assertAiSdkAdapterConfigured } from "./ai-sdk-provider";
import type { ProviderInput } from "./types";

const input: ProviderInput = {
  castingId: "cast-1",
  question: "Should I accept the new role this season?",
  scene: "career",
  interpretationGoal: "what_do_i_need_to_see_clearly",
  facts: {
    method: "three_coin",
    algorithmVersion: "three-coin-v1",
    classicMappingVersion: "king-wen-v1",
    lineValuesBottomUp: [7, 8, 7, 8, 7, 8],
    primaryHexagramNumber: 11,
    movingLinePositions: [],
    relatingHexagramNumber: null,
    readingVariant: "still_hexagram",
  },
  context: {
    contextNotes: "I have a stable team but little room to grow in my current role.",
    options: ["Stay in my current role", "Accept a role at a smaller company"],
    constraints: ["I need to keep my current income stable"],
    concerns: ["I am concerned about the smaller company's runway"],
    interpretationGoal: "what_do_i_need_to_see_clearly",
    locale: "en",
  },
  knowledge: {
    version: "fixture-v1",
    primary: {
      number: 11,
      name: "Peace",
      chineseName: "Tai",
      judgment: "Fixture judgment",
      image: "Fixture image",
      interpretation: {
        coreTheme: "Fixture theme",
        coreMeaning: "Fixture meaning",
        strength: "Fixture strength",
        challenge: "Fixture challenge",
        orientation: "Fixture orientation",
        structureInterpretation: "Fixture structure",
        transitionTheme: "Fixture transition",
        stabilityTheme: "Fixture stability",
      },
    },
    changingLines: [],
    relating: null,
    structuralChange: "No lines change.",
    evidence: [{
      id: "primary.judgment",
      source: "king_wen_judgment",
      hexagramNumber: 11,
      content: "Fixture judgment",
    }],
  },
};

describe("paid Deep Reading AI adapter", () => {
  it("requires deep-reading and reviewer configuration", () => {
    const configured = {
      AI_ADAPTER_MODE: "ai-sdk",
      AI_GATEWAY_API_KEY: "gateway-api-key",
      AI_GATEWAY_BASE_URL: "https://public-gateway.example.com/v1",
      AI_SDK_GATEWAY_BASE_URL: "https://native-gateway.example.com",
      AI_MODEL_DEEP_READING: "deep-reading-model",
      AI_MODEL_OUTPUT_REVIEW: "review-model",
      AI_MAX_OUTPUT_TOKENS: "700",
      AI_MAX_REVIEW_OUTPUT_TOKENS: "300",
    };
    expect(() => assertAiSdkAdapterConfigured(configured)).not.toThrow();
    expect(() => assertAiSdkAdapterConfigured({
      ...configured,
      AI_MODEL_DEEP_READING: undefined,
    })).toThrow("AI_ADAPTER_CONFIGURATION_UNAVAILABLE");
  });

  it("grounds the report in the frozen question, context, exact cast, and supplied knowledge", () => {
    const prompt = buildDeepReadingPrompt(input);
    expect(prompt.system).toContain("English");
    expect(prompt.system).toContain("Do not claim that a transition or relating hexagram exists");
    expect(prompt.user).toContain(input.question);
    expect(prompt.user).toContain("I need to keep my current income stable");
    expect(prompt.user).toContain("primary.judgment");
    expect(prompt.user).toContain("No lines change.");
    expect(prompt.user).not.toContain("General I Ching Reading");
  });

  it("fails closed when the immutable context bundle is absent", () => {
    expect(() => buildDeepReadingPrompt({ ...input, context: undefined })).toThrow("DEEP_READING_CONTEXT_UNAVAILABLE");
    expect(() => buildDeepReadingPrompt({ ...input, knowledge: undefined })).toThrow("DEEP_READING_CONTEXT_UNAVAILABLE");
  });
});
