import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDatabase: vi.fn(),
  createAdapter: vi.fn(),
  checkoutCapability: vi.fn(),
  webhookCapability: vi.fn(),
  checkoutService: vi.fn(),
  webhookService: vi.fn(),
  repositoryConstructor: vi.fn(),
  repository: {
    createOrGetOrder: vi.fn(),
    saveCheckout: vi.fn(),
    recordVerifiedEvent: vi.fn(),
    processInbox: vi.fn(),
    recordProcessingFailure: vi.fn(),
  },
}));

vi.mock("@/server/db/client", () => ({
  getCommercialDatabaseConnection: mocks.getDatabase,
}));

vi.mock("./capability", () => ({
  isCheckoutCapabilityEnabled: mocks.checkoutCapability,
  isWebhookIngestionCapabilityEnabled: mocks.webhookCapability,
}));

vi.mock("./postgres-repository", () => ({
  PostgresPaymentRepository: class {
    constructor(sql: unknown, options?: unknown) {
      mocks.repositoryConstructor(sql, options);
      return mocks.repository;
    }
  },
}));

vi.mock("./waffo-adapter", async (importOriginal) => {
  const original = await importOriginal<typeof import("./waffo-adapter")>();
  return { ...original, createWaffoPaymentAdapter: mocks.createAdapter };
});

vi.mock("./checkout-service", () => ({ createCheckoutService: mocks.checkoutService }));
vi.mock("./webhook-service", () => ({ createWaffoWebhookService: mocks.webhookService }));

import {
  createProductionCheckoutService,
  createProductionWaffoWebhookService,
} from "./composition";

const webhookEnvironment = {
  COMMERCIAL_V2_WEBHOOK_INGESTION_ENABLED: "true",
  COMMERCIAL_V2_CHECKOUT_ENABLED: "false",
  PAYMENT_ADAPTER_MODE: "waffo",
  DATABASE_ADAPTER_MODE: "postgres",
  DATABASE_URL: "postgresql://user:password@db.example.com/quickiching",
  WAFFO_ENVIRONMENT: "test",
  WAFFO_STORE_ID: "STO_test",
};

describe("CP4 payment composition", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      if (typeof mock === "function" && "mockReset" in mock) mock.mockReset();
    }
    mocks.getDatabase.mockReturnValue({ client: {} });
    mocks.checkoutCapability.mockReturnValue(false);
    mocks.webhookCapability.mockReturnValue(false);
    mocks.checkoutService.mockReturnValue({ create: vi.fn() });
    mocks.webhookService.mockReturnValue({ ingest: vi.fn() });
    mocks.createAdapter.mockReturnValue({ createCheckout: vi.fn() });
  });

  it("does not initialize PostgreSQL or Waffo when checkout is disabled", async () => {
    await expect(createProductionCheckoutService({})).rejects.toThrow("CHECKOUT_DISABLED");
    expect(mocks.getDatabase).not.toHaveBeenCalled();
    expect(mocks.createAdapter).not.toHaveBeenCalled();
  });

  it("injects the capability-checked checkout keyring instead of reading global process state", async () => {
    mocks.checkoutCapability.mockReturnValue(true);
    const environment = {
      DATABASE_URL: "postgresql://user:password@db.example.com/quickiching",
      WAFFO_ENVIRONMENT: "test",
      WAFFO_STORE_ID: "STO_test",
      WAFFO_MERCHANT_ID: "MER_test",
      WAFFO_PRIVATE_KEY: "private-key",
      WAFFO_TEST_PRODUCT_ID_ONE: "PROD_test_one",
      WAFFO_TEST_PRODUCT_ID_THREE: "PROD_test_three",
      WAFFO_TEST_PRODUCT_ID_FIVE: "PROD_test_five",
      WAFFO_PROD_PRODUCT_ID_ONE: "PROD_prod_one",
      WAFFO_PROD_PRODUCT_ID_THREE: "PROD_prod_three",
      WAFFO_PROD_PRODUCT_ID_FIVE: "PROD_prod_five",
      PAYMENT_CHECKOUT_URL_KEYS: "v2:custom-current-key,v1:custom-old-key",
      APP_BASE_URL: "https://www.quickiching.com",
    };

    await createProductionCheckoutService(environment);

    expect(mocks.repositoryConstructor).toHaveBeenCalledWith(
      {},
      { checkoutUrlKeys: environment.PAYMENT_CHECKOUT_URL_KEYS },
    );
  });

  it("does not compose webhook ingestion before a durable consumer exists", async () => {
    await expect(createProductionWaffoWebhookService(webhookEnvironment)).rejects.toThrow("WEBHOOK_INGESTION_DISABLED");
    expect(mocks.getDatabase).not.toHaveBeenCalled();
    expect(mocks.createAdapter).not.toHaveBeenCalled();
    expect(mocks.webhookService).not.toHaveBeenCalled();
  });
});
