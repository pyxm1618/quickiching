import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migratePostgres, resetPostgresForTests } from "@/server/db/migrate";
import { PostgresAccountPrivacyService } from "./postgres-account-privacy";

const databaseUrl = process.env.POSTGRES_TEST_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres("PostgreSQL account deletion privacy lifecycle", () => {
  let sql: Sql;
  let service: PostgresAccountPrivacyService;

  beforeAll(async () => {
    sql = postgres(databaseUrl!, { max: 10 });
    await migratePostgres(sql);
    service = new PostgresAccountPrivacyService(sql, {
      digestEmail: () => ({ digest: "email-digest", keyVersion: "test-v1" }),
      pseudonymousEmail: () => "deleted-test@deleted.invalid",
    });
  });

  beforeEach(async () => {
    await resetPostgresForTests(sql);
    await sql`
      insert into users (id, email) values ('usr_account_delete', 'owner@example.com')
    `;
    await sql`
      insert into sessions (id, user_id, expires_at)
      values ('ses_account_delete', 'usr_account_delete', clock_timestamp() + interval '1 day')
    `;
    await sql`
      insert into auth_users (id, name, email, email_verified)
      values ('usr_account_delete', 'Owner', 'owner@example.com', true)
    `;
    await sql`
      insert into auth_sessions (id, user_id, token, expires_at)
      values ('auth_ses_account_delete', 'usr_account_delete', 'secret-session-token', clock_timestamp() + interval '1 day')
    `;
    await sql`
      insert into auth_accounts (id, user_id, account_id, provider_id, access_token, refresh_token)
      values ('auth_acc_account_delete', 'usr_account_delete', 'provider-account', 'google', 'access-secret', 'refresh-secret')
    `;
    await sql`
      insert into auth_verifications (id, identifier, value, expires_at)
      values ('auth_ver_account_delete', 'owner@example.com', 'magic-link-secret', clock_timestamp() + interval '1 hour')
    `;

    await sql`
      insert into orders (
        id, user_id, product_id, amount_usd, currency, request_id,
        provider_checkout_id, provider_order_id, provider_transaction_id,
        provider_amount_minor, status
      ) values (
        'ord_account_delete', 'usr_account_delete', 'three', 5.99, 'USD', 'req_account_delete',
        'checkout-account-delete', 'provider-order-account-delete', 'provider-tx-account-delete',
        599, 'paid'
      )
    `;
    await sql`
      insert into webhook_inbox (
        provider, event_id, event_type, order_id, payload,
        signature_verified_at, processed_at
      ) values (
        'creem', 'evt_account_delete', 'checkout.completed', 'ord_account_delete',
        ${sql.json({
          customer: { email: "owner@example.com", name: "Owner" },
          order: { id: "provider-order-account-delete", amount: 599 },
        } as never)},
        clock_timestamp(), clock_timestamp()
      )
    `;

    await sql`
      insert into casting_sessions (
        id, user_id, method, lifecycle, risk_status, scene, interpretation_goal,
        algorithm_version, revealed_at
      ) values
        ('cas_account_active', 'usr_account_delete', 'three_coin', 'revealed', 'allowed',
          'career', 'what_should_i_pay_attention_to_next', 'three-coin-v1', clock_timestamp()),
        ('cas_account_review', 'usr_account_delete', 'three_coin', 'revealed', 'allowed',
          'career', 'what_should_i_pay_attention_to_next', 'three-coin-v1', clock_timestamp())
    `;
    await sql`
      insert into question_versions (
        id, casting_session_id, version_number, ciphertext, iv, auth_tag,
        encryption_key_version, created_reason
      ) values
        ('qv_account_active', 'cas_account_active', 1, 'secret-question-active', 'iv', 'tag', 'v1', 'initial'),
        ('qv_account_review', 'cas_account_review', 1, 'secret-question-review', 'iv', 'tag', 'v1', 'initial')
    `;
    await sql`
      update casting_sessions set current_question_version_id = case id
        when 'cas_account_active' then 'qv_account_active'
        else 'qv_account_review'
      end
      where id in ('cas_account_active', 'cas_account_review')
    `;

    await sql`
      insert into readings (
        id, casting_session_id, status, report, schema_version, generation_epoch
      ) values
        ('rdg_account_active', 'cas_account_active', 'queued', null, 'reading-v1', 1),
        ('rdg_account_review', 'cas_account_review', 'completed',
          ${sql.json({ coreSummary: "private delivered report" } as never)}, 'reading-v1', 1)
    `;
    await sql`
      insert into entitlement_batches (
        id, user_id, product_id, order_id, amount_usd,
        quantity_total, quantity_available, quantity_reserved,
        quantity_consumed, quantity_revoked, expires_at
      ) values (
        'bat_account_delete', 'usr_account_delete', 'three', 'ord_account_delete', 5.99,
        3, 2, 1, 0, 0, clock_timestamp() + interval '180 days'
      )
    `;
    await sql`
      insert into reservations (id, reading_id, batch_id, status)
      values ('res_account_delete', 'rdg_account_active', 'bat_account_delete', 'reserved')
    `;
    await sql`
      update readings set reservation_id = 'res_account_delete'
      where id = 'rdg_account_active'
    `;
    await sql`
      insert into generation_jobs (
        id, casting_session_id, reading_id, job_type, status, generation_epoch,
        snapshot, attempts, available_at, timeout_at, claimed_at
      ) values (
        'job_account_delete', 'cas_account_active', 'rdg_account_active', 'deep_reading',
        'running', 1, ${sql.json({ encrypted: true } as never)}, 1,
        clock_timestamp(), clock_timestamp() + interval '5 minutes', clock_timestamp()
      )
    `;
    await sql`
      insert into generation_attempts (
        id, job_id, generation_epoch, attempt_number, model_id, prompt_version,
        schema_version, status, started_at
      ) values (
        'att_account_delete', 'job_account_delete', 1, 1, 'model',
        'reading-prompt-v2.1', 'reading-v1', 'running', clock_timestamp()
      )
    `;
    await sql`
      insert into quality_reviews (
        id, reading_id, user_id, status, reason, response_due_at
      ) values (
        'qr_account_delete', 'rdg_account_review', 'usr_account_delete',
        'submitted', 'This contains private review detail.', clock_timestamp()
      )
    `;
  });

  afterAll(async () => {
    if (sql) await sql.end();
  });

  it("anonymizes identity, cancels work, revokes unused credits, and retains minimal finance records", async () => {
    const outcome = await service.requestDeletion({ userId: "usr_account_delete" });
    expect(outcome).toMatchObject({
      deleted: true,
      unusedCreditsRevoked: 3,
      openReviewsClosed: 1,
      retainedOrderCount: 1,
    });
    expect(outcome.contentPurgeAfter.getTime()).toBeGreaterThan(Date.now());

    expect((await sql`select email, deleted_at, anonymized_at from users where id = 'usr_account_delete'`)[0])
      .toMatchObject({ email: "deleted-test@deleted.invalid" });
    expect(await sql`select id from sessions where user_id = 'usr_account_delete'`).toHaveLength(0);
    expect(await sql`select id from auth_users where id = 'usr_account_delete'`).toHaveLength(0);
    expect(await sql`select id from auth_verifications where identifier = 'owner@example.com'`).toHaveLength(0);

    expect((await sql`
      select lifecycle from casting_sessions where id = 'cas_account_active'
    `)[0].lifecycle).toBe("user_deleted");
    expect((await sql`
      select status, error_code from generation_jobs where id = 'job_account_delete'
    `)[0]).toMatchObject({ status: "cancelled", error_code: "CASTING_DELETED" });
    expect((await sql`
      select status from reservations where id = 'res_account_delete'
    `)[0].status).toBe("released");
    expect((await sql`
      select quantity_available, quantity_reserved, quantity_revoked
      from entitlement_batches where id = 'bat_account_delete'
    `)[0]).toMatchObject({ quantity_available: 0, quantity_reserved: 0, quantity_revoked: 3 });
    expect(await sql`
      select id from entitlement_ledger
      where batch_id = 'bat_account_delete' and reason_code = 'account_deleted'
    `).toHaveLength(1);

    expect((await sql`
      select status, reason from quality_reviews where id = 'qr_account_delete'
    `)[0]).toMatchObject({ status: "rejected", reason: null });
    expect(await sql`select id from orders where id = 'ord_account_delete'`).toHaveLength(1);
    const inbox = (await sql`
      select payload from webhook_inbox where event_id = 'evt_account_delete'
    `)[0].payload;
    expect(JSON.stringify(inbox)).not.toContain("owner@example.com");
    expect(inbox).toMatchObject({
      eventId: "evt_account_delete",
      eventType: "checkout.completed",
      orderId: "ord_account_delete",
    });
    expect((await sql`
      select status, email_hmac, unused_credits_revoked, retained_order_count
      from account_deletion_requests where user_id = 'usr_account_delete'
    `)[0]).toMatchObject({
      status: "pending_content_purge",
      email_hmac: "email-digest",
      unused_credits_revoked: 3,
      retained_order_count: 1,
    });
  });

  it("physically purges content after the deadline while retaining pseudonymous finance and deletion audit rows", async () => {
    await service.requestDeletion({ userId: "usr_account_delete" });
    await sql`
      update account_deletion_requests set content_purge_after = clock_timestamp() - interval '1 second'
      where user_id = 'usr_account_delete'
    `;
    await sql`
      update users set content_purge_after = clock_timestamp() - interval '1 second'
      where id = 'usr_account_delete'
    `;
    await sql`
      update casting_sessions set purge_after = clock_timestamp() - interval '1 second'
      where user_id = 'usr_account_delete'
    `;

    await expect(service.purgeDue()).resolves.toEqual({ purged: 1 });
    expect(await sql`select id from casting_sessions where user_id = 'usr_account_delete'`).toHaveLength(0);
    expect(await sql`select id from question_versions where ciphertext like 'secret-question-%'`).toHaveLength(0);
    expect(await sql`select id from readings where id like 'rdg_account_%'`).toHaveLength(0);
    expect(await sql`select id from quality_reviews where id = 'qr_account_delete'`).toHaveLength(0);

    expect(await sql`select id from orders where id = 'ord_account_delete'`).toHaveLength(1);
    expect(await sql`select id from entitlement_batches where id = 'bat_account_delete'`).toHaveLength(1);
    expect(await sql`select id from entitlement_ledger where batch_id = 'bat_account_delete'`).not.toHaveLength(0);
    expect((await sql`
      select status, purged_at from account_deletion_requests where user_id = 'usr_account_delete'
    `)[0].status).toBe("purged");
    expect((await sql`select email from users where id = 'usr_account_delete'`)[0].email)
      .toBe("deleted-test@deleted.invalid");
  });

  it("is single-use and does not create duplicate revocation ledger entries", async () => {
    await service.requestDeletion({ userId: "usr_account_delete" });
    await expect(service.requestDeletion({ userId: "usr_account_delete" }))
      .rejects.toMatchObject({ code: "ACCOUNT_DELETION_NOT_AVAILABLE" });
    expect(await sql`
      select id from entitlement_ledger
      where batch_id = 'bat_account_delete' and reason_code = 'account_deleted'
    `).toHaveLength(1);
  });
});
