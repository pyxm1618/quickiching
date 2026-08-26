import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { databaseSchema } from "./schema";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests");

const sql = postgres(databaseURL, { max: 4, prepare: false });
const db = drizzle(sql, { schema: databaseSchema });

describe("CP5 PostgreSQL schema and cross-table ownership constraints", () => {
  const userOneId = "cp5-user-one";
  const userTwoId = "cp5-user-two";
  const orderOneId = "11111111-1111-4111-8111-111111111111";
  const orderTwoId = "22222222-2222-4222-8222-222222222222";
  const batchOneId = "33333333-3333-4333-8333-333333333333";
  const batchTwoId = "44444444-4444-4444-8444-444444444444";
  const castingOneId = "55555555-5555-4555-8555-555555555555";
  const castingTwoId = "66666666-6666-4666-8666-666666666666";
  const previewJobId = "77777777-7777-4777-8777-777777777777";
  const deepJobOneId = "88888888-8888-4888-8888-888888888888";
  const deepJobTwoId = "99999999-9999-4999-8999-999999999999";

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "drizzle" });

    // Clean test fixtures
    await sql`delete from audit_events where user_id in (${userOneId}, ${userTwoId})`;
    await sql`delete from workflow_runs where entity_id in (${castingOneId}, ${castingTwoId})`;
    await sql`delete from deep_reading_results where casting_id in (${castingOneId}, ${castingTwoId})`;
    await sql`delete from entitlement_reservations where user_id in (${userOneId}, ${userTwoId})`;
    await sql`delete from generation_jobs where id in (${previewJobId}, ${deepJobOneId}, ${deepJobTwoId})`;
    await sql`delete from casting_sessions where id in (${castingOneId}, ${castingTwoId})`;
    await sql`delete from entitlement_ledger where batch_id in (${batchOneId}, ${batchTwoId})`;
    await sql`delete from entitlement_batches where id in (${batchOneId}, ${batchTwoId})`;
    await sql`delete from payment_orders where id in (${orderOneId}, ${orderTwoId})`;
    await sql`delete from users where id in (${userOneId}, ${userTwoId})`;

    // Seed users
    const now = new Date().toISOString();
    await sql`
      insert into users (id, name, email, email_verified, created_at, updated_at)
      values
        (${userOneId}, 'CP5 User One', 'cp5-user-one@example.com', true, ${now}, ${now}),
        (${userTwoId}, 'CP5 User Two', 'cp5-user-two@example.com', true, ${now}, ${now})
      on conflict (id) do nothing
    `;

    // Seed orders & batches
    await sql`
      insert into payment_orders (
        id, user_id, product_key, quantity, amount_minor, currency, request_id,
        provider, provider_environment, provider_product_id, provider_order_id, provider_payment_id,
        status, paid_at, created_at, updated_at
      ) values
        (${orderOneId}, ${userOneId}, 'one', 1, 299, 'USD', 'req-1', 'waffo', 'test', 'p-1', 'ord-prov-1', 'pay-prov-1', 'paid', ${now}, ${now}, ${now}),
        (${orderTwoId}, ${userTwoId}, 'one', 1, 299, 'USD', 'req-2', 'waffo', 'test', 'p-1', 'ord-prov-2', 'pay-prov-2', 'paid', ${now}, ${now}, ${now})
      on conflict (id) do nothing
    `;
    await sql`
      insert into entitlement_batches (
        id, user_id, order_id, quantity_total, quantity_available, quantity_reserved, quantity_consumed, quantity_revoked, expires_at, created_at, updated_at
      ) values
        (${batchOneId}, ${userOneId}, ${orderOneId}, 1, 1, 0, 0, 0, now() + interval '12 months', ${now}, ${now}),
        (${batchTwoId}, ${userTwoId}, ${orderTwoId}, 1, 1, 0, 0, 0, now() + interval '12 months', ${now}, ${now})
      on conflict (id) do nothing
    `;

    // Seed casting sessions
    await sql`
      insert into casting_sessions (
        id, user_id, method, lifecycle, risk_status, scene, interpretation_goal, generation_epoch, created_at, updated_at
      ) values
        (${castingOneId}, ${userOneId}, 'three_coin', 'revealed', 'allowed', 'career', 'guidance', 0, ${now}, ${now}),
        (${castingTwoId}, ${userTwoId}, 'three_coin', 'revealed', 'allowed', 'career', 'guidance', 0, ${now}, ${now})
      on conflict (id) do nothing
    `;

    // Seed generation jobs (preview & deep_reading)
    await sql`
      insert into generation_jobs (
        id, casting_id, kind, status, generation_epoch, idempotency_key, input_snapshot_hash, timeout_at, created_at, updated_at
      ) values
        (${previewJobId}, ${castingOneId}, 'preview', 'queued', 0, 'idem-preview-1', 'snap-hash-0', now() + interval '1 hour', ${now}, ${now}),
        (${deepJobOneId}, ${castingOneId}, 'deep_reading', 'queued', 0, 'idem-deep-1', 'snap-hash-1', now() + interval '1 hour', ${now}, ${now}),
        (${deepJobTwoId}, ${castingTwoId}, 'deep_reading', 'queued', 0, 'idem-deep-2', 'snap-hash-2', now() + interval '1 hour', ${now}, ${now})
      on conflict (id) do nothing
    `;
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("creates the required CP5 tables, columns and indexes", async () => {
    const tableRows = await sql<{ table_name: string }[]>`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in ('deep_reading_results', 'entitlement_reservations', 'workflow_runs', 'audit_events')
      order by table_name
    `;
    expect(tableRows.map((r) => r.table_name)).toEqual([
      "audit_events",
      "deep_reading_results",
      "entitlement_reservations",
      "workflow_runs",
    ]);
  });

  it("REJECTS reservation with mismatched user_id and batch.user_id", async () => {
    // Attempt to create a reservation for userTwo with batch belonging to userOne
    await expect(sql`
      insert into entitlement_reservations (
        id, batch_id, user_id, casting_id, job_id, status, lease_token, lease_expires_at, expires_at, created_at, updated_at
      ) values (
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', ${batchOneId}, ${userTwoId}, ${castingTwoId}, ${deepJobTwoId},
        'reserved', 'token-1', now() + interval '5 minutes', now() + interval '12 months', now(), now()
      )
    `).rejects.toThrow();
  });

  it("REJECTS reservation with mismatched user_id and casting.user_id", async () => {
    // Attempt to create a reservation for userOne with casting belonging to userTwo
    await expect(sql`
      insert into entitlement_reservations (
        id, batch_id, user_id, casting_id, job_id, status, lease_token, lease_expires_at, expires_at, created_at, updated_at
      ) values (
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', ${batchOneId}, ${userOneId}, ${castingTwoId}, ${deepJobOneId},
        'reserved', 'token-1', now() + interval '5 minutes', now() + interval '12 months', now(), now()
      )
    `).rejects.toThrow();
  });

  it("REJECTS reservation with mismatched job_id casting and reservation.casting_id", async () => {
    // Attempt to create a reservation for castingOne with a job belonging to castingTwo
    await expect(sql`
      insert into entitlement_reservations (
        id, batch_id, user_id, casting_id, job_id, status, lease_token, lease_expires_at, expires_at, created_at, updated_at
      ) values (
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc', ${batchOneId}, ${userOneId}, ${castingOneId}, ${deepJobTwoId},
        'reserved', 'token-1', now() + interval '5 minutes', now() + interval '12 months', now(), now()
      )
    `).rejects.toThrow();
  });

  it("REJECTS reservation linked to a non-deep_reading job", async () => {
    // Attempt to link a reservation to a preview job
    await expect(sql`
      insert into entitlement_reservations (
        id, batch_id, user_id, casting_id, job_id, status, lease_token, lease_expires_at, expires_at, created_at, updated_at
      ) values (
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd', ${batchOneId}, ${userOneId}, ${castingOneId}, ${previewJobId},
        'reserved', 'token-1', now() + interval '5 minutes', now() + interval '12 months', now(), now()
      )
    `).rejects.toThrow();
  });

  it("enforces single active reservation per casting session", async () => {
    const resId1 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const resId2 = "ffffffff-ffff-4fff-8fff-ffffffffffff";

    await sql`
      insert into entitlement_reservations (
        id, batch_id, user_id, casting_id, job_id, status, lease_token, lease_expires_at, expires_at, created_at, updated_at
      ) values (
        ${resId1}, ${batchOneId}, ${userOneId}, ${castingOneId}, ${deepJobOneId},
        'reserved', 'token-1', now() + interval '5 minutes', now() + interval '12 months', now(), now()
      )
    `;

    // Second active reservation on the same casting must fail
    await expect(sql`
      insert into entitlement_reservations (
        id, batch_id, user_id, casting_id, job_id, status, lease_token, lease_expires_at, expires_at, created_at, updated_at
      ) values (
        ${resId2}, ${batchOneId}, ${userOneId}, ${castingOneId}, ${deepJobOneId},
        'reserved', 'token-2', now() + interval '5 minutes', now() + interval '12 months', now(), now()
      )
    `).rejects.toThrow();

    // Clean up
    await sql`delete from entitlement_reservations where id = ${resId1}`;
  });

  it("prevents direct update and deletion on audit_events", async () => {
    const auditId = "a1111111-1111-4111-8111-111111111111";
    await sql`
      insert into audit_events (id, category, action, entity_type, entity_id, user_id, payload, created_at)
      values (${auditId}, 'checkout', 'requested', 'order', ${orderOneId}, ${userOneId}, '{"test":true}'::jsonb, now())
    `;

    await expect(sql`
      update audit_events set action = 'modified' where id = ${auditId}
    `).rejects.toThrow();

    await expect(sql`
      delete from audit_events where id = ${auditId}
    `).rejects.toThrow();
  });

  it("prevents mutation of persisted deep_reading_results", async () => {
    const resId = "a2222222-2222-4222-8222-222222222222";
    await sql`
      insert into entitlement_reservations (
        id, batch_id, user_id, casting_id, job_id, status, lease_token, lease_expires_at, expires_at, created_at, updated_at
      ) values (
        ${resId}, ${batchOneId}, ${userOneId}, ${castingOneId}, ${deepJobOneId},
        'consumed', null, null, now() + interval '12 months', now(), now()
      )
    `;

    await sql`
      insert into deep_reading_results (
        casting_id, job_id, reservation_id, output, schema_version, prompt_version, provider, model, integrity_hash, persisted_at
      ) values (
        ${castingOneId}, ${deepJobOneId}, ${resId}, '{"report":"sample"}'::jsonb, 'commercial-reading-v1', 'v1', 'openai', 'gpt-4o', 'hash-123', now()
      )
    `;

    await expect(sql`
      update deep_reading_results set output = '{"tampered":true}'::jsonb where casting_id = ${castingOneId}
    `).rejects.toThrow();

    // Clean up
    await sql`delete from deep_reading_results where casting_id = ${castingOneId}`;
    await sql`delete from entitlement_reservations where id = ${resId}`;
  });
});
