import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import { DomainError } from "@/server/errors/domain-error";

const RECOVERY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function id(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
}

function asDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

export class PostgresPrivacyLifecycleService {
  constructor(private readonly database: Sql) {}

  async requestCastingDeletion(input: {
    castingId: string;
    userId: string;
  }): Promise<{ deleted: true; purgeAfter: Date }> {
    return this.database.begin(async (tx) => {
      // Use the exact same advisory-lock identity as generation enqueue.
      await tx`select pg_advisory_xact_lock(hashtextextended(${`${input.castingId}:preview`}, 0))`;
      await tx`select pg_advisory_xact_lock(hashtextextended(${`${input.castingId}:deep_reading`}, 0))`;
      const clockRows = await tx`select clock_timestamp() as now`;
      const now = asDate(clockRows[0].now);

      const castingRows = await tx`
        select * from casting_sessions
        where id = ${input.castingId} and user_id = ${input.userId}
          and lifecycle = 'revealed' and deleted_at is null
        for update
      `;
      if (!castingRows[0]) {
        throw new DomainError(
          "CASTING_NOT_DELETABLE",
          "This casting cannot be deleted in its current state.",
          false,
        );
      }

      const jobs = await tx`
        select * from generation_jobs
        where casting_session_id = ${input.castingId}
          and status in ('queued', 'running')
        for update
      `;
      for (const job of jobs) {
        await tx`
          update generation_attempts set
            status = 'failed', error_code = 'CASTING_DELETED',
            error_class = 'terminal', finished_at = ${now}
          where job_id = ${job.id} and status = 'running'
        `;
        await tx`
          update outbox set dispatched_at = coalesce(dispatched_at, ${now})
          where aggregate_id = ${job.id} and dispatched_at is null
        `;

        if (job.job_type === "preview") {
          await tx`
            update previews set status = 'failed', relevance_statement = null, updated_at = ${now}
            where casting_session_id = ${input.castingId}
              and status in ('queued', 'generating')
          `;
        } else if (job.reading_id) {
          const readingRows = await tx`
            select * from readings where id = ${job.reading_id} for update
          `;
          const reading = readingRows[0];
          if (reading?.reservation_id) {
            const reservationRows = await tx`
              select * from reservations where id = ${reading.reservation_id} for update
            `;
            const reservation = reservationRows[0];
            if (reservation?.status === "reserved") {
              const batchRows = await tx`
                select * from entitlement_batches where id = ${reservation.batch_id} for update
              `;
              const batch = batchRows[0];
              if (batch) {
                const expired = asDate(batch.expires_at).getTime() <= now.getTime();
                await tx`
                  update entitlement_batches set
                    quantity_reserved = quantity_reserved - 1,
                    quantity_available = quantity_available + ${expired ? 0 : 1},
                    quantity_revoked = quantity_revoked + ${expired ? 1 : 0},
                    updated_at = ${now}
                  where id = ${batch.id}
                `;
                await tx`
                  update reservations set
                    status = ${expired ? "expired" : "released"}, updated_at = ${now}
                  where id = ${reservation.id}
                `;
                await tx`
                  insert into entitlement_ledger (
                    id, batch_id, order_id, action, quantity, reading_id,
                    reservation_id, reason_code, created_at
                  ) values (
                    ${id("led")}, ${batch.id}, ${batch.order_id ?? null},
                    ${expired ? "revoke" : "release"}, 1, ${reading.id},
                    ${reservation.id}, 'casting_deleted', ${now}
                  )
                `;
              }
            }
          }
          await tx`
            update readings set status = 'failed', reservation_id = null,
              generation_epoch = greatest(generation_epoch, ${Number(job.generation_epoch) + 1}),
              updated_at = ${now}
            where id = ${job.reading_id} and status <> 'completed'
          `;
        }

        await tx`
          update generation_jobs set status = 'cancelled',
            generation_epoch = generation_epoch + 1,
            error_code = 'CASTING_DELETED', last_error_code = 'CASTING_DELETED',
            completed_at = ${now}, updated_at = ${now}
          where id = ${job.id}
        `;
      }

      const purgeAfter = new Date(now.getTime() + RECOVERY_WINDOW_MS);
      await tx`
        update casting_sessions set lifecycle = 'user_deleted', deleted_at = ${now},
          purge_after = ${purgeAfter}, updated_at = ${now}
        where id = ${input.castingId}
      `;
      return { deleted: true as const, purgeAfter };
    });
  }

  async restoreCasting(input: {
    castingId: string;
    userId: string;
  }): Promise<{ restored: true }> {
    const rows = await this.database`
      update casting_sessions set lifecycle = 'revealed', deleted_at = null,
        purge_after = null, updated_at = clock_timestamp()
      where id = ${input.castingId} and user_id = ${input.userId}
        and lifecycle = 'user_deleted' and purge_after > clock_timestamp()
      returning id
    `;
    if (!rows[0]) {
      throw new DomainError(
        "DELETION_RECOVERY_CLOSED",
        "This casting can no longer be restored.",
        false,
      );
    }
    return { restored: true };
  }
}
