import type { Sql } from "postgres";
import type { PaymentRecoveryCandidate, PaymentRecoveryRepository } from "./payment-recovery-service";

type Row = Record<string, unknown>;

function mapCandidate(row: Row): PaymentRecoveryCandidate {
  const environment = String(row.provider_environment);
  if (environment !== "test" && environment !== "prod") throw new Error("PAYMENT_RECOVERY_ENVIRONMENT_INVALID");
  if (String(row.currency) !== "USD") throw new Error("PAYMENT_RECOVERY_CURRENCY_INVALID");
  return {
    orderId: String(row.id),
    environment,
    providerProductId: String(row.provider_product_id),
    amountMinor: Number(row.amount_minor),
    currency: "USD",
  };
}

export class PostgresPaymentRecoveryRepository implements PaymentRecoveryRepository {
  constructor(private readonly sql: Sql) {}

  async listCandidates(input: { limit: number; now: Date }): Promise<PaymentRecoveryCandidate[]> {
    if (!Number.isFinite(input.now.getTime())) throw new Error("PAYMENT_RECOVERY_INVALID");
    const limit = Math.max(1, Math.min(input.limit, 20));
    const rows = await this.sql`
      select id, provider_environment, provider_product_id, amount_minor, currency
      from payment_orders
      where provider = 'waffo'
        and (
          (status = 'checkout_created' and checkout_expires_at is not null and checkout_expires_at <= ${input.now.toISOString()})
          or (status = 'checkout_initializing' and checkout_claim_expires_at is not null and checkout_claim_expires_at <= ${input.now.toISOString()})
          or (
            status = 'financial_review'
            and checkout_error_code in ('CHECKOUT_EXPIRED', 'CHECKOUT_PROVIDER_OUTCOME_UNCERTAIN', 'PAYMENT_PROVIDER_READ_UNAVAILABLE')
          )
        )
      order by updated_at asc, created_at asc, id asc
      limit ${limit}
    ` as Row[];
    return rows.map(mapCandidate);
  }

  async markFinancialReview(input: { orderId: string; errorCode: string; now: Date }): Promise<void> {
    await this.sql.begin(async (transaction) => {
      const rows = await transaction`
        select id, status from payment_orders where id = ${input.orderId} limit 1 for update
      ` as Row[];
      const row = rows[0];
      if (!row || String(row.status) === "paid" || String(row.status) === "refunded") return;
      await transaction`
        update payment_orders
        set status = 'financial_review',
            checkout_error_code = ${input.errorCode},
            checkout_claim_token = null,
            checkout_claim_expires_at = null,
            provider_checkout_session_id = null,
            provider_checkout_url = null,
            checkout_expires_at = null,
            updated_at = ${input.now.toISOString()}
        where id = ${input.orderId}
      `;
    });
  }
}
