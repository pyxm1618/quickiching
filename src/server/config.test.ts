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

  it("does not validate commercial credentials while every commercial capability is closed", () => {
    expect(
      loadRuntimeConfig({
        NODE_ENV: "production",
        BETTER_AUTH_URL: "not-a-url",
        EMAIL_FROM: "not-an-email",
        DATABASE_URL: "not-postgres",
        SESSION_SIGNING_KEYS: "not-versioned",
      }),
    ).toMatchObject({
      mode: "production",
      capabilities: { allDisabled: true, requestedAny: false },
    });
  });

  it("reports malformed requested commercial credentials without exposing their values", () => {
    const config = loadRuntimeConfig({
      NODE_ENV: "production",
      COMMERCIAL_V2_AUTH_ENABLED: "true",
      AUTH_ADAPTER_MODE: "better-auth",
      DATABASE_ADAPTER_MODE: "postgres",
      DATABASE_URL: "not-postgres",
      BETTER_AUTH_SECRET: "better-auth-secret",
      BETTER_AUTH_URL: "not-a-url",
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
      RESEND_API_KEY: "resend-api-key",
      EMAIL_FROM: "not-an-email",
    });

    expect(config.capabilities.capabilities.auth).toMatchObject({
      enabled: false,
      reason: "invalid_dependencies",
    });
    expect(config.capabilities.capabilities.auth.invalidDependencies).toEqual(
      expect.arrayContaining(["DATABASE_URL", "BETTER_AUTH_URL", "EMAIL_FROM"]),
    );
    expect(JSON.stringify(config.capabilities)).not.toContain("not-postgres");
    expect(JSON.stringify(config.capabilities)).not.toContain("not-a-url");
    expect(JSON.stringify(config.capabilities)).not.toContain("not-an-email");
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
    ).toThrow("PRODUCTION_CONFIG_INVALID: APP_BASE_URL must be a valid HTTP or HTTPS URL");
  });

  it("rejects non-HTTP public URLs", () => {
    expect(() =>
      loadRuntimeConfig({
        NODE_ENV: "production",
        APP_BASE_URL: "ftp://files.example.com",
      }),
    ).toThrow("PRODUCTION_CONFIG_INVALID: APP_BASE_URL must be a valid HTTP or HTTPS URL");
  });
});
