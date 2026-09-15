import { describe, expect, it } from "vitest";
import { resolveWaffoWebhookConfig } from "./waffo-adapter";

describe("Waffo application environment contract", () => {
  it("fails closed when a production app is wired to the Waffo test environment", () => {
    expect(() => resolveWaffoWebhookConfig({
      NODE_ENV: "production",
      APP_ENV: "production",
      WAFFO_ENVIRONMENT: "test",
      WAFFO_STORE_ID: "STO_test",
    })).toThrow("WAFFO_CONFIGURATION_UNAVAILABLE");
  });

  it("allows staging to use Waffo test explicitly", () => {
    expect(resolveWaffoWebhookConfig({
      NODE_ENV: "production",
      APP_ENV: "staging",
      WAFFO_ENVIRONMENT: "test",
      WAFFO_STORE_ID: "STO_test",
    })).toEqual({
      environment: "test",
      storeId: "STO_test",
    });
  });

  it("rejects Waffo prod outside the production app environment", () => {
    expect(() => resolveWaffoWebhookConfig({
      NODE_ENV: "production",
      APP_ENV: "staging",
      WAFFO_ENVIRONMENT: "prod",
      WAFFO_STORE_ID: "STO_prod",
    })).toThrow("WAFFO_CONFIGURATION_UNAVAILABLE");
  });
});
