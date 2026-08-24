import { describe, expect, it } from "vitest";
import {
  checkoutCapabilityStatus,
  isCheckoutCapabilityEnabled,
  isWebhookIngestionCapabilityEnabled,
  webhookIngestionCapabilityStatus,
} from "./capability";

describe("payment capability request gates", () => {
  it("defaults checkout and webhook to disabled and fails malformed flags closed", () => {
    expect(isCheckoutCapabilityEnabled({})).toBe(false);
    expect(isWebhookIngestionCapabilityEnabled({})).toBe(false);
    expect(checkoutCapabilityStatus({ COMMERCIAL_V2_CHECKOUT_ENABLED: "maybe" })).toBeNull();
    expect(webhookIngestionCapabilityStatus({ COMMERCIAL_V2_WEBHOOK_INGESTION_ENABLED: "maybe" })).toBeNull();
  });

  it("keeps webhook disabled while the durable payment consumer is unavailable", () => {
    const environment = {
      COMMERCIAL_V2_WEBHOOK_INGESTION_ENABLED: "true",
      PAYMENT_ADAPTER_MODE: "waffo",
      DATABASE_ADAPTER_MODE: "postgres",
      DATABASE_URL: "postgresql://user:password@db.example.com/quickiching",
      WAFFO_ENVIRONMENT: "test",
      WAFFO_STORE_ID: "STO_test",
    };
    expect(webhookIngestionCapabilityStatus(environment)).toMatchObject({
      enabled: false,
      reason: "implementation_not_available",
    });
    expect(checkoutCapabilityStatus(environment)).toMatchObject({ enabled: false, reason: "disabled" });
  });
});
