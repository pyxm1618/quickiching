import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { databaseSchema } from "@/server/db/schema";
import { PostgresPaymentRepository } from "@/server/payments/postgres-repository";
import { createOutboxDispatcher } from "@/server/payments/outbox-dispatcher";
import { createReconcileService, ReconcileService } from "./reconcile-service";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests");

const sql = postgres(databaseURL, { max: 8, prepare: false });
const db = drizzle(sql, { schema: databaseSchema });

describe("CP5B Reconcile Service (PostgreSQL Integration)", () => {
  let reconcileService: ReconcileService;
  const testUserId = "cp5-rec-user-1";

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "drizzle" });
    const paymentRepository = new PostgresPaymentRepository(sql, {
      checkoutUrlKeys: "v1:test-secret-key-material-32-chars-long!",
    });
    const outboxDispatcher = createOutboxDispatcher({ sql, repository: paymentRepository });
    reconcileService = createReconcileService({ sql, outboxDispatcher });

    const now = new Date().toISOString();
    await sql`
      insert into users (id, name, email, email_verified, created_at, updated_at)
      values (${testUserId}, 'Reconcile User 1', 'rec1@example.com', true, ${now}, ${now})
      on conflict (id) do nothing
    `;
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("recovers expired checkout_initializing leases to financial_review", async () => {
    const orderId = randomUUID();
    const now = new Date().toISOString();

    await sql`
      insert into payment_orders (
        id, user_id, product_key, quantity, amount_minor, currency, request_id,
        provider, provider_environment, provider_product_id, status, checkout_claim_token,
        checkout_claim_expires_at, created_at, updated_at
      ) values (
        ${orderId}, ${testUserId}, 'one', 1, 299, 'USD', ${`req-${orderId}`},
        'waffo', 'test', 'prod-1', 'checkout_initializing', 'claim-tok-1',
        clock_timestamp() - interval '10 seconds', ${now}, ${now}
      )
    `;

    const metrics = await reconcileService.runReconcile();
    expect(metrics.checkoutCleaned).toBeGreaterThanOrEqual(1);

    const orderRows = await sql<{ status: string; checkout_error_code: string }[]>`
      select status, checkout_error_code from payment_orders where id = ${orderId}
    `;
    expect(orderRows[0]?.status).toBe("financial_review");
    expect(orderRows[0]?.checkout_error_code).toBe("CHECKOUT_PROVIDER_OUTCOME_UNCERTAIN");
  });

  it("releases stranded entitlement reservations when generation job has timed out or failed (NEG-06, NEG-07)", async () => {
    const orderId = randomUUID();
    const batchId = randomUUID();
    const castingId = randomUUID();
    const jobId = randomUUID();
    const resId = randomUUID();
    const now = new Date().toISOString();

    await sql`
      insert into payment_orders (
        id, user_id, product_key, quantity, amount_minor, currency, request_id,
        provider, provider_environment, provider_product_id, provider_order_id, provider_payment_id,
        status, paid_at, created_at, updated_at
      ) values (
        ${orderId}, ${testUserId}, 'one', 1, 299, 'USD', ${`req-${orderId}`},
        'waffo', 'test', 'prod-1', ${`ord-${orderId}`}, ${`pay-${orderId}`}, 'paid', ${now}, ${now}, ${now}
      )
    `;

    await sql`
      insert into entitlement_batches (
        id, user_id, order_id, quantity_total, quantity_available, quantity_reserved, quantity_consumed, quantity_revoked, expires_at, created_at, updated_at
      ) values (
        ${batchId}, ${testUserId}, ${orderId}, 1, 0, 1, 0, 0, now() + interval '12 months', ${now}, ${now}
      )
    `;

    await sql`
      insert into casting_sessions (id, user_id, method, lifecycle, risk_status, scene, interpretation_goal, created_at, updated_at)
      values (${castingId}, ${testUserId}, 'three_coin', 'revealed', 'allowed', 'career', 'guidance', ${now}, ${now})
    `;

    // Job timed out in the past
    await sql`
      insert into generation_jobs (
        id, casting_id, kind, status, generation_epoch, idempotency_key, input_snapshot_hash, timeout_at, created_at, updated_at
      ) values (
        ${jobId}, ${castingId}, 'deep_reading', 'running', 0, ${`idem-${jobId}`}, 'snap-hash',
        clock_timestamp() - interval '10 seconds', ${now}, ${now}
      )
    `;

    // Stranded reservation
    await sql`
      insert into entitlement_reservations (
        id, batch_id, user_id, casting_id, job_id, status, lease_token, lease_expires_at, expires_at, created_at, updated_at
      ) values (
        ${resId}, ${batchId}, ${testUserId}, ${castingId}, ${jobId}, 'reserved', 'lease-1',
        clock_timestamp() - interval '10 seconds', now() + interval '12 months', ${now}, ${now}
      )
    `;

    const metrics = await reconcileService.runReconcile();
    expect(metrics.jobsTimedOut).toBeGreaterThanOrEqual(1);
    expect(metrics.reservationsReleased).toBeGreaterThanOrEqual(1);

    // Verify job marked timed_out
    const jobRows = await sql<{ status: string }[]>`select status from generation_jobs where id = ${jobId}`;
    expect(jobRows[0]?.status).toBe("timed_out");

    // Verify reservation released
    const resRows = await sql<{ status: string }[]>`select status from entitlement_reservations where id = ${resId}`;
    expect(resRows[0]?.status).toBe("released");

    // Verify batch credit restored to available
    const batchRows = await sql<{ quantity_available: number; quantity_reserved: number }[]>`
      select quantity_available, quantity_reserved from entitlement_batches where id = ${batchId}
    `;
    expect(batchRows[0]?.quantity_available).toBe(1);
    expect(batchRows[0]?.quantity_reserved).toBe(0);

    // Verify ledger has release entry
    const ledgerRows = await sql<{ action: string; quantity: number }[]>`
      select action, quantity from entitlement_ledger where batch_id = ${batchId} and action = 'release'
    `;
    expect(ledgerRows[0]?.action).toBe("release");
  });

  it("recovers stranded workflow_runs stuck in start_pending", async () => {
    const runId = `wf-run-${randomUUID()}`;
    const castingId = randomUUID();
    const now = new Date().toISOString();

    await sql`
      insert into workflow_runs (
        id, workflow_name, idempotency_key, entity_type, entity_id, status, created_at, updated_at
      ) values (
        ${runId}, 'deep_reading_workflow', ${`idem-${runId}`}, 'casting_session', ${castingId},
        'start_pending', clock_timestamp() - interval '15 minutes', clock_timestamp() - interval '15 minutes'
      )
    `;

    const metrics = await reconcileService.runReconcile();
    expect(metrics.workflowRunsRecovered).toBeGreaterThanOrEqual(1);

    const runRows = await sql<{ status: string; error_code: string }[]>`
      select status, error_code from workflow_runs where id = ${runId}
    `;
    expect(runRows[0]?.status).toBe("failed");
    expect(runRows[0]?.error_code).toBe("WORKFLOW_START_TIMED_OUT");
  });
});
