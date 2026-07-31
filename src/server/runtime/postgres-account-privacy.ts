import { randomUUID } from "node:crypto";
import type { Sql, TransactionSql } from "postgres";
import { hmac } from "@/lib/crypto";
import { runtimeConfig } from "@/server/config";
import { DomainError } from "@/server/errors/domain-error";

const CONTENT_RECOVERY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function id(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
}

function asDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

type AccountPrivacyDependencies = {
  digestEmail(email: string): { digest: string; keyVersion: string };
  pseudonymousEmail(): string;
};

function defaultDependencies(): AccountPrivacyDependencies {
  return {
    digestEmail(email) {
      const keyVersion = runtimeConfig().keys.sessionSigning.writeVersion;
      return {
        digest: hmac(email.normalize("NFKC").trim().toLowerCase(), "anon", keyVersion),
        keyVersion,
      };
    },
    pseudonymousEmail: () => `deleted-${randomUUID()}@deleted.invalid`,
  };
}

export type AccountDeletionOutcome = {
  deleted: true;
  contentPurgeAfter: Date;
  unusedCreditsRevoked: number;
  openReviewsClosed: number;
  retainedOrderCount: number;
};

export class PostgresAccountPrivacyService {
  private readonly dependencies: AccountPrivacyDependencies;

  constructor(
    private readonly database: Sql,
    dependencies?: Partial<AccountPrivacyDependencies>,
  ) {
    this.dependencies = { ...defaultDependencies(), ...dependencies };
  }

  async requestDeletion(input: { userId: string }): Promise<AccountDeletionOutcome> {
    return this.database.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtextextended(${`account-delete:${input.userId}`}, 0))`;
      const now = await this.databaseClock(tx);
      const userRows = await tx`
        select * from users where id = ${input.userId} for update
      `;
      const user = userRows[0];
      if (!user || user.deleted_at) {
        throw new DomainError(
          "ACCOUNT_DELETION_NOT_AVAILABLE",
          "This account is not available for deletion.",
          false,
        );
      }

      const originalEmail = String(user.email).normalize("NFKC").trim().toLowerCase();
      const emailDigest = this.dependencies.digestEmail(originalEmail);
      const contentPurgeAfter = new Date(now.getTime() + CONTENT_RECOVERY_WINDOW_MS);

      const castings = await tx`
        select id from casting_sessions
        where user_id = ${input.userId}
        order by id asc
      `;
      for (const casting of castings) {
        const castingId = String(casting.id);
        await tx`select pg_advisory_xact_lock(hashtextextended(${`${castingId}:preview`}, 0))`;
        await tx`select pg_advisory_xact_lock(hashtextextended(${`${castingId}:deep_reading`}, 0))`;
      }

      await tx`
        update casting_sessions set
          lifecycle = 'user_deleted',
          deleted_at = coalesce(deleted_at, ${now}),
          purge_after = least(coalesce(purge_after, ${contentPurgeAfter}), ${contentPurgeAfter}),
          updated_at = ${now}
        where user_id = ${input.userId}
          and lifecycle <> 'user_deleted'
      `;
      await tx`
        update casting_sessions set
          deleted_at = coalesce(deleted_at, ${now}),
          purge_after = least(coalesce(purge_after, ${contentPurgeAfter}), ${contentPurgeAfter}),
          updated_at = ${now}
        where user_id = ${input.userId}
          and lifecycle = 'user_deleted'
      `;

      const closedReviews = await tx`
        update quality_reviews set status = 'rejected', reason = null
        where user_id = ${input.userId}
          and status not in ('approved', 'rejected')
        returning id
      `;
      await tx`
        update quality_reviews set reason = null
        where user_id = ${input.userId}
          and status in ('approved', 'rejected')
          and reason is not null
      `;

      const reservedRows = await tx`
        select coalesce(sum(quantity_reserved), 0)::integer as reserved
        from entitlement_batches where user_id = ${input.userId}
      `;
      if (Number(reservedRows[0].reserved) !== 0) {
        throw new DomainError(
          "ACCOUNT_DELETION_RESERVATION_ACTIVE",
          "The account still has an active generation reservation.",
          true,
        );
      }

      const batches = await tx`
        select * from entitlement_batches
        where user_id = ${input.userId} and quantity_available > 0
        order by id asc
        for update
      `;
      let unusedCreditsRevoked = 0;
      for (const batch of batches) {
        const quantity = Number(batch.quantity_available);
        if (quantity <= 0) continue;
        unusedCreditsRevoked += quantity;
        await tx`
          update entitlement_batches set
            quantity_available = 0,
            quantity_revoked = quantity_revoked + ${quantity},
            updated_at = ${now}
          where id = ${batch.id}
        `;
        await tx`
          insert into entitlement_ledger (
            id, batch_id, order_id, action, quantity, quality_review_id,
            reason_code, created_at
          ) values (
            ${id("led")}, ${batch.id}, ${batch.order_id ?? null}, 'revoke', ${quantity},
            ${batch.quality_review_id ?? null}, 'account_deleted', ${now}
          )
        `;
      }

      const orderRows = await tx`
        select count(*)::integer as count from orders where user_id = ${input.userId}
      `;
      const retainedOrderCount = Number(orderRows[0].count);
      await tx`
        update webhook_inbox set payload = jsonb_build_object(
          'eventId', event_id,
          'eventType', event_type,
          'orderId', order_id,
          'processedAt', processed_at,
          'signatureVerifiedAt', signature_verified_at
        )
        where order_id in (select id from orders where user_id = ${input.userId})
      `;

      await tx`delete from sessions where user_id = ${input.userId}`;
      await tx`
        delete from auth_users
        where id = ${input.userId} or lower(email) = ${originalEmail}
      `;
      await tx`
        delete from auth_verifications where lower(identifier) = ${originalEmail}
      `;

      const pseudonymousEmail = this.dependencies.pseudonymousEmail();
      await tx`
        update users set
          email = ${pseudonymousEmail},
          deleted_at = ${now},
          content_purge_after = ${contentPurgeAfter},
          anonymized_at = ${now}
        where id = ${input.userId}
      `;
      await tx`
        insert into account_deletion_requests (
          user_id, status, email_hmac, email_hmac_key_version,
          requested_at, content_purge_after, unused_credits_revoked,
          open_reviews_closed, retained_order_count, updated_at
        ) values (
          ${input.userId}, 'pending_content_purge', ${emailDigest.digest}, ${emailDigest.keyVersion},
          ${now}, ${contentPurgeAfter}, ${unusedCreditsRevoked},
          ${closedReviews.length}, ${retainedOrderCount}, ${now}
        )
      `;
      await tx`
        insert into audit_events (
          id, event_type, actor_id, entity_type, entity_id, safe_context, created_at
        ) values (
          ${id("aud")}, 'account.deletion_requested', ${input.userId}, 'user', ${input.userId},
          ${tx.json({
            contentPurgeAfter: contentPurgeAfter.toISOString(),
            unusedCreditsRevoked,
            openReviewsClosed: closedReviews.length,
            retainedOrderCount,
          } as never)}, ${now}
        )
      `;

      return {
        deleted: true as const,
        contentPurgeAfter,
        unusedCreditsRevoked,
        openReviewsClosed: closedReviews.length,
        retainedOrderCount,
      };
    });
  }

  async purgeDue(limit = 25): Promise<{ purged: number }> {
    const boundedLimit = Math.max(1, Math.min(limit, 100));
    return this.database.begin(async (tx) => {
      const now = await this.databaseClock(tx);
      const requests = await tx`
        select * from account_deletion_requests
        where status = 'pending_content_purge'
          and content_purge_after <= ${now}
        order by content_purge_after asc, user_id asc
        limit ${boundedLimit}
        for update skip locked
      `;

      for (const request of requests) {
        const userId = String(request.user_id);
        await tx`select pg_advisory_xact_lock(hashtextextended(${`account-delete:${userId}`}, 0))`;
        const castings = await tx`
          select id from casting_sessions where user_id = ${userId} order by id asc
        `;
        for (const casting of castings) {
          const castingId = String(casting.id);
          await tx`select pg_advisory_xact_lock(hashtextextended(${`${castingId}:preview`}, 0))`;
          await tx`select pg_advisory_xact_lock(hashtextextended(${`${castingId}:deep_reading`}, 0))`;
        }

        await tx`
          delete from quality_reviews
          where user_id = ${userId}
            and compensation_batch_id is null
        `;
        await tx`delete from casting_sessions where user_id = ${userId}`;
        await tx`delete from product_events where user_id = ${userId}`;
        await tx`
          update account_deletion_requests set
            status = 'purged', purged_at = ${now}, updated_at = ${now}
          where user_id = ${userId}
        `;
        await tx`
          insert into audit_events (
            id, event_type, actor_id, entity_type, entity_id, safe_context, created_at
          ) values (
            ${id("aud")}, 'account.content_purged', ${userId}, 'user', ${userId},
            ${tx.json({ retainedFinancialRecords: true } as never)}, ${now}
          )
        `;
      }
      return { purged: requests.length };
    });
  }

  private async databaseClock(tx: TransactionSql): Promise<Date> {
    const rows = await tx`select clock_timestamp() as now`;
    return asDate(rows[0].now);
  }
}
