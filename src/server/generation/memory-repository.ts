import { randomUUID } from "node:crypto";
import { hashGenerationSnapshot } from "./boundary";
import type {
  CreateJobInput,
  GenerationJobRecord,
  PersistPreviewSuccessInput,
  PreviewGenerationContext,
  PreviewGenerationRepository,
  PreviewResultRecord,
} from "./types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class InMemoryPreviewGenerationRepository implements PreviewGenerationRepository {
  private context: PreviewGenerationContext;
  private readonly jobs = new Map<string, GenerationJobRecord>();
  private preview: PreviewResultRecord | null = null;
  readonly entitlementTouched = false;
  private readonly persistFailure: boolean;

  constructor(context: PreviewGenerationContext & { persistFailure?: boolean }) {
    this.context = clone(context);
    this.persistFailure = context.persistFailure === true;
  }

  async getPreviewContext(castingId: string): Promise<PreviewGenerationContext | null> {
    return this.context.castingId === castingId ? clone(this.context) : null;
  }

  async getPreview(castingId: string): Promise<PreviewResultRecord | null> {
    return this.preview?.castingId === castingId ? clone(this.preview) : null;
  }

  async getJobStatus(castingId: string, idempotencyKey?: string): Promise<GenerationJobRecord | null> {
    const matches = [...this.jobs.values()].filter((job) =>
      job.castingId === castingId && (idempotencyKey === undefined || job.idempotencyKey === idempotencyKey),
    );
    const job = matches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    return job ? clone(job) : null;
  }

  async createOrReuseJob(input: CreateJobInput): Promise<{ job: GenerationJobRecord; created: boolean }> {
    const existingByKey = [...this.jobs.values()].find((job) =>
      job.castingId === input.castingId && job.kind === input.kind && job.idempotencyKey === input.idempotencyKey,
    );
    if (existingByKey) return { job: clone(existingByKey), created: false };

    const completed = [...this.jobs.values()].find((job) =>
      job.castingId === input.castingId
      && job.kind === input.kind
      && job.status === "completed"
      && this.preview?.castingId === input.castingId
      && this.preview.jobId === job.id,
    );
    if (completed) return { job: clone(completed), created: false };

    const active = [...this.jobs.values()].find((job) =>
      job.castingId === input.castingId && job.kind === input.kind && ["queued", "running"].includes(job.status),
    );
    if (active) return { job: clone(active), created: false };

    const job: GenerationJobRecord = {
      id: `job_${randomUUID()}`,
      castingId: input.castingId,
      kind: input.kind,
      status: "queued",
      generationEpoch: input.generationEpoch,
      idempotencyKey: input.idempotencyKey,
      inputSnapshotHash: input.inputSnapshotHash,
      attemptCount: 0,
      leaseToken: null,
      leaseExpiresAt: null,
      provider: null,
      model: null,
      structuredErrorCode: null,
      createdAt: clone(input.now),
      updatedAt: clone(input.now),
    };
    this.jobs.set(job.id, job);
    return { job: clone(job), created: true };
  }

  async markJobRunning(input: { jobId: string; leaseToken: string; now: Date; leaseExpiresAt: Date }): Promise<boolean> {
    const job = this.jobs.get(input.jobId);
    if (!job || job.status !== "queued") return false;
    job.status = "running";
    job.attemptCount += 1;
    job.leaseToken = input.leaseToken;
    job.leaseExpiresAt = clone(input.leaseExpiresAt);
    job.updatedAt = clone(input.now);
    return true;
  }

  async persistPreviewSuccess(input: PersistPreviewSuccessInput): Promise<PreviewResultRecord> {
    if (this.persistFailure) throw new Error("DB_WRITE_FAILED");
    const job = this.jobs.get(input.jobId);
    if (
      !job
      || job.status !== "running"
      || job.leaseToken !== input.leaseToken
      || job.generationEpoch !== input.generationEpoch
      || job.inputSnapshotHash !== input.inputSnapshotHash
      || hashGenerationSnapshot({
        castingId: this.context.castingId,
        generationEpoch: this.context.generationEpoch,
        question: this.context.question,
        facts: this.context.facts,
      }) !== input.inputSnapshotHash
      || !job.leaseExpiresAt
      || job.leaseExpiresAt.getTime() <= input.now.getTime()
    ) {
      throw new Error("LATE_RESULT_REJECTED");
    }
    if (
      this.context.castingId !== job.castingId
      || this.context.generationEpoch !== input.generationEpoch
      || this.context.lifecycle !== "revealed"
      || this.context.riskStatus !== "allowed"
      || this.context.deletedAt != null
    ) {
      throw new Error("LATE_RESULT_REJECTED");
    }
    if (this.preview) return clone(this.preview);
    const result: PreviewResultRecord = {
      castingId: job.castingId,
      jobId: job.id,
      output: clone(input.output),
      schemaVersion: input.output.schemaVersion,
      promptVersion: "commercial-preview-prompt-v1",
      provider: input.provider,
      model: input.model,
      integrityHash: "memory-integrity",
      persistedAt: clone(input.now),
    };
    this.preview = result;
    job.status = "completed";
    job.provider = input.provider;
    job.model = input.model;
    job.leaseToken = null;
    job.leaseExpiresAt = null;
    job.updatedAt = clone(input.now);
    return clone(result);
  }

  async markJobFailed(input: {
    jobId: string;
    leaseToken: string;
    status: "failed" | "timed_out" | "dead_letter";
    errorCode: string;
    now: Date;
  }): Promise<void> {
    const job = this.jobs.get(input.jobId);
    if (!job || job.leaseToken !== input.leaseToken || ["completed", "failed", "timed_out", "dead_letter"].includes(job.status)) return;
    job.status = input.status;
    job.structuredErrorCode = input.errorCode;
    job.leaseToken = null;
    job.leaseExpiresAt = null;
    job.updatedAt = clone(input.now);
  }

  setContext(patch: Partial<PreviewGenerationContext>): void {
    this.context = { ...this.context, ...clone(patch) };
  }

  getPreviewSync(castingId: string): PreviewResultRecord | null {
    return this.preview?.castingId === castingId ? clone(this.preview) : null;
  }

  listJobs(): GenerationJobRecord[] {
    return [...this.jobs.values()].map(clone);
  }
}
