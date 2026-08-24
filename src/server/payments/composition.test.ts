import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDatabase: vi.fn(),
  createAdapter: vi.fn(),
  checkoutService: vi.fn(),
  webhookService: vi.fn(),
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

vi.mock("./postgres-repository", () => ({
  PostgresPaymentRepository: class {
    constructor() { return mocks.repository; }
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
    mocks.checkoutService.mockReturnValue({ create: vi.fn() });
    mocks.webhookService.mockReturnValue({ ingest: vi.fn() });
    mocks.createAdapter.mockReturnValue({ createCheckout: vi.fn() });
  });

  it("does not initialize PostgreSQL or Waffo when checkout is disabled", async () => {
    await expect(createProductionCheckoutService({})).rejects.toThrow("CHECKOUT_DISABLED");
    expect(mocks.getDatabase).not.toHaveBeenCalled();
    expect(mocks.createAdapter).not.toHaveBeenCalled();
  });

  it("does not compose webhook ingestion before a durable consumer exists", async () => {
    await expect(createProductionWaffoWebhookService(webhookEnvironment)).rejects.toThrow("WEBHOOK_INGESTION_DISABLED");
    expect(mocks.getDatabase).not.toHaveBeenCalled();
    expect(mocks.createAdapter).not.toHaveBeenCalled();
    expect(mocks.webhookService).not.toHaveBeenCalled();
  });
});
