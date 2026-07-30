import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migratePostgres, resetPostgresForTests } from "@/server/db/migrate";
import { PostgresAuthBridge } from "./auth-bridge";
import { PostgresPaymentRepository } from "./payment-repository";

const databaseUrl = process.env.POSTGRES_TEST_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

type ColumnRow = { table_name: string; column_name: string };

describePostgres("PostgreSQL auth and payment boundaries", () => {
  let sql: Sql;

  beforeAll(async () => {
    sql = postgres(databaseUrl!, { max: 8 });
    await migratePostgres(sql);
  });

  beforeEach(async () => {
    await resetPostgresForTests(sql);
  });

  afterAll(async () => {
    if (sql) await sql.end();
  });

  it("installs the complete Better Auth core schema in dedicated tables", async () => {
    const columns = await sql`
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name in ('auth_users', 'auth_sessions', 'auth_accounts', 'auth_verifications')
      order by table_name, column_name
    `;
    const byTable = new Map<string, ColumnRow[]>();
    for (const row of columns as unknown as ColumnRow[]) {
      const group = byTable.get(row.table_name) ?? [];
      group.push(row);
      byTable.set(row.table_name, group);
    }

    expect(byTable.get("auth_users")?.map((row) => row.column_name)).toEqual(expect.arrayContaining([
      "id", "name", "email", "email_verified", "image", "created_at", "updated_at",
    ]));
    expect(byTable.get("auth_sessions")?.map((row) => row.column_name)).toEqual(expect.arrayContaining([
      "id", "user_id", "token", "expires_at", "ip_address", "user_agent", "created_at", "updated_at",
    ]));
    expect(byTable.get("auth_accounts")?.map((row) => row.column_name)).toEqual(expect.arrayContaining([
      "id", "user_id", "account_id", "provider_id", "access_token", "refresh_token",
      "access_token_expires_at", "refresh_token_expires_at", "scope", "id_token", "password",
      "created_at", "updated_at",
    ]));
    expect(byTable.get("auth_verifications")?.map((row) => row.column_name)).toEqual(expect.arrayContaining([
      "id", "identifier", "value", "expires_at", "created_at", "updated_at",
    ]));
  });

  it("mirrors an authenticated identity into the application users table idempotently", async () => {
    const bridge = new PostgresAuthBridge(sql);
    await Promise.all([
      bridge.ensureApplicationUser({ id: "usr_auth_bridge", email: "bridge@example.com" }),
      bridge.ensureApplicationUser({ id: "usr_auth_bridge", email: "bridge@example.com" }),
    ]);

    const users = await sql`select id, email from users where id = 'usr_auth_bridge'`;
    expect(users).toEqual([{ id: "usr_auth_bridge", email: "bridge@example.com" }]);
  });

  it("processes a checkout.completed webhook once under concurrent retries", async () => {
    await sql`insert into users (id, email) values ('usr_payment', 'payment@example.com')`;
    await sql`
      insert into orders (
        id, user_id, product_id, amount_usd, currency, request_id, status
      ) values (
        'ord_payment', 'usr_payment', 'one', 2.99, 'USD', 'request_payment', 'pending'
      )
    `;
    const repository = new PostgresPaymentRepository(sql, {
      products: {
        prod_creem_one: { internalProductId: "one", quantity: 1, amountUsd: 2.99 },
      },
    });
    const event = {
      eventId: "evt_checkout_once",
      eventType: "checkout.completed" as const,
      checkoutId: "ch_checkout_once",
      requestId: "request_payment",
      providerProductId: "prod_creem_one",
      amountMinor: 299,
      currency: "USD",
      occurredAt: new Date("2026-07-30T00:00:00.000Z"),
      payload: {
        id: "evt_checkout_once",
        eventType: "checkout.completed",
        object: { id: "ch_checkout_once", request_id: "request_payment" },
      },
    };

    const outcomes = await Promise.all([
      repository.processCheckoutCompleted(event),
      repository.processCheckoutCompleted(event),
    ]);

    expect(outcomes.filter((outcome) => outcome.processed)).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.duplicate)).toHaveLength(1);

    const [order] = await sql`
      select status, provider_checkout_id from orders where id = 'ord_payment'
    `;
    expect(order).toMatchObject({ status: "paid", provider_checkout_id: "ch_checkout_once" });

    const batches = await sql`
      select quantity_total, quantity_available, quantity_reserved, quantity_consumed, quantity_revoked
      from entitlement_batches where user_id = 'usr_payment'
    `;
    expect(batches).toEqual([{
      quantity_total: 1,
      quantity_available: 1,
      quantity_reserved: 0,
      quantity_consumed: 0,
      quantity_revoked: 0,
    }]);
    expect(await sql`select id from entitlement_ledger where action = 'grant'`).toHaveLength(1);
    expect(await sql`select event_id from webhook_inbox where provider = 'creem'`).toHaveLength(1);
  });

  it("does not grant when provider product, amount, or currency disagrees with the order", async () => {
    await sql`insert into users (id, email) values ('usr_mismatch', 'mismatch@example.com')`;
    await sql`
      insert into orders (
        id, user_id, product_id, amount_usd, currency, request_id, status
      ) values (
        'ord_mismatch', 'usr_mismatch', 'one', 2.99, 'USD', 'request_mismatch', 'pending'
      )
    `;
    const repository = new PostgresPaymentRepository(sql, {
      products: {
        prod_creem_one: { internalProductId: "one", quantity: 1, amountUsd: 2.99 },
      },
    });

    await expect(repository.processCheckoutCompleted({
      eventId: "evt_mismatch",
      eventType: "checkout.completed",
      checkoutId: "ch_mismatch",
      requestId: "request_mismatch",
      providerProductId: "prod_creem_one",
      amountMinor: 399,
      currency: "USD",
      occurredAt: new Date("2026-07-30T00:00:00.000Z"),
      payload: { id: "evt_mismatch" },
    })).rejects.toThrow("CREEM_ORDER_MISMATCH");

    expect(await sql`select id from entitlement_batches where user_id = 'usr_mismatch'`).toHaveLength(0);
    const [order] = await sql`select status from orders where id = 'ord_mismatch'`;
    expect(order.status).toBe("pending");
  });
});
