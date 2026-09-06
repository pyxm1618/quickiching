import { describe, expect, it } from "vitest";
import { loadRuntimeConfig } from "@/server/config";

describe("Waffo application environment contract", () => {
  it("fails closed when a production app is wired to the Waffo test environment", () => {
    const config = loadRuntimeConfig({
      NODE_ENV: "production",
      APP_ENV: "production",
      PAYMENT_ADAPTER_MODE: "waffo",
      COMMERCIAL_V2_WEBHOOK_INGESTION_ENABLED: "true",
      DATABASE_ADAPTER_MODE: "postgres",
      DATABASE_URL: "postgresql://user:password@db.example.com/quickiching",
      WAFFO_ENVIRONMENT: "test",
      WAFFO_STORE_ID: "STO_test",
      WAFFO_TEST_PRODUCT_ID_ONE: "prod_test_one",
      WAFFO_TEST_PRODUCT_ID_THREE: "prod_test_three",
      WAFFO_TEST_PRODUCT_ID_FIVE: "prod_test_five",
    });

    expect(config.capabilities.capabilities.webhookIngestion).toMatchObject({
      enabled: false,
      reason: "invalid_dependencies",
    });
    expect(config.capabilities.capabilities.webhookIngestion.invalidDependencies).toContain(
      "APP_ENV_WAFFO_ENVIRONMENT_MISMATCH",
    );
  });

  it("allows staging to use Waffo test explicitly", () => {
    const config = loadRuntimeConfig({
      NODE_ENV: "production",
      APP_ENV: "staging",
      PAYMENT_ADAPTER_MODE: "waffo",
      COMMERCIAL_V2_WEBHOOK_INGESTION_ENABLED: "true",
      DATABASE_ADAPTER_MODE: "postgres",
      DATABASE_URL: "postgresql://user:password@db.example.com/quickiching",
      WAFFO_ENVIRONMENT: "test",
      WAFFO_STORE_ID: "STO_test",
      WAFFO_TEST_PRODUCT_ID_ONE: "staging_test_one",
      WAFFO_TEST_PRODUCT_ID_THREE: "staging_test_three",
      WAFFO_TEST_PRODUCT_ID_FIVE: "staging_test_five",
    });

    expect(config.capabilities.capabilities.webhookIngestion).toMatchObject({
      enabled: true,
      reason: "enabled",
    });
  });
});
