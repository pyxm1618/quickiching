import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";

type Row = Record<string, any>;

export interface PostgresAccountRepository {
  deleteAccount(userId: string): Promise<{ success: boolean }>;
}

export function createPostgresAccountRepository(dependencies: { sql: Sql }): PostgresAccountRepository {
  const { sql } = dependencies;

  return {
    async deleteAccount(userId): Promise<{ success: boolean }> {
      return sql.begin(async (transaction) => {
        const users = await transaction`select id, email from users where id = ${userId} limit 1 for update` as Row[];
        if (!users[0]) return { success: true };

        // Fence in-flight generation before releasing its reserved entitlement.
        await transaction`
          update generation_jobs
          set status = 'failed', structured_error_code = 'ACCOUNT_DELETED',
              lease_token = null, lease_expires_at = null, updated_at = clock_timestamp()
          where casting_id in (select id from casting_sessions where user_id = ${userId})
            and status in ('queued', 'running')
        `;
        await transaction`
          update workflow_runs
          set status = 'cancelled', error_code = 'ACCOUNT_DELETED', updated_at = clock_timestamp()
          where entity_id in (
            select id::text from casting_sessions where user_id = ${userId}
          ) and status in ('start_pending', 'pending', 'running')
        `;

        const activeReservations = await transaction`
          select id, batch_id from entitlement_reservations
          where user_id = ${userId} and status = 'reserved'
          for update
        ` as Row[];
        for (const res of activeReservations) {
          await transaction`
            update entitlement_reservations
            set status = 'released', lease_token = null, lease_expires_at = null, updated_at = clock_timestamp()
            where id = ${res.id} and status = 'reserved'
          `;
          await transaction`
            update entitlement_batches
            set quantity_reserved = greatest(0, quantity_reserved - 1),
                quantity_available = quantity_available + 1, updated_at = clock_timestamp()
            where id = ${res.batch_id}
          `;
          await transaction`
            insert into entitlement_ledger (id, batch_id, order_id, action, quantity, business_key, created_at)
            select ${randomUUID()}, ${res.batch_id}, b.order_id, 'release', 1,
                   ${`release:${res.id}`}, clock_timestamp()
            from entitlement_batches b where b.id = ${res.batch_id}
            on conflict (business_key) do nothing
          `;
        }

        // The immutable deep-reading table has one transaction-local privacy
        // erasure exception. Ordinary UPDATE/DELETE remains blocked by DB trigger.
        await transaction`select set_config('quickiching.privacy_erasure', 'on', true)`;
        await transaction`
          delete from deep_reading_context_snapshots
          where casting_id in (select id from casting_sessions where user_id = ${userId})
        `;
        await transaction`
          delete from deep_reading_results
          where casting_id in (select id from casting_sessions where user_id = ${userId})
        `;
        await transaction`
          delete from preview_results
          where casting_id in (select id from casting_sessions where user_id = ${userId})
        `;
        await transaction`
          delete from question_versions
          where casting_id in (select id from casting_sessions where user_id = ${userId})
        `;

        // Retain non-content casting rows only as de-identified tombstones so
        // financial/audit FKs remain valid without retaining user-authored context.
        await transaction`
          update casting_sessions
          set deleted_at = coalesce(deleted_at, clock_timestamp()),
              lifecycle = 'user_deleted', scene = 'deleted', interpretation_goal = 'deleted',
              question_fingerprint = null, fingerprint_key_version = null,
              updated_at = clock_timestamp()
          where user_id = ${userId}
        `;

        await transaction`delete from sessions where user_id = ${userId}`;
        await transaction`delete from accounts where user_id = ${userId}`;

        // Existing immutable audit rows permit only user_id -> NULL. Payment and
        // entitlement rows retain the pseudonymous user FK for financial integrity.
        await transaction`update audit_events set user_id = null where user_id = ${userId}`;
        await transaction`
          update users
          set name = 'Deleted User', email = ${`deleted_${randomUUID()}@deleted.local`},
              email_verified = false, image = null, updated_at = clock_timestamp()
          where id = ${userId}
        `;
        await transaction`
          insert into audit_events (
            id, category, action, entity_type, entity_id, user_id, payload, created_at
          ) values (
            ${randomUUID()}, 'deletion', 'account_deleted', 'user', null, null,
            '{"action":"user_content_erased","reason":"user_requested"}'::jsonb,
            clock_timestamp()
          )
        `;

        return { success: true };
      });
    },
  };
}
