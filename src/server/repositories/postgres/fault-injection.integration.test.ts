import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migratePostgres, resetPostgresForTests } from "@/server/db/migrate";
import { PostgresAccountPrivacyService } from "@/server/runtime/postgres-account-privacy";
import { PostgresPaymentRepository } from "./payment-repository";

const databaseUrl = process.env.POSTGRES_TEST_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres("PostgreSQL transaction fault injection", () => {
  let sql: Sql;

  beforeAll(async () => {
    sql = postgres(databaseUrl!, { max: 10 });
    await migratePostgres(sql);
  });

  beforeEach(async () => {
    await sql.unsafe(`
      DROP TRIGGER IF EXISTS fault_checkout_ledger_trigger ON entitlement_ledger;
      DROP FUNCTION IF EXISTS fault_checkout_ledger();
      DROP TRIGGER IF EXISTS fault_account_deletion_request_trigger ON account_deletion_requests;
      DROP FUNCTION IF EXISTS fault_account_deletion_request();
    `);
    await resetPostgresForTests(sql);
  });

  afterAll(async () => {
    if (sql) {
      await sql.unsafe(`
        DROP TRIGGER IF EXISTS fault_checkout_ledger_trigger ON entitlement_ledger;
        DROP FUNCTION IF EXISTS fault_checkout_ledger();
        DROP TRIGGER IF EXISTS fault_account_deletion_request_trigger ON account_deletion_requests;
        DROP FUNCTION IF EXISTS fault_account_deletion_request();
      `);
      await sql.end();
    }
  });

  it("rolls back inbox, order and entitlement writes when checkout ledger persistence fails", async () => {
    await sql`insert into users (id, email) values ('usr_fault_payment', 'fault-payment@example.com')`;
    await sql`
      insert into orders (id, user_id, product_id, amount_usd, currency, request_id, buyer_email_snapshot, status)
      values ('ord_fault_payment', 'usr_fault_payment', 'one', 2.99, 'USD', 'req_fault_payment', 'fault-payment@example.com', 'pending')
    `;
    await sql.unsafe(`
      CREATE FUNCTION fault_checkout_ledger()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.reason_code = 'order_completed' THEN
          RAISE EXCEPTION 'FAULT_INJECTED_CHECKOUT_LEDGER';
        END IF;
        RETURN NEW;
      END
      $$;
      CREATE TRIGGER fault_checkout_ledger_trigger
      BEFORE INSERT ON entitlement_ledger
      FOR EACH ROW EXECUTE FUNCTION fault_checkout_ledger();
    `);

    const repository = new PostgresPaymentRepository(sql, {
      products: {
        PROD_one: { internalProductId: "one", quantity: 1, amountUsd: 2.99 },
      },
    });
    const event = {
      id: "delivery_fault_payment", timestamp: "2026-07-31T04:00:00.000Z", eventId: "evt_fault_payment", eventType: "order.completed", storeId: "STO_test", mode: "test" as const,
      data: { orderId: "provider_order_fault_payment", buyerEmail: "fault-payment@example.com", merchantProvidedBuyerIdentity: "usr_fault_payment", currency: "USD", amount: "2.99", subtotal: "2.99", total: "2.99", taxAmount: "0.00", productName: "One", paymentId: "evt_fault_payment", orderMerchantExternalId: "ord_fault_payment", orderMetadata: { orderId: "ord_fault_payment", internalProductId: "one" } },
    };
    await repository.recordVerifiedDelivery(event, event);
    await expect(repository.dispatchPending()).resolves.toMatchObject({ failed: 1 });

    expect((await sql`select status, provider_order_id from orders where id = 'ord_fault_payment'`)[0])
      .toMatchObject({ status: "pending", provider_order_id: null });
    expect(await sql`select id from entitlement_batches where order_id = 'ord_fault_payment'`).toHaveLength(0);
    expect(await sql`select id from entitlement_ledger where order_id = 'ord_fault_payment'`).toHaveLength(0);
    expect(await sql`select event_id from webhook_inbox where event_id = 'evt_fault_payment'`).toHaveLength(1);

    // A normal PostgreSQL failure is infrastructure, not a domain rejection: it
    // must be retried and can safely complete once the dependency recovers.
    await sql`drop trigger fault_checkout_ledger_trigger on entitlement_ledger`;
    await sql`drop function fault_checkout_ledger()`;
    await sql`update outbox set available_at = now() where aggregate_id = 'delivery_fault_payment'`;
    await expect(repository.dispatchPending()).resolves.toMatchObject({ dispatched: 1 });
    expect(await sql`select id from entitlement_ledger where order_id = 'ord_fault_payment' and action = 'grant'`).toHaveLength(1);
  });

  it("dead-letters an infrastructure failure only after eight attempts", async () => {
    await sql`insert into users (id, email) values ('usr_eight', 'eight@example.com')`;
    await sql`insert into orders (id, user_id, product_id, amount_usd, currency, request_id, buyer_email_snapshot, status) values ('ord_eight', 'usr_eight', 'one', 2.99, 'USD', 'req_eight', 'eight@example.com', 'pending')`;
    await sql.unsafe(`
      CREATE FUNCTION fault_always() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'FAULT_ALWAYS'; END $$;
      CREATE TRIGGER fault_always_trigger BEFORE INSERT ON entitlement_ledger
      FOR EACH ROW EXECUTE FUNCTION fault_always();
    `);
    const repository = new PostgresPaymentRepository(sql, { products: { PROD_one: { internalProductId: 'one', quantity: 1, amountUsd: 2.99 } } });
    const event = {
      id: 'delivery_eight', timestamp: '2026-07-31T04:00:00.000Z', eventId: 'evt_eight', eventType: 'order.completed', storeId: 'STO_test', mode: 'test' as const,
      data: { orderId: 'provider_eight', buyerEmail: 'eight@example.com', merchantProvidedBuyerIdentity: 'usr_eight', currency: 'USD', amount: '2.99', subtotal: '2.99', total: '2.99', taxAmount: '0.00', productName: 'One', paymentId: 'evt_eight', orderMerchantExternalId: 'ord_eight', orderMetadata: { orderId: 'ord_eight', internalProductId: 'one' } },
    };
    await repository.recordVerifiedDelivery(event, event);
    for (let attempt = 1; attempt <= 8; attempt++) {
      await expect(repository.dispatchPending()).resolves.toMatchObject({ failed: 1 });
      if (attempt < 8) await sql`update outbox set available_at = now() where aggregate_id = 'delivery_eight'`;
    }
    expect((await sql`select attempts, dead_lettered_at from outbox where aggregate_id = 'delivery_eight'`)[0]).toMatchObject({ attempts: 8 });
    expect((await sql`select dead_lettered_at from outbox where aggregate_id = 'delivery_eight'`)[0].dead_lettered_at).not.toBeNull();
    await sql`drop trigger fault_always_trigger on entitlement_ledger`;
    await sql`drop function fault_always()`;
  });

  it("rolls back anonymization, authentication deletion and credit revocation when deletion audit persistence fails", async () => {
    await sql`insert into users (id, email) values ('usr_fault_delete', 'fault-delete@example.com')`;
    await sql`
      insert into sessions (id, user_id, expires_at)
      values ('ses_fault_delete', 'usr_fault_delete', clock_timestamp() + interval '1 day')
    `;
    await sql`
      insert into auth_users (id, name, email, email_verified)
      values ('usr_fault_delete', 'Fault User', 'fault-delete@example.com', true)
    `;
    await sql`
      insert into entitlement_batches (
        id, user_id, product_id, amount_usd, quantity_total, quantity_available,
        quantity_reserved, quantity_consumed, quantity_revoked, expires_at
      ) values (
        'bat_fault_delete', 'usr_fault_delete', 'one', 2.99, 1, 1, 0, 0, 0,
        clock_timestamp() + interval '180 days'
      )
    `;
    await sql.unsafe(`
      CREATE FUNCTION fault_account_deletion_request()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'FAULT_INJECTED_ACCOUNT_DELETION_AUDIT';
      END
      $$;
      CREATE TRIGGER fault_account_deletion_request_trigger
      BEFORE INSERT ON account_deletion_requests
      FOR EACH ROW EXECUTE FUNCTION fault_account_deletion_request();
    `);

    const service = new PostgresAccountPrivacyService(sql, {
      digestEmail: () => ({ digest: "fault-email-digest", keyVersion: "test-v1" }),
      pseudonymousEmail: () => "fault-deleted@deleted.invalid",
    });
    await expect(service.requestDeletion({ userId: "usr_fault_delete" }))
      .rejects.toThrow("FAULT_INJECTED_ACCOUNT_DELETION_AUDIT");

    expect((await sql`
      select email, deleted_at, anonymized_at from users where id = 'usr_fault_delete'
    `)[0]).toMatchObject({
      email: "fault-delete@example.com",
      deleted_at: null,
      anonymized_at: null,
    });
    expect(await sql`select id from sessions where user_id = 'usr_fault_delete'`).toHaveLength(1);
    expect(await sql`select id from auth_users where id = 'usr_fault_delete'`).toHaveLength(1);
    expect((await sql`
      select quantity_available, quantity_revoked from entitlement_batches where id = 'bat_fault_delete'
    `)[0]).toMatchObject({ quantity_available: 1, quantity_revoked: 0 });
    expect(await sql`
      select id from entitlement_ledger where batch_id = 'bat_fault_delete' and reason_code = 'account_deleted'
    `).toHaveLength(0);
    expect(await sql`select user_id from account_deletion_requests where user_id = 'usr_fault_delete'`)
      .toHaveLength(0);
  });
});
