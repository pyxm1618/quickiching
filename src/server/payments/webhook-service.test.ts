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

describe("Waffo webhook ingestion service", () => {
  it("verifies before persistence and processes only the normalized event", async () => {
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
        processInbox: async () => {
          calls.push("process");
          return { outcome: "granted" };
        },
        recordProcessingFailure: async () => ({ deadLetter: false, attemptCount: 1 }),
      },
    });

    await expect(service.ingest("raw-private-payload", "signature-secret")).resolves.toEqual({
      disposition: "processed",
      duplicate: null,
      outcome: "granted",
    });
    expect(calls).toEqual(["verify", "persist", "process"]);
  });

  it("does not persist anything when signature verification rejects", async () => {
    const recordVerifiedEvent = vi.fn();
    const service = createWaffoWebhookService({
      verifyAndNormalize: () => { throw new Error("signature and payload details"); },
      repository: {
        recordVerifiedEvent,
        processInbox: vi.fn(),
        recordProcessingFailure: vi.fn(),
      },
    });

    await expect(service.ingest("private-payload", "private-signature")).rejects.toThrow("signature and payload details");
    expect(recordVerifiedEvent).not.toHaveBeenCalled();
  });

  it("reprocesses the retained original Inbox row on a duplicate delivery", async () => {
    const processInbox = vi.fn(async () => ({ outcome: "pending_order" }));
    const service = createWaffoWebhookService({
      verifyAndNormalize: () => event,
      repository: {
        recordVerifiedEvent: async () => ({ inboxId: "original-inbox", duplicate: "delivery" }),
        processInbox,
        recordProcessingFailure: async () => ({ deadLetter: false, attemptCount: 1 }),
      },
    });

    await expect(service.ingest("raw", "signature")).resolves.toMatchObject({
      disposition: "accepted",
      duplicate: "delivery",
      outcome: "pending_order",
    });
    expect(processInbox).toHaveBeenCalledWith("original-inbox");
  });

  it("returns only a bounded retry error and never acknowledges a dead-letter", async () => {
    let deadLetter = false;
    const failure = vi.fn(async () => ({ deadLetter, attemptCount: deadLetter ? 3 : 1 }));
    const service = createWaffoWebhookService({
      verifyAndNormalize: () => event,
      repository: {
        recordVerifiedEvent: async () => ({ inboxId: "inbox-1", duplicate: null }),
        processInbox: async () => { throw new Error("database password and private payload"); },
        recordProcessingFailure: failure,
      },
    });

    await expect(service.ingest("raw", "signature")).rejects.toEqual(
      new WebhookServiceError("WEBHOOK_PROCESSING_UNAVAILABLE", true),
    );
    expect(JSON.stringify(failure.mock.calls)).not.toContain("database password");

    deadLetter = true;
    await expect(service.ingest("raw", "signature")).rejects.toEqual(
      new WebhookServiceError("WEBHOOK_DEAD_LETTERED", true),
    );
  });

  it("does not map an actively leased inbox to processed", async () => {
    const service = createWaffoWebhookService({
      verifyAndNormalize: () => event,
      repository: {
        recordVerifiedEvent: async () => ({ inboxId: "inbox-processing", duplicate: null }),
        processInbox: async () => ({ outcome: "processing" }),
        recordProcessingFailure: async () => ({ deadLetter: false, attemptCount: 1 }),
      },
    });

    await expect(service.ingest("raw", "signature")).rejects.toEqual(
      new WebhookServiceError("WEBHOOK_PROCESSING_UNAVAILABLE", true),
    );
  });
});
