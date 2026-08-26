import { describe, expect, it, vi } from "vitest";
import type { NormalizedWaffoWebhook } from "./waffo-webhook";
import { createWaffoWebhookService, WebhookServiceError } from "./webhook-service";

const event: NormalizedWaffoWebhook = {
  provider: "waffo",
  providerEnvironment: "test",
  deliveryId: "delivery-1",
  eventId: "PAY_1",
  eventType: "order.completed",
  storeId: "STO_test",
  orderMerchantExternalId: "8b6d8846-cdce-4dde-9744-817b8329a5b6",
  merchantProvidedBuyerIdentity: "user-123",
  internalOrderId: "8b6d8846-cdce-4dde-9744-817b8329a5b6",
  refundTicketMerchantExternalId: null,
  providerOrderId: "ORD_1",
  providerPaymentId: "PAYMENT_1",
  productKey: "three",
  providerProductId: "PROD_test_three",
  currency: "USD",
  amountMinor: 699,
  taxAmount: "0.00",
  total: "6.99",
  payloadSha256: "hash",
  canonicalPayloadSha256: "canonical-hash",
  supported: true,
  manualReviewReason: null,
};

describe("Waffo webhook ingestion service (Durable)", () => {
  it("verifies before persistence and records only the normalized event", async () => {
    const calls: string[] = [];
    const recordVerifiedEvent = vi.fn(async (value: NormalizedWaffoWebhook) => {
      calls.push("persist");
      expect(value).toBe(event);
      return { inboxId: "inbox-1", duplicate: null as null };
    });
    const service = createWaffoWebhookService({
      verifyAndNormalize: (raw, signature) => {
        calls.push("verify");
        expect(raw).toBe("raw-private-payload");
        expect(signature).toBe("signature-secret");
        return event;
      },
      repository: {
        recordVerifiedEvent,
      },
    });

    await expect(service.ingest("raw-private-payload", "signature-secret")).resolves.toEqual({
      disposition: "accepted",
      duplicate: null,
      inboxId: "inbox-1",
    });
    expect(calls).toEqual(["verify", "persist"]);
  });

  it("does not persist anything when signature verification rejects", async () => {
    const recordVerifiedEvent = vi.fn();
    const service = createWaffoWebhookService({
      verifyAndNormalize: () => { throw new Error("signature and payload details"); },
      repository: {
        recordVerifiedEvent,
      },
    });

    await expect(service.ingest("private-payload", "private-signature")).rejects.toThrow("signature and payload details");
    expect(recordVerifiedEvent).not.toHaveBeenCalled();
  });

  it("returns accepted with duplicate: delivery on duplicate delivery", async () => {
    const service = createWaffoWebhookService({
      verifyAndNormalize: () => event,
      repository: {
        recordVerifiedEvent: async () => ({ inboxId: "original-inbox", duplicate: "delivery" }),
      },
    });

    await expect(service.ingest("raw", "signature")).resolves.toEqual({
      disposition: "accepted",
      duplicate: "delivery",
      inboxId: "original-inbox",
    });
  });

  it("maps conflict errors to WEBHOOK_SECURITY_CONFLICT", async () => {
    const service = createWaffoWebhookService({
      verifyAndNormalize: () => event,
      repository: {
        recordVerifiedEvent: async () => {
          throw new Error("WEBHOOK_DELIVERY_CONFLICT");
        },
      },
    });

    await expect(service.ingest("raw", "signature")).rejects.toEqual(
      new WebhookServiceError("WEBHOOK_SECURITY_CONFLICT", false),
    );
  });
});
