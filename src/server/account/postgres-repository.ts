import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";

type Row = Record<string, any>;

export type UserAccountSummary = {
  user: {
    id: string;
    email: string;
    name: string;
  };
  credits: {
    available: number;
    consumed: number;
  };
  orders: Array<{
    id: string;
    productKey: string;
    quantity: number;
    amountMinor: number;
    currency: string;
    status: string;
    paidAt: string | null;
    createdAt: string;
  }>;
  castings: Array<{
    id: string;
    method: string;
    scene: string;
    interpretationGoal: string;
    createdAt: string;
  }>;
};

export interface PostgresAccountRepository {
  getAccountSummary(userId: string): Promise<UserAccountSummary>;
  deleteAccount(userId: string): Promise<{ success: boolean }>;
}

export function createPostgresAccountRepository(dependencies: { sql: Sql }): PostgresAccountRepository {
  const { sql } = dependencies;

  return {
    async getAccountSummary(userId): Promise<UserAccountSummary> {
      const userRows = await sql`
        select id, email, name from users where id = ${userId} limit 1
      ` as Row[];
      const user = userRows[0];
      if (!user) throw new Error("USER_NOT_FOUND");

      const creditRows = await sql`
        select
          coalesce(sum(quantity_available), 0)::integer as available,
          coalesce(sum(quantity_consumed), 0)::integer as consumed
        from entitlement_batches
        where user_id = ${userId} and expires_at > clock_timestamp()
      ` as Row[];

      const orderRows = await sql`
        select id, product_key, quantity, amount_minor, currency, status, paid_at, created_at
        from payment_orders
        where user_id = ${userId}
        order by created_at desc
        limit 50
      ` as Row[];

      const castingRows = await sql`
        select id, method, scene, interpretation_goal, created_at
        from casting_sessions
        where user_id = ${userId} and deleted_at is null
        order by created_at desc
        limit 50
      ` as Row[];

      return {
        user: {
          id: String(user.id),
          email: String(user.email),
          name: String(user.name ?? ""),
        },
        credits: {
          available: Number(creditRows[0]?.available ?? 0),
          consumed: Number(creditRows[0]?.consumed ?? 0),
        },
        orders: orderRows.map((r) => ({
          id: String(r.id),
          productKey: String(r.product_key),
          quantity: Number(r.quantity),
          amountMinor: Number(r.amount_minor),
          currency: String(r.currency),
          status: String(r.status),
          paidAt: r.paid_at ? new Date(r.paid_at).toISOString() : null,
          createdAt: new Date(r.created_at).toISOString(),
        })),
        castings: castingRows.map((r) => ({
          id: String(r.id),
          method: String(r.method),
          scene: String(r.scene),
          interpretationGoal: String(r.interpretation_goal),
          createdAt: new Date(r.created_at).toISOString(),
        })),
      };
    },

    async deleteAccount(userId): Promise<{ success: boolean }> {
      return sql.begin(async (transaction) => {
        // 1. Soft-delete user's casting sessions
        await transaction`
          update casting_sessions
          set deleted_at = clock_timestamp(), updated_at = clock_timestamp()
          where user_id = ${userId} and deleted_at is null
        `;

        // 2. Query and release any active reserved entitlements, restoring batch available balance and writing ledger
        const activeReservations = await transaction`
          select id, batch_id from entitlement_reservations
          where user_id = ${userId} and status = 'reserved'
          for update
        ` as Row[];

        for (const res of activeReservations) {
          await transaction`
            update entitlement_reservations
            set status = 'released', lease_token = null, lease_expires_at = null, updated_at = clock_timestamp()
            where id = ${res.id}
          `;

          await transaction`
            update entitlement_batches
            set quantity_reserved = greatest(0, quantity_reserved - 1),
                quantity_available = quantity_available + 1,
                updated_at = clock_timestamp()
            where id = ${res.batch_id}
          `;

          await transaction`
            insert into entitlement_ledger (
              id, batch_id, order_id, action, quantity, business_key, created_at
            )
            select
              ${randomUUID()}, ${res.batch_id}, b.order_id, 'release', 1,
              ${`release:${res.id}`}, clock_timestamp()
            from entitlement_batches b
            where b.id = ${res.batch_id}
            on conflict (business_key) do nothing
          `;
        }

        // 3. Clear user sessions
        await transaction`
          delete from sessions where user_id = ${userId}
        `;

        // 4. Delete OAuth accounts
        await transaction`
          delete from accounts where user_id = ${userId}
        `;

        // 5. Anonymize user record
        await transaction`
          update users
          set name = 'Deleted User', email = ${`deleted_${randomUUID()}@deleted.local`},
              email_verified = false, image = null, updated_at = clock_timestamp()
          where id = ${userId}
        `;

        // 6. Record audit event
        await transaction`
          insert into audit_events (
            id, category, action, entity_type, entity_id, user_id, payload, created_at
          ) values (
            ${randomUUID()}, 'deletion', 'account_deleted', 'user', ${userId}, ${userId},
            '{"action":"user_data_erased","reason":"user_requested"}'::jsonb, clock_timestamp()
          )
        `;

        return { success: true };
      });
    },
  };
}
