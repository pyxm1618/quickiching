import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { PostgresPaymentRepository } from "@/server/payments/postgres-repository";
import { canonicalWaffoPayloadHash, type NormalizedWaffoWebhook } from "@/server/payments/waffo-webhook";

const databaseURL = process.env.TEST_DATABASE_UPGRADE_URL;
if (!databaseURL) throw new Error("TEST_DATABASE_UPGRADE_URL is required for PostgreSQL integration tests");

const sql = postgres(databaseURL, { max: 4, prepare: false });
const db = drizzle(sql);
let initialMigrationFolder: string;
let preCp4MigrationFolder: string;

describe("forward upgrade from a populated CP2 database through CP4", () => {
  beforeAll(async () => {
    initialMigrationFolder = await mkdtemp(join("/tmp", "quickiching-cp3-0000-"));
    await mkdir(join(initialMigrationFolder, "meta"));
    await copyFile("drizzle/0000_cp2_auth_identity.sql", join(initialMigrationFolder, "0000_cp2_auth_identity.sql"));
    await copyFile("drizzle/meta/0000_snapshot.json", join(initialMigrationFolder, "meta/0000_snapshot.json"));
    await writeFile(join(initialMigrationFolder, "meta/_journal.json"), JSON.stringify({
      version: "7",
      dialect: "postgresql",
      entries: [{
        idx: 0,
        version: "7",
        when: 1787481005189,
        tag: "0000_cp2_auth_identity",
        breakpoints: true,
      }],
    }));

    await migrate(db, { migrationsFolder: initialMigrationFolder });
    const now = new Date("2026-08-24T00:03:00.000Z").toISOString();
    await sql`
      insert into users (id, name, email, email_verified, created_at, updated_at)
      values ('cp2-upgrade-user', 'CP2 Existing User', 'cp2-upgrade@example.com', true, ${now}, ${now})
    `;
    await sql`
      insert into accounts (
        id, issuer, account_id, provider_id, user_id, created_at, updated_at
      ) values (
        'cp2-upgrade-account', 'https://accounts.google.com', 'cp2-upgrade-subject',
        'google', 'cp2-upgrade-user', ${now}, ${now}
      )
    `;
    preCp4MigrationFolder = await mkdtemp(join("/tmp", "quickiching-cp4-pre-repair-"));
    await mkdir(join(preCp4MigrationFolder, "meta"));
    for (const migration of [
      "0000_cp2_auth_identity.sql",
      "0001_flaky_wiccan.sql",
      "0002_cp3_generation_repair.sql",
      "0003_cp3_generation_repair2.sql",
      "0004_cp3_generation_repair3.sql",
      "0005_cp4_payments_entitlements.sql",
      "0006_cp4_payment_repair.sql",
      "0007_cp4_payment_repair_followup.sql",
    ]) {
      await copyFile(join("drizzle", migration), join(preCp4MigrationFolder, migration));
    }
    for (const snapshot of [
      "0000_snapshot.json",
      "0001_snapshot.json",
      "0002_snapshot.json",
      "0004_snapshot.json",
      "0005_snapshot.json",
      "0006_snapshot.json",
      "0007_snapshot.json",
    ]) {
      await copyFile(join("drizzle/meta", snapshot), join(preCp4MigrationFolder, "meta", snapshot));
    }
    const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8")) as {
      version: string;
      dialect: string;
      entries: Array<{ idx: number }>;
    };
    await writeFile(join(preCp4MigrationFolder, "meta/_journal.json"), JSON.stringify({
      ...journal,
      entries: journal.entries.filter((entry) => entry.idx <= 5),
    }));
    await migrate(db, { migrationsFolder: preCp4MigrationFolder });

    await sql`
      insert into casting_sessions (
        id, user_id, method, lifecycle, risk_status, scene, interpretation_goal,
        generation_epoch, created_at, updated_at
      ) values (
        '22222222-2222-4222-8222-222222222222', 'cp2-upgrade-user', 'three-coin',
        'revealed', 'allowed', 'upgrade scene', 'upgrade goal', 0, now(), now()
      )
    `;
    await sql`
      insert into generation_jobs (
        id, casting_id, kind, status, generation_epoch, idempotency_key,
        input_snapshot_hash, timeout_at, created_at, updated_at
      ) values (
        '33333333-3333-4333-8333-333333333333',
        '22222222-2222-4222-8222-222222222222', 'preview', 'queued', 0,
        'upgrade-generation-job', 'upgrade-snapshot', now() + interval '5 minutes', now(), now()
      )
    `;
    await sql`
      insert into payment_orders (
        id, user_id, product_key, quantity, amount_minor, currency, request_id,
        provider, provider_environment, provider_product_id, provider_order_id,
        provider_payment_id, status, paid_at, created_at, updated_at
      ) values (
        '44444444-4444-4444-8444-444444444444', 'cp2-upgrade-user', 'one', 1, 299,
        'USD', 'upgrade-payment-request', 'waffo', 'test', 'PROD_test_one',
        'ORD_upgrade', 'PAY_upgrade', 'paid', now(), now(), now()
      )
    `;
    await sql`
      insert into payment_orders (
        id, user_id, product_key, quantity, amount_minor, currency, request_id,
        provider, provider_environment, provider_product_id, provider_checkout_session_id,
        provider_checkout_url, checkout_expires_at, status, created_at, updated_at
      ) values (
        '44444444-4444-4444-8444-444444444445', 'cp2-upgrade-user', 'one', 1, 299,
        'USD', 'legacy-checkout-request', 'waffo', 'test', 'PROD_test_one', 'cs_legacy',
        'https://pancake.waffo.ai/checkout/legacy#token=legacy-secret',
        now() + interval '1 hour', 'checkout_created', now(), now()
      )
    `;
    await sql`
      insert into payment_webhook_inbox (
        id, provider, provider_environment, delivery_id, event_id, event_type,
        store_id, order_merchant_external_id, linked_order_id, payload_sha256,
        normalized_payload, signature_verified_at, status, processed_at, created_at, updated_at
      ) values (
        '55555555-5555-4555-8555-555555555555', 'waffo', 'test', 'upgrade-delivery',
        'PAY_upgrade', 'order.completed', 'STO_test',
        '44444444-4444-4444-8444-444444444444', '44444444-4444-4444-8444-444444444444',
        'upgrade-hash', ${JSON.stringify({
          provider: "waffo",
          providerEnvironment: "test",
          deliveryId: "upgrade-delivery",
          eventId: "PAY_upgrade",
          eventType: "order.completed",
          storeId: "STO_test",
          orderMerchantExternalId: "44444444-4444-4444-8444-444444444444",
          internalOrderId: "44444444-4444-4444-8444-444444444444",
          merchantProvidedBuyerIdentity: "cp2-upgrade-user",
          providerOrderId: "ORD_upgrade",
          providerPaymentId: "PAY_upgrade",
          productKey: "one",
          providerProductId: "PROD_test_one",
          currency: "USD",
          amountMinor: 299,
          taxAmount: "0.00",
          total: "2.99",
          payloadSha256: "upgrade-hash",
          supported: true,
          manualReviewReason: null,
        })}::jsonb, now(), 'processed', now(), now(), now()
      )
    `;
    await sql`
      insert into payment_outbox (
        id, inbox_id, order_id, topic, status, completed_at, available_at, created_at, updated_at
      ) values (
        '66666666-6666-4666-8666-666666666666',
        '55555555-5555-4555-8555-555555555555',
        '44444444-4444-4444-8444-444444444444', 'grant_entitlement', 'completed',
        now(), now(), now(), now()
      )
    `;
    await sql`
      insert into payment_webhook_inbox (
        id, provider, provider_environment, delivery_id, event_id, event_type,
        store_id, order_merchant_external_id, linked_order_id, payload_sha256,
        normalized_payload, signature_verified_at, status, processed_at, created_at, updated_at
      ) values (
        '55555555-5555-4555-8555-555555555556', 'waffo', 'test', 'upgrade-null-outbox-delivery',
        'PAY_upgrade_null_outbox', 'order.completed', 'STO_test',
        '44444444-4444-4444-8444-444444444444', '44444444-4444-4444-8444-444444444444',
        'upgrade-null-outbox-hash', '{}'::jsonb, now(), 'processed', now(), now(), now()
      )
    `;
    await sql`
      insert into payment_outbox (
        id, inbox_id, order_id, topic, status, completed_at, available_at, created_at, updated_at
      ) values (
        '66666666-6666-4666-8666-666666666667',
        '55555555-5555-4555-8555-555555555556',
        null, 'financial_review', 'completed', now(), now(), now(), now()
      )
    `;
    await sql`
      insert into entitlement_batches (
        id, user_id, order_id, quantity_total, quantity_available,
        quantity_reserved, quantity_consumed, quantity_revoked, expires_at, created_at, updated_at
      ) values (
        '77777777-7777-4777-8777-777777777777', 'cp2-upgrade-user',
        '44444444-4444-4444-8444-444444444444', 1, 1, 0, 0, 0,
        now() + interval '12 months', now(), now()
      )
    `;
    await sql`
      insert into entitlement_ledger (
        id, batch_id, order_id, webhook_inbox_id, action, quantity, business_key, created_at
      ) values (
        '88888888-8888-4888-8888-888888888888',
        '77777777-7777-4777-8777-777777777777',
        '44444444-4444-4444-8444-444444444444',
        '55555555-5555-4555-8555-555555555555', 'grant', 1, 'grant:upgrade-payment', now()
      )
    `;
    await migrate(db, { migrationsFolder: "drizzle" });
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
    if (initialMigrationFolder) await rm(initialMigrationFolder, { recursive: true, force: true });
    if (preCp4MigrationFolder) await rm(preCp4MigrationFolder, { recursive: true, force: true });
  });

  it("preserves CP2 identity rows while applying CP3 and the forward-only CP4 payment migration", async () => {
    const users = await sql<{ id: string; email: string }[]>`
      select id, email from users where id = 'cp2-upgrade-user'
    `;
    const accounts = await sql<{ id: string; user_id: string }[]>`
      select id, user_id from accounts where id = 'cp2-upgrade-account'
    `;
    const migrations = await sql<{ count: string }[]>`
      select count(*)::text as count from drizzle.__drizzle_migrations
    `;
    const repairConstraint = await sql<{ count: string }[]>`
      select count(*)::text as count
      from information_schema.table_constraints
      where table_schema = 'public' and constraint_name = 'generation_reviews_pass_fields_check'
    `;

    expect(users).toEqual([{ id: "cp2-upgrade-user", email: "cp2-upgrade@example.com" }]);
    expect(accounts).toEqual([{ id: "cp2-upgrade-account", user_id: "cp2-upgrade-user" }]);
    const paymentTables = await sql<{ count: string }[]>`
      select count(*)::text as count from information_schema.tables
      where table_schema = 'public' and table_name in ('payment_orders', 'payment_webhook_inbox', 'entitlement_batches')
    `;

    expect(migrations[0]?.count).toBe("11");
    expect(repairConstraint[0]?.count).toBe("1");
    expect(paymentTables[0]?.count).toBe("3");
    const preserved = await sql<{ users: string; jobs: string; orders: string; ledgers: string }[]>`
      select
        (select count(*) from users where id = 'cp2-upgrade-user')::text as users,
        (select count(*) from generation_jobs where id = '33333333-3333-4333-8333-333333333333')::text as jobs,
        (select count(*) from payment_orders where id = '44444444-4444-4444-8444-444444444444')::text as orders,
        (select count(*) from entitlement_ledger where business_key = 'grant:upgrade-payment')::text as ledgers
    `;
    expect(preserved).toEqual([{ users: "1", jobs: "1", orders: "1", ledgers: "1" }]);
    const legacyCheckout = await sql<{ status: string; checkout_error_code: string; provider_checkout_url: string | null }[]>`
      select status, checkout_error_code, provider_checkout_url
      from payment_orders
      where id = '44444444-4444-4444-8444-444444444445'
    `;
    expect(legacyCheckout).toEqual([{
      status: "financial_review",
      checkout_error_code: "CHECKOUT_LEGACY_TOKEN_REQUIRES_REAUTH",
      provider_checkout_url: null,
    }]);
    const repairedAssociation = await sql<{ order_id: string | null; linked_order_id: string | null }[]>`
      select o.order_id::text, i.linked_order_id::text
      from payment_outbox o
      join payment_webhook_inbox i on i.id = o.inbox_id
      where o.id = '66666666-6666-4666-8666-666666666667'
    `;
    expect(repairedAssociation).toEqual([{
      order_id: "44444444-4444-4444-8444-444444444444",
      linked_order_id: "44444444-4444-4444-8444-444444444444",
    }]);
  });

  it("keeps a real 0005 Inbox replay idempotent after the canonical hash backfill", async () => {
    const repository = new PostgresPaymentRepository(sql);
    const event: NormalizedWaffoWebhook = {
      provider: "waffo",
      providerEnvironment: "test",
      deliveryId: "upgrade-delivery",
      eventId: "PAY_upgrade",
      eventType: "order.completed",
      storeId: "STO_test",
      orderMerchantExternalId: "44444444-4444-4444-8444-444444444444",
      merchantProvidedBuyerIdentity: "cp2-upgrade-user",
      internalOrderId: "44444444-4444-4444-8444-444444444444",
      refundTicketMerchantExternalId: null,
      providerOrderId: "ORD_upgrade",
      providerPaymentId: "PAY_upgrade",
      productKey: "one",
      providerProductId: "PROD_test_one",
      currency: "USD",
      amountMinor: 299,
      taxAmount: "0.00",
      total: "2.99",
      payloadSha256: "upgrade-hash",
      canonicalPayloadSha256: "",
      supported: true,
      manualReviewReason: null,
    };
    event.canonicalPayloadSha256 = canonicalWaffoPayloadHash(event);

    await expect(repository.recordVerifiedEvent(event)).resolves.toEqual({
      inboxId: "55555555-5555-4555-8555-555555555555",
      duplicate: "delivery",
    });
    const marker = await sql<{ canonical_payload_sha256: string }[]>`
      select canonical_payload_sha256
      from payment_webhook_inbox
      where id = '55555555-5555-4555-8555-555555555555'
    `;
    expect(marker[0]?.canonical_payload_sha256).toMatch(/^legacy:v1:/);
  });
});
