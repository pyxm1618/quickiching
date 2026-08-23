import { describe, expect, it } from "vitest";
import { loadRuntimeConfig } from "./config";

describe("runtime configuration", () => {
  it("keeps production Public V1 credential-free and commercial capabilities disabled", () => {
    const config = loadRuntimeConfig({
      NODE_ENV: "production",
      APP_BASE_URL: "https://www.quickiching.com",
    });

    expect(config).toMatchObject({
      mode: "production",
      ai: "disabled",
      auth: "disabled",
      payment: "waffo",
      database: "disabled",
      workflow: "disabled",
      baseUrl: "https://www.quickiching.com",
      publicAppUrl: "https://www.quickiching.com",
      capabilities: {
        allDisabled: true,
        commercialEnabled: false,
        requestedAny: false,
      },
    });
  });

  it("accepts the explicit Waffo production target without requiring provider credentials", () => {
    expect(
      loadRuntimeConfig({
        NODE_ENV: "production",
        PAYMENT_ADAPTER_MODE: "waffo",
      }),
    ).toMatchObject({
      mode: "production",
      payment: "waffo",
      capabilities: { allDisabled: true },
    });
  });

  it("rejects non-Waffo payment targets in production", () => {
    expect(() =>
      loadRuntimeConfig({
        NODE_ENV: "production",
        PAYMENT_ADAPTER_MODE: "simulated",
      }),
    ).toThrow("PRODUCTION_CONFIG_INVALID: PAYMENT_ADAPTER_MODE must be one of: waffo");
  });

  it("does not expose local or development adapters as production fallbacks", () => {
    expect(
      loadRuntimeConfig({
        NODE_ENV: "production",
        AI_ADAPTER_MODE: "local",
        AUTH_ADAPTER_MODE: "dev",
        DATABASE_ADAPTER_MODE: "memory",
        WORKFLOW_ADAPTER_MODE: "local",
      }),
    ).toMatchObject({
      ai: "disabled",
      auth: "disabled",
      database: "disabled",
      workflow: "disabled",
      payment: "waffo",
      capabilities: { allDisabled: true },
    });
  });

  it("fails closed when a production capability flag is malformed", () => {
    expect(() =>
      loadRuntimeConfig({
        NODE_ENV: "production",
        COMMERCIAL_V2_AUTH_ENABLED: "yes",
      }),
    ).toThrow("PRODUCTION_CONFIG_INVALID: COMMERCIAL_V2_AUTH_ENABLED must be true or false");
  });

  it("keeps local development adapters explicit and isolated", () => {
    expect(
      loadRuntimeConfig({
        NODE_ENV: "test",
        AI_ADAPTER_MODE: "local",
        AUTH_ADAPTER_MODE: "dev",
        PAYMENT_ADAPTER_MODE: "simulated",
        DATABASE_ADAPTER_MODE: "memory",
        WORKFLOW_ADAPTER_MODE: "local",
      }),
    ).toMatchObject({
      mode: "test",
      ai: "local",
      auth: "dev",
      payment: "simulated",
      database: "memory",
      workflow: "local",
      capabilities: { allDisabled: true },
    });
  });

  it("rejects malformed public URLs without requiring any commercial credential", () => {
    expect(() =>
      loadRuntimeConfig({
        NODE_ENV: "production",
        APP_BASE_URL: "not-a-url",
      }),
    ).toThrow("PRODUCTION_CONFIG_INVALID: APP_BASE_URL must be a valid URL");
  });
});
