import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  WaffoWebhookError,
  verifyAndNormalizeWaffoWebhook,
} from "./waffo-webhook";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

function signedEvent(overrides: Record<string, unknown> = {}) {
  const event = {
    id: "f28a36ef-0d74-4614-a14c-b59a77b3fcc7",
    timestamp: "2026-08-24T01:00:00.000Z",
    eventType: "order.completed",
    eventId: "PAY_business_123",
    storeId: "STO_test",
    storeName: "Quick I Ching",
    mode: "test",
    data: {
      orderId: "ORD_provider_123",
      buyerEmail: "buyer@example.com",
      merchantProvidedBuyerIdentity: "user-123",
      orderMerchantExternalId: "8b6d8846-cdce-4dde-9744-817b8329a5b6",
      currency: "USD",
      amount: "6.99",
      taxAmount: "0.00",
      total: "6.99",
      productName: "Three readings",
      paymentId: "PAY_provider_123",
      paymentStatus: "succeeded",
      orderMetadata: {
        internalOrderId: "8b6d8846-cdce-4dde-9744-817b8329a5b6",
        productKey: "three",
        providerProductId: "PROD_test_three",
      },
    },
    ...overrides,
  };
  const rawBody = JSON.stringify(event);
  const timestamp = String(Date.now());
  const signature = sign("RSA-SHA256", Buffer.from(`${timestamp}.${rawBody}`), privateKey).toString("base64");
  return { rawBody, signatureHeader: `t=${timestamp},v1=${signature}` };
}

const verifierConfig = {
  environment: "test" as const,
  storeId: "STO_test",
  publicKey: publicKey.export({ type: "spki", format: "pem" }).toString(),
};

describe("Waffo signed webhook boundary", () => {
  it("verifies the raw body before returning a PII-minimized normalized event", () => {
    const { rawBody, signatureHeader } = signedEvent();

    expect(verifyAndNormalizeWaffoWebhook(rawBody, signatureHeader, verifierConfig)).toEqual({
      provider: "waffo",
      providerEnvironment: "test",
      deliveryId: "f28a36ef-0d74-4614-a14c-b59a77b3fcc7",
      eventId: "PAY_business_123",
      eventType: "order.completed",
      storeId: "STO_test",
      orderMerchantExternalId: "8b6d8846-cdce-4dde-9744-817b8329a5b6",
      merchantProvidedBuyerIdentity: "user-123",
      internalOrderId: "8b6d8846-cdce-4dde-9744-817b8329a5b6",
      refundTicketMerchantExternalId: null,
      providerOrderId: "ORD_provider_123",
      providerPaymentId: "PAY_provider_123",
      productKey: "three",
      providerProductId: "PROD_test_three",
      currency: "USD",
      amountMinor: 699,
      taxAmount: "0.00",
      total: "6.99",
      canonicalPayloadSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      payloadSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      supported: true,
      manualReviewReason: null,
    });
    expect(JSON.stringify(verifyAndNormalizeWaffoWebhook(rawBody, signatureHeader, verifierConfig)))
      .not.toContain("buyer@example.com");
  });

  it("fails before payload handling when the signature is invalid", () => {
    const invalidRaw = "not-json-and-private-payload";
    expect(() => verifyAndNormalizeWaffoWebhook(invalidRaw, "t=1,v1=invalid", verifierConfig))
      .toThrowError(expect.objectContaining({ code: "WEBHOOK_SIGNATURE_INVALID" }));
  });

  it("fails closed for environment, store, amount, and currency mismatch", () => {
    const wrongEnvironment = signedEvent({ mode: "prod" });
    expect(() => verifyAndNormalizeWaffoWebhook(
      wrongEnvironment.rawBody,
      wrongEnvironment.signatureHeader,
      verifierConfig,
    )).toThrowError(expect.objectContaining({ code: "WEBHOOK_ENVIRONMENT_MISMATCH" }));

    const wrongStore = signedEvent({ storeId: "STO_other" });
    expect(() => verifyAndNormalizeWaffoWebhook(
      wrongStore.rawBody,
      wrongStore.signatureHeader,
      verifierConfig,
    )).toThrowError(expect.objectContaining({ code: "WEBHOOK_STORE_MISMATCH" }));

    const malformedAmount = signedEvent({
      data: {
        ...(JSON.parse(signedEvent().rawBody) as { data: Record<string, unknown> }).data,
        amount: "6.999",
      },
    });
    expect(() => verifyAndNormalizeWaffoWebhook(
      malformedAmount.rawBody,
      malformedAmount.signatureHeader,
      verifierConfig,
    )).toThrowError(expect.objectContaining({ code: "WEBHOOK_PAYLOAD_INVALID" }));

    const wrongCurrency = signedEvent({
      data: {
        ...(JSON.parse(signedEvent().rawBody) as { data: Record<string, unknown> }).data,
        currency: "EUR",
      },
    });
    expect(() => verifyAndNormalizeWaffoWebhook(
      wrongCurrency.rawBody,
      wrongCurrency.signatureHeader,
      verifierConfig,
    )).toThrowError(expect.objectContaining({ code: "WEBHOOK_CURRENCY_MISMATCH" }));
  });

  it("accepts a verified unsupported event only as an ignored normalized record", () => {
    const unsupported = signedEvent({ eventType: "subscription.activated" });
    const normalized = verifyAndNormalizeWaffoWebhook(
      unsupported.rawBody,
      unsupported.signatureHeader,
      verifierConfig,
    );
    expect(normalized.supported).toBe(false);
  });

  it("retains future chargeback or dispute events for manual review instead of ignoring them", () => {
    const chargeback = signedEvent({ eventType: "chargeback.opened", eventId: "CHB_business_1" });
    const normalized = verifyAndNormalizeWaffoWebhook(
      chargeback.rawBody,
      chargeback.signatureHeader,
      verifierConfig,
    );
    expect(normalized).toMatchObject({
      supported: true,
      manualReviewReason: "CHARGEBACK_POLICY_UNRESOLVED",
    });
  });

  it("uses typed safe failures", () => {
    const error = new WaffoWebhookError("WEBHOOK_PAYLOAD_INVALID", false);
    expect(error).toMatchObject({ code: "WEBHOOK_PAYLOAD_INVALID", retryable: false });
  });

  it("does not retain buyer email or other raw provider PII in the normalized event", () => {
    const { rawBody, signatureHeader } = signedEvent();
    const normalized = verifyAndNormalizeWaffoWebhook(rawBody, signatureHeader, verifierConfig);
    expect(normalized).not.toHaveProperty("buyerEmail");
    expect(JSON.stringify(normalized)).not.toContain("buyer@example.com");
    expect(normalized).toMatchObject({
      merchantProvidedBuyerIdentity: "user-123",
      internalOrderId: "8b6d8846-cdce-4dde-9744-817b8329a5b6",
    });
  });
});
