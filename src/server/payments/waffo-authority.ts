import { WaffoPancake } from "@waffo/pancake-ts";
import type {
  AuthoritativePaymentLookup,
  RefundProviderAuthority,
  RefundSettlementLookup,
  RefundWriteResult,
} from "./provider-authority";

const PAYMENT_QUERY_LIMIT = 100;
const REFUND_TICKET_QUERY_LIMIT = 20;
const REFUND_QUERY_LIMIT = 2;
const READ_TIMEOUT_MS = 5_000;

class ProviderContractError extends Error {}

type ClientLike = {
  auth: {
    issueSessionToken(input: { storeId: string; buyerIdentity: string }): Promise<{ token: string }>;
  };
  customer(token: string, options: { environment: "test" | "prod" }): {
    createRefundTicket(input: {
      paymentId: string;
      reason: string;
      requestedAmount: { amount: string; currency: "USD" };
      refundTicketMerchantExternalId: string;
      metadata: Record<string, string>;
    }): Promise<{ ticket: unknown }>;
  };
  graphql: {
    query<T>(input: { query: string; variables?: Record<string, unknown> }): Promise<{
      data?: T;
      errors?: Array<{ message: string }>;
      warnings?: unknown[];
    }>;
  };
};

type WaffoAuthorityConfig = {
  environment: "test" | "prod";
  merchantId: string;
  privateKey: string;
  storeId: string;
  fetch?: typeof fetch;
};

type ClientFactory = (requestFetch?: typeof fetch) => ClientLike;

type RecordValue = Record<string, unknown>;

function record(value: unknown, field: string): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProviderContractError(`invalid ${field}`);
  }
  return value as RecordValue;
}

function string(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) throw new ProviderContractError(`invalid ${field}`);
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function boolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new ProviderContractError(`invalid ${field}`);
  return value;
}

function count(value: unknown, field: string, limit: number): number {
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > limit) {
    throw new ProviderContractError(`invalid ${field}`);
  }
  return Number(value);
}

function usdMinor(value: unknown): number {
  const amount = record(value, "amount");
  if (string(amount.currency, "amount.currency") !== "USD") throw new ProviderContractError("currency mismatch");
  const total = string(amount.total ?? amount.amount, "amount.total");
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(total);
  if (!match) throw new ProviderContractError("invalid amount");
  const result = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(result)) throw new ProviderContractError("invalid amount");
  return result;
}

function displayAmount(minor: number): string {
  if (!Number.isSafeInteger(minor) || minor <= 0) throw new ProviderContractError("invalid refund amount");
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`;
}

function paymentStatus(value: unknown): "pending" | "succeeded" | "failed" | "canceled" {
  if (value === "pending" || value === "succeeded" || value === "failed" || value === "canceled") return value;
  throw new ProviderContractError("invalid payment status");
}

function metadata(value: unknown): RecordValue | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") {
    try {
      return record(JSON.parse(value), "refund metadata");
    } catch (error) {
      if (error instanceof ProviderContractError) throw error;
      throw new ProviderContractError("invalid refund metadata");
    }
  }
  return record(value, "refund metadata");
}

function ticketStatus(value: unknown): RefundSettlementLookup["status"] {
  const status = string(value, "ticket.status");
  if (status === "pending" || status === "under_review") return "found_pending";
  if (status === "approved" || status === "processing" || status === "succeeded") return "found_processing";
  if (status === "failed" || status === "rejected" || status === "returned" || status === "cancelled") return "failed";
  throw new ProviderContractError("invalid refund ticket status");
}

function writeTicketStatus(value: unknown): RefundWriteResult["status"] {
  const status = string(value, "ticket.status");
  if (status === "pending" || status === "under_review") return "pending";
  if (status === "approved" || status === "processing") return "processing";
  if (status === "succeeded") return "succeeded";
  if (status === "failed" || status === "rejected" || status === "returned" || status === "cancelled") return "failed";
  throw new ProviderContractError("invalid refund ticket status");
}

function refundStatus(value: unknown): RefundSettlementLookup["status"] {
  if (value === "succeeded") return "succeeded";
  if (value === "pending") return "found_processing";
  if (value === "failed" || value === "cancelled") return "failed";
  throw new ProviderContractError("invalid refund status");
}

function scopedFetch(
  baseFetch: typeof fetch,
  inputSignal?: AbortSignal,
): { fetch: typeof fetch; cleanup: () => void } {
  const controller = new AbortController();
  const forwardAbort = () => controller.abort(inputSignal?.reason ?? new DOMException("aborted", "AbortError"));
  if (inputSignal?.aborted) forwardAbort();
  else inputSignal?.addEventListener("abort", forwardAbort, { once: true });
  const timeout = setTimeout(
    () => controller.abort(new DOMException("Waffo authoritative read timed out", "TimeoutError")),
    READ_TIMEOUT_MS,
  );
  return {
    fetch: (request, init) => baseFetch(request, { ...init, signal: controller.signal }),
    cleanup() {
      clearTimeout(timeout);
      inputSignal?.removeEventListener("abort", forwardAbort);
    },
  };
}

function exactEnvironment(
  config: WaffoAuthorityConfig,
  input: { environment: "test" | "prod"; storeId: string },
): void {
  if (input.environment !== config.environment || input.storeId !== config.storeId) {
    throw new ProviderContractError("Waffo environment/store mismatch");
  }
}

export function createWaffoAuthority(
  config: WaffoAuthorityConfig,
  injectedFactory?: ClientFactory,
): RefundProviderAuthority {
  const baseFetch = config.fetch ?? globalThis.fetch.bind(globalThis);
  const createClient: ClientFactory = injectedFactory ?? ((requestFetch) => new WaffoPancake({
    merchantId: config.merchantId,
    privateKey: config.privateKey,
    environment: config.environment,
    ...(requestFetch ? { fetch: requestFetch } : {}),
  }) as unknown as ClientLike);

  async function query<T>(
    client: ClientLike,
    queryText: string,
    variables: Record<string, unknown>,
  ): Promise<T> {
    const response = await client.graphql.query<T>({ query: queryText, variables });
    if (response.errors?.length || response.warnings?.length || response.data === undefined) {
      throw new ProviderContractError("Waffo GraphQL contract error");
    }
    return response.data;
  }

  async function getPayment(
    input: Parameters<RefundProviderAuthority["getPayment"]>[0],
  ): Promise<AuthoritativePaymentLookup> {
    try {
      exactEnvironment(config, input);
      if (!input.merchantOrderReference.trim() || !input.expectedProviderProductId.trim()) {
        return { status: "contract_error" };
      }
      const scoped = scopedFetch(baseFetch, input.signal);
      try {
        const client = createClient(scoped.fetch);
        const filter = input.providerPaymentId
          ? "{ id: { eq: $paymentId }, orderMerchantExternalId: { eq: $reference } }"
          : "{ orderMerchantExternalId: { eq: $reference } }";
        const variables: Record<string, unknown> = { reference: input.merchantOrderReference };
        if (input.providerPaymentId) variables.paymentId = input.providerPaymentId;
        const data = await query<{ payments?: unknown; paymentsCount?: unknown }>(
          client,
          `query (${input.providerPaymentId ? "$paymentId: String!, " : ""}$reference: String!) {
            payments(limit: ${PAYMENT_QUERY_LIMIT}, filter: ${filter}) {
              id
              orderId
              status
              orderMerchantExternalId
              snapshotAmountDetails { currency total }
              onetimeOrder { id testMode store { id } onetimeProduct { id } }
              subscriptionOrder { id store { id } }
            }
            paymentsCount(filter: ${filter})
          }`,
          variables,
        );
        if (!Array.isArray(data.payments)) return { status: "contract_error" };
        const paymentCount = count(data.paymentsCount, "paymentsCount", PAYMENT_QUERY_LIMIT);
        if (paymentCount !== data.payments.length) return { status: "contract_error" };
        if (paymentCount === 0) return { status: "not_found" };
        if (paymentCount !== 1) return { status: "ambiguous" };

        const payment = record(data.payments[0], "payment");
        const providerPaymentId = string(payment.id, "payment.id");
        if (input.providerPaymentId && providerPaymentId !== input.providerPaymentId) return { status: "contract_error" };
        const providerOrderId = string(payment.orderId, "payment.orderId");
        if (input.expectedProviderOrderId && providerOrderId !== input.expectedProviderOrderId) return { status: "contract_error" };
        const merchantOrderReference = string(payment.orderMerchantExternalId, "payment.orderMerchantExternalId");
        if (merchantOrderReference !== input.merchantOrderReference) return { status: "contract_error" };

        const oneTime = payment.onetimeOrder == null ? null : record(payment.onetimeOrder, "payment.onetimeOrder");
        const subscription = payment.subscriptionOrder == null ? null : record(payment.subscriptionOrder, "payment.subscriptionOrder");
        if (!oneTime || subscription) return { status: "contract_error" };
        if (string(oneTime.id, "payment.onetimeOrder.id") !== providerOrderId) return { status: "contract_error" };
        if (boolean(oneTime.testMode, "payment.onetimeOrder.testMode") !== (input.environment === "test")) {
          return { status: "contract_error" };
        }
        const store = record(oneTime.store, "payment.onetimeOrder.store");
        const storeId = string(store.id, "payment.onetimeOrder.store.id");
        if (storeId !== input.storeId) return { status: "contract_error" };
        const product = record(oneTime.onetimeProduct, "payment.onetimeOrder.onetimeProduct");
        const providerProductId = string(product.id, "payment.onetimeOrder.onetimeProduct.id");
        if (providerProductId !== input.expectedProviderProductId) return { status: "contract_error" };
        const amountMinor = usdMinor(payment.snapshotAmountDetails);
        if (input.expectedCurrency !== "USD" || amountMinor !== input.expectedAmountMinor) {
          return { status: "contract_error" };
        }
        return {
          status: "found",
          payment: {
            environment: input.environment,
            storeId,
            model: "one_time",
            merchantOrderReference,
            providerOrderId,
            providerPaymentId,
            providerProductId,
            status: paymentStatus(payment.status),
            amountMinor,
            currency: "USD",
          },
        };
      } finally {
        scoped.cleanup();
      }
    } catch (error) {
      if (error instanceof ProviderContractError) return { status: "contract_error" };
      throw error;
    }
  }

  async function requestRefund(
    input: Parameters<RefundProviderAuthority["requestRefund"]>[0],
  ): Promise<RefundWriteResult> {
    exactEnvironment(config, input);
    const authoritative = await getPayment({
      environment: input.environment,
      storeId: input.storeId,
      merchantOrderReference: input.merchantOrderReference,
      providerPaymentId: input.providerPaymentId,
      expectedProviderProductId: input.expectedProviderProductId,
      expectedAmountMinor: input.amountMinor,
      expectedCurrency: input.currency,
    });
    if (authoritative.status !== "found" || authoritative.payment.status !== "succeeded") {
      throw new ProviderContractError("refund payment is not authoritative");
    }
    const client = createClient();
    const session = await client.auth.issueSessionToken({
      storeId: input.storeId,
      buyerIdentity: input.buyerIdentity,
    });
    const customer = client.customer(session.token, { environment: input.environment });
    const result = await customer.createRefundTicket({
      paymentId: input.providerPaymentId,
      reason: input.reason,
      requestedAmount: { amount: displayAmount(input.amountMinor), currency: "USD" },
      refundTicketMerchantExternalId: input.refundIntentId,
      metadata: { quickIChingRefundIntentId: input.refundIntentId },
    });
    const ticket = record(result.ticket, "refund ticket");
    const providerTicketId = string(ticket.id, "refund ticket.id");
    if (string(ticket.subjectId, "refund ticket.subjectId") !== input.providerPaymentId) {
      throw new ProviderContractError("refund ticket payment mismatch");
    }
    if (string(ticket.refundTicketMerchantExternalId, "refund ticket.refundTicketMerchantExternalId") !== input.refundIntentId) {
      throw new ProviderContractError("refund ticket correlation mismatch");
    }
    const ticketMetadata = metadata(ticket.metadata);
    if (ticketMetadata?.quickIChingRefundIntentId !== undefined
      && ticketMetadata.quickIChingRefundIntentId !== input.refundIntentId) {
      throw new ProviderContractError("refund ticket metadata correlation mismatch");
    }
    return { providerTicketId, status: writeTicketStatus(ticket.status) };
  }

  async function getRefundSettlement(
    input: Parameters<RefundProviderAuthority["getRefundSettlement"]>[0],
  ): Promise<RefundSettlementLookup> {
    try {
      exactEnvironment(config, input);
      const authoritative = await getPayment({
        environment: input.environment,
        storeId: input.storeId,
        merchantOrderReference: input.merchantOrderReference,
        providerPaymentId: input.providerPaymentId,
        expectedProviderOrderId: input.expectedProviderOrderId,
        expectedProviderProductId: input.expectedProviderProductId,
        expectedAmountMinor: input.paymentAmountMinor,
        expectedCurrency: input.currency,
        signal: input.signal,
      });
      if (authoritative.status === "ambiguous") return { status: "ambiguous" };
      if (authoritative.status !== "found" || authoritative.payment.status !== "succeeded") {
        return { status: "contract_error" };
      }

      const scoped = scopedFetch(baseFetch, input.signal);
      try {
        const client = createClient(scoped.fetch);
        let ticket: RecordValue | undefined;
        if (input.providerTicketId) {
          const data = await query<{ refundTicket?: unknown }>(
            client,
            `query ($ticketId: String!) {
              refundTicket(id: $ticketId) {
                id status subjectId metadata refundTicketMerchantExternalId
              }
            }`,
            { ticketId: input.providerTicketId },
          );
          if (data.refundTicket != null) ticket = record(data.refundTicket, "refundTicket");
        } else {
          const data = await query<{ refundTickets?: unknown; refundTicketsCount?: unknown }>(
            client,
            `query ($reference: String!) {
              refundTickets(limit: ${REFUND_TICKET_QUERY_LIMIT}, filter: { refundTicketMerchantExternalId: { eq: $reference } }) {
                id status subjectId metadata refundTicketMerchantExternalId
              }
              refundTicketsCount(filter: { refundTicketMerchantExternalId: { eq: $reference } })
            }`,
            { reference: input.refundIntentId },
          );
          if (!Array.isArray(data.refundTickets)) return { status: "contract_error" };
          const ticketCount = count(data.refundTicketsCount, "refundTicketsCount", REFUND_TICKET_QUERY_LIMIT);
          if (ticketCount !== data.refundTickets.length) return { status: "contract_error" };
          if (ticketCount > 1) return { status: "ambiguous" };
          if (ticketCount === 1) ticket = record(data.refundTickets[0], "refundTicket");

          if (!ticket) {
            const fallback = await query<{ refundTickets?: unknown; refundTicketsCount?: unknown }>(
              client,
              `query ($paymentId: String!) {
                refundTickets(limit: ${REFUND_TICKET_QUERY_LIMIT}, filter: { subjectId: { eq: $paymentId } }) {
                  id status subjectId metadata refundTicketMerchantExternalId
                }
                refundTicketsCount(filter: { subjectId: { eq: $paymentId } })
              }`,
              { paymentId: input.providerPaymentId },
            );
            if (!Array.isArray(fallback.refundTickets)) return { status: "contract_error" };
            const fallbackCount = count(fallback.refundTicketsCount, "refundTicketsCount", REFUND_TICKET_QUERY_LIMIT);
            if (fallbackCount !== fallback.refundTickets.length) return { status: "contract_error" };
            const correlated = fallback.refundTickets
              .map((value) => record(value, "refundTicket"))
              .filter((candidate) => metadata(candidate.metadata)?.quickIChingRefundIntentId === input.refundIntentId);
            if (correlated.length > 1) return { status: "ambiguous" };
            ticket = correlated[0];
          }
        }

        if (!ticket) return { status: "not_found" };
        const providerTicketId = string(ticket.id, "refundTicket.id");
        if (input.providerTicketId && providerTicketId !== input.providerTicketId) return { status: "contract_error" };
        if (string(ticket.subjectId, "refundTicket.subjectId") !== input.providerPaymentId) return { status: "contract_error" };
        const merchantCorrelation = optionalString(ticket.refundTicketMerchantExternalId);
        const metadataCorrelation = metadata(ticket.metadata)?.quickIChingRefundIntentId;
        if (merchantCorrelation !== undefined && merchantCorrelation !== input.refundIntentId) return { status: "contract_error" };
        if (metadataCorrelation !== undefined && metadataCorrelation !== input.refundIntentId) return { status: "contract_error" };
        if (merchantCorrelation !== input.refundIntentId && metadataCorrelation !== input.refundIntentId) {
          return { status: "contract_error" };
        }

        const refundData = await query<{ refunds?: unknown; refundsCount?: unknown }>(
          client,
          `query ($ticketId: String!) {
            refunds(limit: ${REFUND_QUERY_LIMIT}, filter: { ticketId: { eq: $ticketId } }) {
              id paymentId ticketId status testMode
              requestedAmountDetails { amount currency }
              orderMerchantExternalId refundTicketMerchantExternalId
            }
            refundsCount(filter: { ticketId: { eq: $ticketId } })
          }`,
          { ticketId: providerTicketId },
        );
        if (!Array.isArray(refundData.refunds)) return { status: "contract_error" };
        const refundCount = count(refundData.refundsCount, "refundsCount", REFUND_QUERY_LIMIT);
        if (refundCount !== refundData.refunds.length) return { status: "contract_error" };
        if (refundCount > 1) return { status: "ambiguous" };
        if (refundCount === 0) {
          return {
            status: ticketStatus(ticket.status),
            providerTicketId,
            providerRefundId: null,
            amountMinor: input.amountMinor,
            currency: "USD",
          };
        }

        const refund = record(refundData.refunds[0], "refund");
        if (string(refund.paymentId, "refund.paymentId") !== input.providerPaymentId) return { status: "contract_error" };
        if (string(refund.ticketId, "refund.ticketId") !== providerTicketId) return { status: "contract_error" };
        if (boolean(refund.testMode, "refund.testMode") !== (input.environment === "test")) return { status: "contract_error" };
        if (string(refund.orderMerchantExternalId, "refund.orderMerchantExternalId") !== input.merchantOrderReference) {
          return { status: "contract_error" };
        }
        const refundCorrelation = optionalString(refund.refundTicketMerchantExternalId);
        if (refundCorrelation !== undefined && refundCorrelation !== input.refundIntentId) return { status: "contract_error" };
        const amountMinor = usdMinor(refund.requestedAmountDetails);
        if (amountMinor !== input.amountMinor) return { status: "contract_error" };
        return {
          status: refundStatus(refund.status),
          providerTicketId,
          providerRefundId: string(refund.id, "refund.id"),
          amountMinor,
          currency: "USD",
        };
      } finally {
        scoped.cleanup();
      }
    } catch (error) {
      if (error instanceof ProviderContractError) return { status: "contract_error" };
      throw error;
    }
  }

  return { getPayment, requestRefund, getRefundSettlement };
}
