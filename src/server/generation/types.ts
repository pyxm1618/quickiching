import type { ContentLocale } from "@/i18n/config";
import type { InterpretationGoal, RiskStatus, Scene } from "@/domain/casting/types";
import type { DeterministicVerdict } from "@/domain/interpretation/deterministic/verdict";
import type {
  CommercialPreviewOutput,
  DeterministicFacts,
} from "@/domain/generation/schemas";

export type GenerationJobStatus = "queued" | "running" | "completed" | "failed" | "timed_out" | "dead_letter";

export type PreviewGenerationContext = {
  castingId: string;
  userId: string | null;
  lifecycle: string;
  riskStatus: RiskStatus;
  riskRuleVersion: string | null;
  generationEpoch: number;
  deletedAt?: Date | null;
  question: string;
  questionFingerprint?: string | null;
  scene: Scene;
  interpretationGoal: InterpretationGoal;
  facts: DeterministicFacts;
  resultHmac: string;
  resultHmacKeyVersion: string;
  resultIntegrityValid?: boolean;
};

export type GenerationJobRecord = {
  id: string;
  castingId: string;
  kind: "preview" | "deep_reading";
  status: GenerationJobStatus;
  generationEpoch: number;
  idempotencyKey: string;
  inputSnapshotHash: string;
  attemptCount: number;
  leaseToken: string | null;
  leaseExpiresAt: Date | null;
  provider: string | null;
  model: string | null;
  structuredErrorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PreviewResultRecord = {
  castingId: string;
  jobId: string;
  output: CommercialPreviewOutput;
  schemaVersion: string;
  promptVersion: string;
  provider: string;
  model: string;
  integrityHash: string;
  persistedAt: Date;
};

export type ProviderInput = {
  castingId: string;
  question: string;
  scene: Scene;
  interpretationGoal: InterpretationGoal;
  facts: DeterministicFacts;
};

// Deep reading additionally carries the deterministic verdict. It is required
// rather than optional: the model must never be asked for a reading without the
// decided direction and the selected classical text.
export type ReadingProviderInput = ProviderInput & {
  verdict: DeterministicVerdict;
  locale: ContentLocale;
};

export type ProviderGenerationResult = {
  output: unknown;
  deterministicFacts: unknown;
  requestId?: string;
  tokenUsage?: { input?: number; output?: number; total?: number };
  costMetadata?: Record<string, string | number | boolean | null>;
};

export interface PreviewProvider {
  readonly provider: string;
  readonly model: string;
  generatePreview(input: ProviderInput, signal: AbortSignal): Promise<ProviderGenerationResult>;
  generateReading(input: ReadingProviderInput, signal: AbortSignal): Promise<ProviderGenerationResult>;
}

export type OutputReviewInput = {
  kind: "preview" | "deep_reading";
  output: unknown;
  facts: DeterministicFacts;
};

export type OutputReviewDecision = {
  status: "pass" | "fail";
  reasonCodes: string[];
  schemaValid: boolean;
  safetyPass: boolean;
  factConsistencyPass: boolean;
};

export interface OutputReviewer {
  readonly reviewerModel: string;
  review(input: OutputReviewInput, signal: AbortSignal): Promise<OutputReviewDecision>;
}

export type CreateJobInput = {
  castingId: string;
  userId: string;
  kind: "preview";
  generationEpoch: number;
  idempotencyKey: string;
  inputSnapshotHash: string;
  timeoutMs?: number;
  now: Date;
};

export type PersistPreviewSuccessInput = {
  jobId: string;
  leaseToken: string;
  userId: string;
  generationEpoch: number;
  inputSnapshotHash: string;
  output: CommercialPreviewOutput;
  review: OutputReviewDecision;
  provider: string;
  model: string;
  reviewerModelVersion: string;
  providerRequestId?: string;
  tokenUsage?: ProviderGenerationResult["tokenUsage"];
  costMetadata?: ProviderGenerationResult["costMetadata"];
  now: Date;
};

export interface PreviewGenerationRepository {
  getPreviewContext(castingId: string): Promise<PreviewGenerationContext | null>;
  getPreview(castingId: string): Promise<PreviewResultRecord | null>;
  getJobStatus(castingId: string, idempotencyKey?: string): Promise<GenerationJobRecord | null>;
  createOrReuseJob(input: CreateJobInput): Promise<{ job: GenerationJobRecord; created: boolean }>;
  markJobRunning(input: { jobId: string; leaseToken: string; now: Date; leaseDurationMs: number }): Promise<boolean>;
  persistPreviewSuccess(input: PersistPreviewSuccessInput): Promise<PreviewResultRecord>;
  markJobFailed(input: {
    jobId: string;
    leaseToken: string;
    status: Extract<GenerationJobStatus, "failed" | "timed_out" | "dead_letter">;
    errorCode: string;
    now: Date;
  }): Promise<void>;
}

export type PreviewGenerationResult = {
  status: Extract<GenerationJobStatus, "queued" | "running" | "completed" | "failed" | "timed_out" | "dead_letter">;
  jobId: string;
  result?: PreviewResultRecord;
  retryable?: boolean;
};
