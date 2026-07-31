import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import { entitlementExpiry } from "@/domain/entitlements/pricing";
import { DomainError } from "@/server/errors/domain-error";

function id(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
}

export class PostgresQualityReviewService {
  constructor(private readonly database: Sql) {}

  async submit(input: {
    readingId: string;
    userId: string;
    reason: string;
  }): Promise<{ reviewId: string; status: string; responseDueAt: Date }> {
    const rows = await this.database`
      insert into quality_reviews (
        id, reading_id, user_id, status, reason, response_due_at
      )
      select ${id("qr")}, r.id, ${input.userId}, 'submitted', ${input.reason}, clock_timestamp()
      from readings r
      join casting_sessions c on c.id = r.casting_session_id
      where r.id = ${input.readingId} and c.user_id = ${input.userId}
      on conflict (reading_id) do nothing
      returning id, status, response_due_at
    `;
    if (!rows[0]) {
      const existing = await this.database`
        select 1 from quality_reviews where reading_id = ${input.readingId} limit 1
      `;
      if (existing[0]) {
        throw new DomainError(
          "QUALITY_REVIEW_ALREADY_SUBMITTED",
          "A review has already been submitted.",
          false,
        );
      }
      throw new DomainError(
        "QUALITY_REVIEW_NOT_DELIVERED",
        "This report is not available for review.",
        false,
      );
    }
    return {
      reviewId: String(rows[0].id),
      status: String(rows[0].status),
      responseDueAt: rows[0].response_due_at instanceof Date
        ? rows[0].response_due_at
        : new Date(String(rows[0].response_due_at)),
    };
  }

  async supplement(input: {
    reviewId: string;
    userId: string;
    additionalReason: string;
  }): Promise<{ reviewId: string; status: string; supplementedAt: Date }> {
    const rows = await this.database`
      update quality_reviews set
        status = 'supplementing',
        reason = concat_ws(E'\n\n', nullif(reason, ''), ${`Supplement: ${input.additionalReason}`})
      where id = ${input.reviewId} and user_id = ${input.userId}
        and status = 'submitted' and supplemented_at is null
      returning id, status, supplemented_at
    `;
    if (!rows[0]) {
      throw new DomainError(
        "QUALITY_REVIEW_SUPPLEMENT_CLOSED",
        "This review can no longer be supplemented.",
        false,
      );
    }
    return {
      reviewId: String(rows[0].id),
      status: String(rows[0].status),
      supplementedAt: rows[0].supplemented_at instanceof Date
        ? rows[0].supplemented_at
        : new Date(String(rows[0].supplemented_at)),
    };
  }

  async decide(input: {
    reviewId: string;
    approved: boolean;
  }): Promise<{
    reviewId: string;
    status: "approved" | "rejected";
    compensationBatchId: string | null;
  }> {
    return this.database.begin(async (tx) => {
      const nowRows = await tx`select clock_timestamp() as now`;
      const now = nowRows[0].now instanceof Date
        ? nowRows[0].now
        : new Date(String(nowRows[0].now));
      const rows = await tx`
        select * from quality_reviews where id = ${input.reviewId} for update
      `;
      const review = rows[0];
      if (!review) {
        throw new DomainError("QUALITY_REVIEW_NOT_FOUND", "Review not found.", false);
      }
      if (["approved", "rejected"].includes(String(review.status))) {
        throw new DomainError("QUALITY_REVIEW_TERMINAL", "This review is already closed.", false);
      }

      let compensationBatchId: string | null = null;
      if (input.approved) {
        compensationBatchId = id("bat");
        await tx`
          insert into entitlement_batches (
            id, user_id, product_id, quality_review_id, amount_usd,
            quantity_total, quantity_available, quantity_reserved, quantity_consumed,
            quantity_revoked, expires_at, created_at, updated_at
          ) values (
            ${compensationBatchId}, ${review.user_id}, 'quality-review-compensation',
            ${review.id}, 0, 1, 1, 0, 0, 0,
            ${entitlementExpiry(now)}, ${now}, ${now}
          )
        `;
        await tx`
          insert into entitlement_ledger (
            id, batch_id, action, quantity, quality_review_id,
            reason_code, created_at
          ) values (
            ${id("led")}, ${compensationBatchId}, 'compensate', 1,
            ${review.id}, 'quality_review_approved', ${now}
          )
        `;
      }

      const decided = await tx`
        update quality_reviews set
          status = ${input.approved ? "approved" : "rejected"},
          compensation_batch_id = ${compensationBatchId}
        where id = ${input.reviewId}
        returning id, status, compensation_batch_id
      `;
      return {
        reviewId: String(decided[0].id),
        status: String(decided[0].status) as "approved" | "rejected",
        compensationBatchId: decided[0].compensation_batch_id
          ? String(decided[0].compensation_batch_id)
          : null,
      };
    });
  }
}
