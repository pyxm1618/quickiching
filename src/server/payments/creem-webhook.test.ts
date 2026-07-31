import { describe, expect, it } from "vitest";
import { parseCreemWebhook } from "./creem-webhook";

const receivedAt = new Date("2026-07-31T03:00:00.000Z");

describe("parseCreemWebhook", () => {
  it("parses checkout.completed with stable provider order and transaction identities", () => {
    const event = parseCreemWebhook(JSON.stringify({
      id: "evt_checkout",
      eventType: "checkout.completed",
      created_at: receivedAt.getTime(),
      object: {
        id: "ch_checkout",
        request_id: "request_checkout",
        transaction: { id: "tran_checkout" },
        order: {
          id: "provider_order_checkout",
          product: "prod_five",
          amount: 999,
          currency: "usd",
        },
      },
    }), receivedAt);

    expect(event).toMatchObject({
      eventType: "checkout.completed",
      providerOrderId: "provider_order_checkout",
      providerTransactionId: "tran_checkout",
      amountMinor: 999,
      currency: "USD",
    });
  });

  it("parses refund.created using transaction.order as the authoritative order link", () => {
    const event = parseCreemWebhook(JSON.stringify({
      id: "evt_refund",
      eventType: "refund.created",
      created_at: receivedAt.getTime(),
      object: {
        id: "ref_refund",
        status: "succeeded",
        refund_amount: 400,
        refund_currency: "usd",
        transaction: {
          id: "tran_checkout",
          order: "provider_order_checkout",
        },
      },
    }), receivedAt);

    expect(event).toMatchObject({
      eventType: "refund.created",
      refundId: "ref_refund",
      providerOrderId: "provider_order_checkout",
      providerTransactionId: "tran_checkout",
      amountMinor: 400,
      currency: "USD",
    });
  });

  it("parses dispute.created and rejects financial events without transaction order identity", () => {
    expect(parseCreemWebhook(JSON.stringify({
      id: "evt_dispute",
      eventType: "dispute.created",
      object: {
        id: "disp_dispute",
        amount: 999,
        currency: "USD",
        transaction: {
          id: "tran_checkout",
          order: { id: "provider_order_checkout" },
        },
      },
    }), receivedAt)).toMatchObject({
      eventType: "dispute.created",
      disputeId: "disp_dispute",
      providerOrderId: "provider_order_checkout",
    });

    expect(() => parseCreemWebhook(JSON.stringify({
      id: "evt_orphan_refund",
      eventType: "refund.created",
      object: {
        id: "ref_orphan",
        status: "succeeded",
        refund_amount: 100,
        refund_currency: "USD",
        transaction: { id: "tran_orphan" },
      },
    }), receivedAt)).toThrow("CREEM_WEBHOOK_SCHEMA_INVALID");
  });

  it("ignores unrelated subscription events after validating their envelope", () => {
    expect(parseCreemWebhook(JSON.stringify({
      id: "evt_subscription",
      eventType: "subscription.active",
      object: { id: "sub_1" },
    }), receivedAt)).toEqual(expect.objectContaining({
      eventId: "evt_subscription",
      eventType: "subscription.active",
      ignored: true,
    }));
  });
});
