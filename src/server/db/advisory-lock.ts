import type { Sql } from "postgres";

export type AdvisoryLockResult<T> =
  | { acquired: false }
  | { acquired: true; value: T };

export async function withPostgresAdvisoryTransactionLock<T>(
  sql: Sql,
  lockName: string,
  operation: () => Promise<T>,
): Promise<AdvisoryLockResult<T>> {
  if (!lockName.trim()) throw new Error("ADVISORY_LOCK_NAME_REQUIRED");

  return sql.begin(async (tx) => {
    const rows = await tx`
      select pg_try_advisory_xact_lock(hashtextextended(${lockName}, 0)) as acquired
    `;
    if (rows[0]?.acquired !== true) return { acquired: false as const };
    return { acquired: true as const, value: await operation() };
  });
}
