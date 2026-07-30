import { generateText, Output } from "ai";
import * as z from "zod";
import type { PreviewOutput, ReadingReport } from "@/domain/readings/types";
import type { GenerationInput } from "./index";
import { previewOutputSchema, readingReportSchema } from "./schemas";
import { validatePreviewOutput, validateReadingReport } from "./output-validator";
import { outputReviewPrompt, previewPrompt, readingPrompt } from "./prompts";

export type GenerationUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type GenerationAttemptAudit = {
  model: string;
  promptVersion: string;
  providerRequestId: string | null;
  usage: GenerationUsage;
};

type StructuredGenerationResult = {
  output: unknown;
  usage: GenerationUsage;
  providerRequestId: string | null;
};

type StructuredGenerationCall = {
  model: string;
  schema: z.ZodTypeAny;
  system: string;
  prompt: string;
  promptVersion: string;
};

export type StructuredGenerator = (input: StructuredGenerationCall) => Promise<StructuredGenerationResult>;

const outputReviewSchema = z.object({
  approved: z.boolean(),
  reasonCodes: z.array(z.string().trim().min(1).max(80)).max(12),
  notes: z.string().trim().min(1).max(1200),
}).strict();

async function sdkGenerate(input: StructuredGenerationCall): Promise<StructuredGenerationResult> {
  const result = await generateText({
    model: input.model,
    system: input.system,
    prompt: input.prompt,
    output: Output.object({
      name: input.promptVersion.replaceAll(".", "_"),
      schema: input.schema,
    }),
  });
  return {
    output: result.output,
    providerRequestId: result.response.id ?? null,
    usage: {
      inputTokens: result.totalUsage.inputTokens,
      outputTokens: result.totalUsage.outputTokens,
      totalTokens: result.totalUsage.totalTokens,
    },
  };
}

export class AiSdkGatewayProvider {
  private readonly generateStructured: StructuredGenerator;

  constructor(private readonly dependencies: {
    apiKey: string;
    models: { preview: string; reading: string; review: string };
    generateStructured?: StructuredGenerator;
  }) {
    if (!dependencies.apiKey) throw new Error("AI_GATEWAY_API_KEY_REQUIRED");
    this.generateStructured = dependencies.generateStructured ?? sdkGenerate;
  }

  async generatePreview(input: GenerationInput): Promise<{
    output: PreviewOutput;
    attempts: GenerationAttemptAudit[];
  }> {
    const prompt = previewPrompt(input);
    const generated = await this.generateStructured({
      model: this.dependencies.models.preview,
      schema: previewOutputSchema,
      system: prompt.system,
      prompt: prompt.prompt,
      promptVersion: prompt.version,
    });
    const output = validatePreviewOutput(generated.output, input);
    const review = await this.review(input, output);
    return {
      output,
      attempts: [this.audit(this.dependencies.models.preview, prompt.version, generated), review.audit],
    };
  }

  async generateReading(input: GenerationInput): Promise<{
    output: ReadingReport;
    attempts: GenerationAttemptAudit[];
  }> {
    const prompt = readingPrompt(input);
    const generated = await this.generateStructured({
      model: this.dependencies.models.reading,
      schema: readingReportSchema,
      system: prompt.system,
      prompt: prompt.prompt,
      promptVersion: prompt.version,
    });
    const output = validateReadingReport(generated.output, input);
    const review = await this.review(input, output);
    return {
      output,
      attempts: [this.audit(this.dependencies.models.reading, prompt.version, generated), review.audit],
    };
  }

  private async review(input: GenerationInput, candidate: unknown): Promise<{
    audit: GenerationAttemptAudit;
  }> {
    const prompt = outputReviewPrompt(input, candidate);
    const generated = await this.generateStructured({
      model: this.dependencies.models.review,
      schema: outputReviewSchema,
      system: prompt.system,
      prompt: prompt.prompt,
      promptVersion: prompt.version,
    });
    const review = outputReviewSchema.parse(generated.output);
    if (!review.approved) {
      throw new Error(`AI_OUTPUT_REVIEW_REJECTED:${review.reasonCodes.join(",") || "unspecified"}`);
    }
    return { audit: this.audit(this.dependencies.models.review, prompt.version, generated) };
  }

  private audit(
    model: string,
    promptVersion: string,
    result: StructuredGenerationResult,
  ): GenerationAttemptAudit {
    return {
      model,
      promptVersion,
      providerRequestId: result.providerRequestId,
      usage: result.usage,
    };
  }
}
