import { describe, expect, it, vi } from "vitest";
import { createWaffoAuthority } from "./waffo-authority";

const config = {
  environment: "test" as const,
  merchantId: "MER_test",
  privateKey: "private-key",
  storeId: "STO_test",
};

function client() {
  return {
    auth: { issueSessionToken: vi.fn() },
    customer: vi.fn(),
    graphql: {
      query: vi.fn(async ({ query }: { query: string }) => {
        if (query.includes("payments(")) {
          return {
            data: {
              payments: [{
                id: "PAY_test",
                orderId: "ORD_provider",
                status: "succeeded",
                orderMerchantExternalId: "11111111-1111-4111-8111-111111111111",
                snapshotAmountDetails: { currency: "USD", total: "6.99" },
                onetimeOrder: {
                  id: "ORD_provider",
                  testMode: true,
                  store: { id: "STO_test" },
                  onetimeProduct: { id: "PROD_test_three" },
                },
                subscriptionOrder: null,
              }],
              paymentsCount: 1,
            },
          };
        }
        throw new Error(`unexpected query: ${query}`);
      }),
    },
  };
}

describe("Waffo authoritative provider order identity", () => {
  it("fails closed when the provider payment belongs to a different provider order", async () => {
    const fake = client();
    const authority = createWaffoAuthority(config, () => fake as never);

    await expect(authority.getPayment({
      environment: "test",
      storeId: "STO_test",
      merchantOrderReference: "11111111-1111-4111-8111-111111111111",
      providerPaymentId: "PAY_test",
      expectedProviderOrderId: "ORD_expected",
      expectedProviderProductId: "PROD_test_three",
      expectedAmountMinor: 699,
      expectedCurrency: "USD",
    })).resolves.toEqual({ status: "contract_error" });
  });

  it("fails refund reconciliation before ticket lookup on provider-order mismatch", async () => {
    const fake = client();
    const authority = createWaffoAuthority(config, () => fake as never);

    await expect(authority.getRefundSettlement({
      environment: "test",
      storeId: "STO_test",
      providerPaymentId: "PAY_test",
      merchantOrderReference: "11111111-1111-4111-8111-111111111111",
      expectedProviderOrderId: "ORD_expected",
      expectedProviderProductId: "PROD_test_three",
      paymentAmountMinor: 699,
      amountMinor: 699,
      currency: "USD",
      refundIntentId: "22222222-2222-4222-8222-222222222222",
    })).resolves.toEqual({ status: "contract_error" });
    expect(fake.graphql.query).toHaveBeenCalledTimes(1);
  });
});
