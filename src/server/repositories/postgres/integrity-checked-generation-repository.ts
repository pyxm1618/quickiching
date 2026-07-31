import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import { decryptJson, encryptJson, type EncryptedBlob } from "@/lib/crypto";
import { DomainError } from "@/server/errors/domain-error";
import { PostgresResultIntegrityService } from "@/server/runtime/postgres-result-integrity";
import {
  PostgresGenerationRepository,
  type GenerationSnapshot,
} from "./generation-repository";

const JOB_TIMEOUT_MS = 5 * 60_000;

function id(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
}

function rowDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

function encryptedBlob(value: unknown): EncryptedBlob {
  if (!value || typeof value !== "object") throw new Error("GENERATION_SNAPSHOT_INVALID");
  const record = value as Record<string, unknown>;
  if (![record.v, record.iv, record.tag, record.data].every((part) => typeof part === "string")) {
    throw new Error("GENERATION_SNAPSHOT_INVALID");
  }
  return record as EncryptedBlob;
}

export class IntegrityCheckedPostgresGenerationRepository extends PostgresGenerationRepository {
  constructor(
    private readonly database: Sql,
    private readonly resultIntegrity: PostgresResultIntegrityService,
  ) {
    super(database);
  }

  override async enqueuePreview(
    input: Parameters<PostgresGenerationRepository["enqueuePreview"]>[0],
  ) {
    await this.assertAuthorized(input.castingId, input.userId);
    await this.resultIntegrity.assertValid(input.castingId);
    return super.enqueuePreview(input);
  }

  override async enqueueDeepReading(
    input: Parameters<PostgresGenerationRepository["enqueueDeepReading"]>[0],
  ) {
    await this.assertAuthorized(input.castingId, input.userId);
    await this.resultIntegrity.assertValid(input.castingId);
    return super.enqueueDeepReading(input);
  }

  override async failAttempt(
    input: Parameters<PostgresGenerationRepository["failAttempt"]>[0],
  ): Promise<{ accepted: boolean }> {
    return this.database.begin(async (tx) => {
      const now = await this.databaseClock(tx);
      const rows = await tx`select * from generation_jobs where id = ${input.jobId} for update`;
      const job = rows[0];
      if (!job || Number(job.generation_epoch) !== input.generationEpoch || job.status !== "running") {
        return { accepted: false };
      }

      await tx`
        update generation_attempts set status = 'failed', error_code = ${input.errorCode},
          error_class = ${input.retryable ? "retryable" : "terminal"}, finished_at = ${now}
        where job_id = ${input.jobId} and generation_epoch = ${input.generationEpoch}
          and attempt_number = ${job.attempts}
      `;

      if (job.job_type === "preview") {
        await tx`
          update previews set status = 'failed', relevance_statement = null, updated_at = ${now}
          where casting_session_id = ${job.casting_session_id}
        `;
      } else if (job.reading_id) {
        await this.releaseReadingReservation(tx, String(job.reading_id), now, "generation_failure");
      }

      await tx`
        update generation_jobs set status = 'failed', error_code = ${input.errorCode},
          last_error_code = ${input.errorCode}, completed_at = ${now}, updated_at = ${now}
        where id = ${input.jobId}
      `;
      return { accepted: true };
    });
  }

  override async retry(
    input: Parameters<PostgresGenerationRepository["retry"]>[0],
  ): Promise<{ jobId: string; generationEpoch: number; status: "queued" }> {
    return this.database.begin(async (tx) => {
      const now = await this.databaseClock(tx);
      const rows = await tx`select * from generation_jobs where id = ${input.jobId} for update`;
      const job = rows[0];
      if (!job || !["failed", "timed_out"].includes(String(job.status))) {
        throw new DomainError("GENERATION_RETRY_NOT_ALLOWED", "This generation cannot be retried.", false);
      }

      const currentEpoch = Number(job.generation_epoch);
      const nextEpoch = currentEpoch + 1;
      const snapshot = decryptJson<GenerationSnapshot>(
        encryptedBlob(job.snapshot),
        "context",
        `generation:${job.id}:${currentEpoch}`,
      );

      let nextSnapshot = snapshot;
      if (job.job_type === "preview") {
        await tx`
          update previews set status = 'queued', relevance_statement = null, updated_at = ${now}
          where casting_session_id = ${job.casting_session_id}
        `;
      } else {
        if (!job.reading_id) {
          throw new DomainError("READING_NOT_FOUND", "The reading is not available.", false);
        }
        const readings = await tx`select * from readings where id = ${job.reading_id} for update`;
        const reading = readings[0];
        if (!reading || reading.status === "completed") {
          throw new DomainError("GENERATION_RETRY_NOT_ALLOWED", "This generation cannot be retried.", false);
        }

        const batches = await tx`
          select * from entitlement_batches
          where user_id = ${snapshot.userId}
            and quantity_available > 0
            and expires_at > ${now}
          order by expires_at asc, created_at asc, id asc
          limit 1
          for update skip locked
        `;
        const batch = batches[0];
        if (!batch) {
          throw new DomainError("ENTITLEMENT_NOT_AVAILABLE", "You have no available reading credit.", false);
        }

        const reservationId = id("res");
        await tx`
          update entitlement_batches set
            quantity_available = quantity_available - 1,
            quantity_reserved = quantity_reserved + 1,
            updated_at = ${now}
          where id = ${batch.id}
        `;
        await tx`
          insert into reservations (id, reading_id, batch_id, status, created_at, updated_at)
          values (${reservationId}, ${reading.id}, ${batch.id}, 'reserved', ${now}, ${now})
        `;
        await tx`
          insert into entitlement_ledger (
            id, batch_id, order_id, action, quantity, reading_id, reservation_id,
            reason_code, created_at
          ) values (
            ${id("led")}, ${batch.id}, ${batch.order_id ?? null}, 'reserve', 1,
            ${reading.id}, ${reservationId}, 'generation_retry', ${now}
          )
        `;
        await tx`
          update readings set status = 'queued', reservation_id = ${reservationId},
            generation_epoch = ${nextEpoch}, updated_at = ${now}
          where id = ${reading.id}
        `;
        nextSnapshot = { ...snapshot, reservationId };
      }

      const encrypted = encryptJson(
        nextSnapshot,
        "context",
        undefined,
        `generation:${job.id}:${nextEpoch}`,
      );
      const timeoutAt = new Date(now.getTime() + JOB_TIMEOUT_MS);
      await tx`
        update generation_jobs set status = 'queued', generation_epoch = ${nextEpoch},
          snapshot = ${tx.json(encrypted as never)}, snapshot_encryption_key_version = ${encrypted.v},
          attempts = 0, available_at = ${now}, timeout_at = ${timeoutAt}, claimed_at = null,
          completed_at = null, workflow_run_id = null, worker_id = null, error_code = null,
          last_error_code = null, updated_at = ${now}
        where id = ${job.id}
      `;
      await tx`
        insert into outbox (id, topic, aggregate_id, payload, available_at, created_at)
        values (
          ${id("out")}, 'generation.requested', ${job.id},
          ${tx.json({ jobId: job.id, generationEpoch: nextEpoch } as never)}, ${now}, ${now}
        )
      `;
      return { jobId: String(job.id), generationEpoch: nextEpoch, status: "queued" };
    });
  }

  override async finalizePreview(
    input: Parameters<PostgresGenerationRepository["finalizePreview"]>[0],
  ) {
    const now = await this.databaseNow();
    if (!await this.completable(input.jobId, input.generationEpoch, "preview", now)) {
      await super.reconcileTimeouts(now);
      return { accepted: false as const, code: "LATE_RESULT_REJECTED" as const };
    }
    try {
      return await super.finalizePreview({ ...input, now });
    } catch (error) {
      if (!this.isLateCompletionError(error)) throw error;
      await super.reconcileTimeouts(await this.databaseNow());
      return { accepted: false as const, code: "LATE_RESULT_REJECTED" as const };
    }
  }

  override async finalizeReading(
    input: Parameters<PostgresGenerationRepository["finalizeReading"]>[0],
  ) {
    const now = await this.databaseNow();
    if (!await this.completable(input.jobId, input.generationEpoch, "deep_reading", now)) {
      await super.reconcileTimeouts(now);
      return { accepted: false as const, code: "LATE_RESULT_REJECTED" as const };
    }
    try {
      return await super.finalizeReading({ ...input, now });
    } catch (error) {
      if (!this.isLateCompletionError(error)) throw error;
      await super.reconcileTimeouts(await this.databaseNow());
      return { accepted: false as const, code: "LATE_RESULT_REJECTED" as const };
    }
  }

  override async reconcileTimeouts(_ignoredNow: Date) {
    return super.reconcileTimeouts(await this.databaseNow());
  }

  private async assertAuthorized(castingId: string, userId: string): Promise<void> {
    const rows = await this.database`
      select 1 from casting_sessions
      where id = ${castingId} and user_id = ${userId}
        and lifecycle = 'revealed' and deleted_at is null
      limit 1
    `;
    if (!rows[0]) {
      throw new DomainError("CASTING_NOT_FOUND", "Casting session not found.", false);
    }
  }

  private async completable(
    jobId: string,
    generationEpoch: number,
    jobType: "preview" | "deep_reading",
    now: Date,
  ): Promise<boolean> {
    const rows = await this.database`
      select 1 from generation_jobs
      where id = ${jobId} and generation_epoch = ${generationEpoch}
        and job_type = ${jobType} and status = 'running' and timeout_at > ${now}
      limit 1
    `;
    return Boolean(rows[0]);
  }

  private async databaseNow(): Promise<Date> {
    const rows = await this.database`select clock_timestamp() as now`;
    return rowDate(rows[0].now);
  }

  private async databaseClock(tx: Sql): Promise<Date> {
    const rows = await tx`select clock_timestamp() as now`;
    return rowDate(rows[0].now);
  }

  private async releaseReadingReservation(
    tx: Sql,
    readingId: string,
    now: Date,
    reasonCode: string,
  ): Promise<void> {
    const readings = await tx`select * from readings where id = ${readingId} for update`;
    const reading = readings[0];
    if (!reading) return;

    if (reading.reservation_id) {
      const reservations = await tx`
        select * from reservations where id = ${reading.reservation_id} for update
      `;
      const reservation = reservations[0];
      if (reservation?.status === "reserved") {
        const batches = await tx`
          select * from entitlement_batches where id = ${reservation.batch_id} for update
        `;
        const batch = batches[0];
        if (batch) {
          const expired = rowDate(batch.expires_at).getTime() <= now.getTime();
          await tx`
            update entitlement_batches set
              quantity_reserved = quantity_reserved - 1,
              quantity_available = quantity_available + ${expired ? 0 : 1},
              quantity_revoked = quantity_revoked + ${expired ? 1 : 0},
              updated_at = ${now}
            where id = ${batch.id}
          `;
          await tx`
            update reservations set status = ${expired ? "expired" : "released"}, updated_at = ${now}
            where id = ${reservation.id}
          `;
          await tx`
            insert into entitlement_ledger (
              id, batch_id, order_id, action, quantity, reading_id, reservation_id,
              reason_code, created_at
            ) values (
              ${id("led")}, ${batch.id}, ${batch.order_id ?? null},
              ${expired ? "revoke" : "release"}, 1, ${reading.id}, ${reservation.id},
              ${reasonCode}, ${now}
            )
          `;
        }
      }
    }

    await tx`
      update readings set status = 'failed', reservation_id = null, updated_at = ${now}
      where id = ${reading.id}
    `;
  }

  private isLateCompletionError(error: unknown): boolean {
    return error instanceof Error && error.message.includes("GENERATION_LATE_RESULT");
  }
}
