import { describe, expect, it, vi } from "vitest";
import { createWaffoAuthority } from "./waffo-authority";

const config = {
  environment: "test" as const,
  merchantId: "MER_test",
  privateKey: "private-key",
  storeId: "STO_test",
};

function payment(overrides: Record<string, unknown> = {}) {
  return {
    id: "PAY_test",
    orderId: "ORD_test",
    status: "succeeded",
    orderMerchantExternalId: "11111111-1111-4111-8111-111111111111",
    snapshotAmountDetails: { currency: "USD", total: "6.99" },
    onetimeOrder: {
      id: "ORD_test",
      testMode: true,
      store: { id: "STO_test" },
      onetimeProduct: { id: "PROD_test_three" },
    },
    subscriptionOrder: null,
    ...overrides,
  };
}

function fakeClient(input: {
  payments?: unknown[];
  paymentsCount?: number;
  refundTickets?: unknown[];
  refundTicketsCount?: number;
  refundTicket?: unknown;
  refunds?: unknown[];
  refundsCount?: number;
  createRefundTicket?: ReturnType<typeof vi.fn>;
}) {
  const customerOptions: unknown[] = [];
  const createRefundTicket = input.createRefundTicket ?? vi.fn(async () => ({
    ticket: {
      id: "RT_test",
      status: "pending",
      subjectId: "PAY_test",
      refundTicketMerchantExternalId: "22222222-2222-4222-8222-222222222222",
      metadata: JSON.stringify({ quickIChingRefundIntentId: "22222222-2222-4222-8222-222222222222" }),
    },
  }));
  const client = {
    auth: {
      issueSessionToken: vi.fn(async () => ({ token: "customer-token" })),
    },
    customer: vi.fn((_token: string, options: unknown) => {
      customerOptions.push(options);
      return { createRefundTicket };
    }),
    graphql: {
      query: vi.fn(async ({ query }: { query: string }) => {
        if (query.includes("refundTicket(id:")) {
          return { data: { refundTicket: input.refundTicket ?? null } };
        }
        if (query.includes("refundTickets(")) {
          return {
            data: {
              refundTickets: input.refundTickets ?? [],
              refundTicketsCount: input.refundTicketsCount ?? (input.refundTickets?.length ?? 0),
            },
          };
        }
        if (query.includes("refunds(")) {
          return {
            data: {
              refunds: input.refunds ?? [],
              refundsCount: input.refundsCount ?? (input.refunds?.length ?? 0),
            },
          };
        }
        if (query.includes("payments(")) {
          return {
            data: {
              payments: input.payments ?? [payment()],
              paymentsCount: input.paymentsCount ?? (input.payments?.length ?? 1),
            },
          };
        }
        throw new Error(`unexpected query: ${query}`);
      }),
    },
  };
  return { client, customerOptions, createRefundTicket };
}

describe("Waffo 0.19.1 authoritative one-time boundary", () => {
  it("accepts exactly one matching succeeded one-time payment", async () => {
    const fake = fakeClient({});
    const authority = createWaffoAuthority(config, () => fake.client as never);

    await expect(authority.getPayment({
      environment: "test",
      storeId: "STO_test",
      merchantOrderReference: "11111111-1111-4111-8111-111111111111",
      expectedProviderProductId: "PROD_test_three",
      expectedAmountMinor: 699,
      expectedCurrency: "USD",
    })).resolves.toEqual({
      status: "found",
      payment: {
        environment: "test",
        storeId: "STO_test",
        model: "one_time",
        merchantOrderReference: "11111111-1111-4111-8111-111111111111",
        providerOrderId: "ORD_test",
        providerPaymentId: "PAY_test",
        providerProductId: "PROD_test_three",
        status: "succeeded",
        amountMinor: 699,
        currency: "USD",
      },
    });
  });

  it("fails closed for subscription, wrong store/product, or multiple payment matches", async () => {
    const subscription = fakeClient({
      payments: [payment({ onetimeOrder: null, subscriptionOrder: { id: "ORD_test", store: { id: "STO_test" } } })],
    });
    await expect(createWaffoAuthority(config, () => subscription.client as never).getPayment({
      environment: "test", storeId: "STO_test",
      merchantOrderReference: "11111111-1111-4111-8111-111111111111",
      expectedProviderProductId: "PROD_test_three", expectedAmountMinor: 699, expectedCurrency: "USD",
    })).resolves.toEqual({ status: "contract_error" });

    const wrongProduct = fakeClient({ payments: [payment({
      onetimeOrder: { id: "ORD_test", testMode: true, store: { id: "STO_test" }, onetimeProduct: { id: "PROD_wrong" } },
    })] });
    await expect(createWaffoAuthority(config, () => wrongProduct.client as never).getPayment({
      environment: "test", storeId: "STO_test",
      merchantOrderReference: "11111111-1111-4111-8111-111111111111",
      expectedProviderProductId: "PROD_test_three", expectedAmountMinor: 699, expectedCurrency: "USD",
    })).resolves.toEqual({ status: "contract_error" });

    const multiple = fakeClient({ payments: [payment(), payment({ id: "PAY_other" })], paymentsCount: 2 });
    await expect(createWaffoAuthority(config, () => multiple.client as never).getPayment({
      environment: "test", storeId: "STO_test",
      merchantOrderReference: "11111111-1111-4111-8111-111111111111",
      expectedProviderProductId: "PROD_test_three", expectedAmountMinor: 699, expectedCurrency: "USD",
    })).resolves.toEqual({ status: "ambiguous" });
  });

  it("passes explicit customer environment and stable local refund correlation", async () => {
    const fake = fakeClient({});
    const authority = createWaffoAuthority(config, () => fake.client as never);
    const refundIntentId = "22222222-2222-4222-8222-222222222222";

    await expect(authority.requestRefund({
      environment: "test",
      storeId: "STO_test",
      buyerIdentity: "user-1",
      providerPaymentId: "PAY_test",
      merchantOrderReference: "11111111-1111-4111-8111-111111111111",
      expectedProviderProductId: "PROD_test_three",
      amountMinor: 699,
      currency: "USD",
      reason: "Customer request",
      refundIntentId,
    })).resolves.toEqual({ providerTicketId: "RT_test", status: "pending" });

    expect(fake.customerOptions).toEqual([{ environment: "test" }]);
    expect(fake.createRefundTicket).toHaveBeenCalledWith({
      paymentId: "PAY_test",
      reason: "Customer request",
      requestedAmount: { amount: "6.99", currency: "USD" },
      refundTicketMerchantExternalId: refundIntentId,
      metadata: { quickIChingRefundIntentId: refundIntentId },
    });
  });

  it("requires exact refund ticket correlation and exact refund relation", async () => {
    const refundIntentId = "22222222-2222-4222-8222-222222222222";
    const ticket = {
      id: "RT_test",
      status: "processing",
      subjectId: "PAY_test",
      refundTicketMerchantExternalId: refundIntentId,
      metadata: JSON.stringify({ quickIChingRefundIntentId: refundIntentId }),
    };
    const refund = {
      id: "RF_test",
      paymentId: "PAY_test",
      ticketId: "RT_test",
      status: "succeeded",
      testMode: true,
      requestedAmountDetails: { amount: "6.99", currency: "USD" },
      orderMerchantExternalId: "11111111-1111-4111-8111-111111111111",
      refundTicketMerchantExternalId: refundIntentId,
    };
    const fake = fakeClient({ refundTicket: ticket, refunds: [refund], refundsCount: 1 });
    const authority = createWaffoAuthority(config, () => fake.client as never);

    await expect(authority.getRefundSettlement({
      environment: "test", storeId: "STO_test", providerPaymentId: "PAY_test",
      merchantOrderReference: "11111111-1111-4111-8111-111111111111",
      expectedProviderOrderId: "ORD_test", expectedProviderProductId: "PROD_test_three", paymentAmountMinor: 699,
      amountMinor: 699, currency: "USD", refundIntentId, providerTicketId: "RT_test",
    })).resolves.toEqual({
      status: "succeeded",
      providerTicketId: "RT_test",
      providerRefundId: "RF_test",
      amountMinor: 699,
      currency: "USD",
    });

    const mismatched = fakeClient({ refundTicket: { ...ticket, refundTicketMerchantExternalId: "wrong" } });
    await expect(createWaffoAuthority(config, () => mismatched.client as never).getRefundSettlement({
      environment: "test", storeId: "STO_test", providerPaymentId: "PAY_test",
      merchantOrderReference: "11111111-1111-4111-8111-111111111111",
      expectedProviderOrderId: "ORD_test", expectedProviderProductId: "PROD_test_three", paymentAmountMinor: 699,
      amountMinor: 699, currency: "USD", refundIntentId, providerTicketId: "RT_test",
    })).resolves.toEqual({ status: "contract_error" });
  });
});
