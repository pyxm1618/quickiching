import type { Sql } from "postgres";
import type {
  RuntimeMaintenanceRepository,
  TimedOutJobRecovery,
} from "@/server/maintenance/runtime-maintenance";

export class PostgresRuntimeMaintenanceRepository implements RuntimeMaintenanceRepository {
  constructor(private readonly sql: Sql) {}

  async cleanupCastingAndTokens(now: Date): Promise<{
    expiredCastings: number;
    deletedTokens: number;
    deletedLocks: number;
  }> {
    return this.sql.begin(async (tx) => {
      const expired = await tx`
        update casting_sessions set lifecycle = 'expired', updated_at = ${now}
        where lifecycle in ('draft', 'casting', 'awaiting_reveal') and (
          (lifecycle = 'casting' and casting_expires_at is not null and casting_expires_at <= ${now})
          or (lifecycle = 'awaiting_reveal' and reveal_expires_at is not null and reveal_expires_at <= ${now})
        )
        returning id
      `;
      const intents = await tx`
        delete from login_intents
        where expires_at <= ${now} or (consumed_at is not null and consumed_at <= ${new Date(now.getTime() - 24 * 60 * 60 * 1000)})
        returning id
      `;
      const verifications = await tx`
        delete from verifications where expires_at <= ${now} returning id
      `;
      await tx`delete from sessions where expires_at <= ${now}`;
      const locks = await tx`delete from question_locks where locked_until <= ${now} returning winning_casting_id`;
      return {
        expiredCastings: expired.length,
        deletedTokens: intents.length + verifications.length,
        deletedLocks: locks.length,
      };
    });
  }

  async recoverTimedOutJobs(now: Date): Promise<TimedOutJobRecovery[]> {
    return this.sql.begin(async (tx) => {
      const rows = await tx`
        select id, attempts, reservation_id
        from generation_jobs
        where status = 'running' and timeout_at <= ${now}
        order by timeout_at
        for update skip locked
        limit 100
      `;
      const recoveries: TimedOutJobRecovery[] = [];
      for (const row of rows) {
        const terminal = Number(row.attempts) >= 3;
        await tx`
          update generation_jobs set
            status = ${terminal ? "timed_out" : "queued"},
            generation_epoch = generation_epoch + 1,
            available_at = ${now},
            last_error_code = 'GENERATION_TIMEOUT',
            updated_at = ${now}
          where id = ${row.id}
        `;
        recoveries.push({
          jobId: String(row.id),
          terminal,
          reservationId: row.reservation_id == null ? null : String(row.reservation_id),
        });
      }
      return recoveries;
    });
  }

  async purgeDeletedCasts(now: Date): Promise<number> {
    const rows = await this.sql`
      delete from casting_sessions
      where lifecycle = 'user_deleted' and purge_after is not null and purge_after <= ${now}
      returning id
    `;
    return rows.length;
  }
}
