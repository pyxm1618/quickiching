import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migratePostgres, resetPostgresForTests } from "@/server/db/migrate";
import { PostgresQualityReviewService } from "./postgres-quality-review";

const databaseUrl = process.env.POSTGRES_TEST_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres("PostgreSQL quality review lifecycle", () => {
  let sql: Sql;
  let service: PostgresQualityReviewService;

  beforeAll(async () => {
    sql = postgres(databaseUrl!, { max: 10 });
    await migratePostgres(sql);
    service = new PostgresQualityReviewService(sql);
  });

  beforeEach(async () => {
    await resetPostgresForTests(sql);
  });

  afterAll(async () => {
    if (sql) await sql.end();
  });

  async function deliveredReading(input: {
    userId: string;
    castingId: string;
    readingId: string;
    deliveredAgo?: string;
  }) {
    await sql`insert into users (id, email) values (${input.userId}, ${`${input.userId}@example.com`})`;
    await sql`
      insert into casting_sessions (
        id, user_id, method, lifecycle, risk_status, scene, interpretation_goal,
        algorithm_version, revealed_at
      ) values (
        ${input.castingId}, ${input.userId}, 'three_coin', 'revealed', 'allowed',
        'career', 'what_should_i_pay_attention_to_next', 'three-coin-v1', clock_timestamp()
      )
    `;
    await sql`
      insert into readings (
        id, casting_session_id, status, report, schema_version, generation_epoch,
        created_at, updated_at
      ) values (
        ${input.readingId}, ${input.castingId}, 'completed',
        ${sql.json({ coreSummary: "delivered" } as never)}, 'reading-v1', 1,
        clock_timestamp(),
        clock_timestamp() - ${input.deliveredAgo ?? "0 seconds"}::interval
      )
    `;
  }

  it("calculates three operator business days while excluding weekends and configured holidays", async () => {
    await sql`
      insert into business_calendar_holidays (holiday_date, label)
      values ('2026-08-03', 'Operator holiday')
    `;
    const rows = await sql`
      select third_business_day_from('2026-07-31T10:30:00Z'::timestamptz) as due_at
    `;
    expect(new Date(rows[0].due_at).toISOString()).toBe("2026-08-06T10:30:00.000Z");
  });

  it("accepts one owned delivered report and rejects duplicates and foreign ownership", async () => {
    await deliveredReading({
      userId: "usr_review_owner",
      castingId: "cas_review_owner",
      readingId: "rdg_review_owner",
    });
    await sql`insert into users (id, email) values ('usr_review_other', 'other@example.com')`;

    const review = await service.submit({
      readingId: "rdg_review_owner",
      userId: "usr_review_owner",
      reason: "The moving-line explanation is missing.",
    });
    expect(review.status).toBe("submitted");
    expect(review.responseDueAt.getTime()).toBeGreaterThan(Date.now());

    await expect(service.submit({
      readingId: "rdg_review_owner",
      userId: "usr_review_owner",
      reason: "Duplicate request",
    })).rejects.toThrow("QUALITY_REVIEW_ALREADY_SUBMITTED");
    await expect(service.submit({
      readingId: "rdg_review_owner",
      userId: "usr_review_other",
      reason: "Unauthorized request",
    })).rejects.toThrow("QUALITY_REVIEW_NOT_DELIVERED");
  });

  it("closes submission after seven days and allows only one supplement within 24 hours", async () => {
    await deliveredReading({
      userId: "usr_review_window",
      castingId: "cas_review_window",
      readingId: "rdg_review_window",
      deliveredAgo: "8 days",
    });
    await expect(service.submit({
      readingId: "rdg_review_window",
      userId: "usr_review_window",
      reason: "Too late",
    })).rejects.toThrow("QUALITY_REVIEW_WINDOW_CLOSED");

    await deliveredReading({
      userId: "usr_review_supplement",
      castingId: "cas_review_supplement",
      readingId: "rdg_review_supplement",
    });
    const review = await service.submit({
      readingId: "rdg_review_supplement",
      userId: "usr_review_supplement",
      reason: "Initial objective defect",
    });
    const supplemented = await service.supplement({
      reviewId: review.reviewId,
      userId: "usr_review_supplement",
      additionalReason: "The cited method evidence is also inconsistent.",
    });
    expect(supplemented.status).toBe("supplementing");
    await expect(service.supplement({
      reviewId: review.reviewId,
      userId: "usr_review_supplement",
      additionalReason: "Second supplement",
    })).rejects.toThrow("QUALITY_REVIEW_SUPPLEMENT_CLOSED");

    await deliveredReading({
      userId: "usr_review_stale_supplement",
      castingId: "cas_review_stale_supplement",
      readingId: "rdg_review_stale_supplement",
    });
    const stale = await service.submit({
      readingId: "rdg_review_stale_supplement",
      userId: "usr_review_stale_supplement",
      reason: "Initial reason",
    });
    await sql`
      update quality_reviews set created_at = clock_timestamp() - interval '25 hours'
      where id = ${stale.reviewId}
    `;
    await expect(service.supplement({
      reviewId: stale.reviewId,
      userId: "usr_review_stale_supplement",
      additionalReason: "Late supplement",
    })).rejects.toThrow("QUALITY_REVIEW_SUPPLEMENT_CLOSED");
  });

  it("approves exactly once and atomically records one compensation credit and Ledger entry", async () => {
    await deliveredReading({
      userId: "usr_review_compensation",
      castingId: "cas_review_compensation",
      readingId: "rdg_review_compensation",
    });
    const review = await service.submit({
      readingId: "rdg_review_compensation",
      userId: "usr_review_compensation",
      reason: "Objective report defect",
    });

    const approved = await service.decide({ reviewId: review.reviewId, approved: true });
    expect(approved.status).toBe("approved");
    expect(approved.compensationBatchId).toMatch(/^bat_/);
    expect((await sql`
      select user_id, product_id, quality_review_id,
        quantity_total, quantity_available, quantity_reserved,
        quantity_consumed, quantity_revoked
      from entitlement_batches where id = ${approved.compensationBatchId}
    `)[0]).toMatchObject({
      user_id: "usr_review_compensation",
      product_id: "quality-review-compensation",
      quality_review_id: review.reviewId,
      quantity_total: 1,
      quantity_available: 1,
      quantity_reserved: 0,
      quantity_consumed: 0,
      quantity_revoked: 0,
    });
    expect(await sql`
      select id from entitlement_ledger
      where quality_review_id = ${review.reviewId}
        and action = 'compensate' and reason_code = 'quality_review_approved'
    `).toHaveLength(1);
    await expect(service.decide({ reviewId: review.reviewId, approved: true }))
      .rejects.toThrow("QUALITY_REVIEW_TERMINAL");
    expect(await sql`
      select id from entitlement_batches where quality_review_id = ${review.reviewId}
    `).toHaveLength(1);
  });
});
