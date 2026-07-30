import { describe, expect, it } from "vitest";
import { loadRuntimeConfig } from "./config";

const productionCredentials = {
  NODE_ENV: "production",
  APP_BASE_URL: "https://iching.example.com",
  AI_ADAPTER_MODE: "ai-sdk",
  AI_GATEWAY_API_KEY: "gateway-production-key",
  AI_MODEL_PREVIEW: "openai/gpt-5-mini",
  AI_MODEL_DEEP_READING: "openai/gpt-5.2",
  AI_MODEL_OUTPUT_REVIEW: "openai/gpt-5-mini",
  AUTH_ADAPTER_MODE: "better-auth",
  BETTER_AUTH_SECRET: "better-auth-production-secret",
  BETTER_AUTH_URL: "https://iching.example.com",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  RESEND_API_KEY: "resend-api-key",
  EMAIL_FROM: "I Ching Coin <noreply@iching.example.com>",
  PAYMENT_ADAPTER_MODE: "creem",
  CREEM_API_KEY: "creem-production-key",
  CREEM_WEBHOOK_SECRET: "creem-webhook-secret",
  CREEM_PRODUCT_ID_ONE: "prod_one",
  CREEM_PRODUCT_ID_THREE: "prod_three",
  CREEM_PRODUCT_ID_FIVE: "prod_five",
  DATABASE_ADAPTER_MODE: "postgres",
  DATABASE_URL: "postgres://user:password@db.example.com:5432/iching",
  TURNSTILE_SECRET_KEY: "turnstile-secret-key",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "turnstile-site-key",
  NEXT_PUBLIC_APP_URL: "https://iching.example.com",
  WORKFLOW_ADAPTER_MODE: "vercel",
  SESSION_SIGNING_KEYS: "v1:session-signing-key",
  QUESTION_FINGERPRINT_KEYS: "v1:question-fingerprint-key",
  QUESTION_ENCRYPTION_KEYS: "v1:question-encryption-key",
  RESULT_INTEGRITY_KEYS: "v1:result-integrity-key",
};

describe("runtime configuration", () => {
  it.each([
    "AI_ADAPTER_MODE",
    "AUTH_ADAPTER_MODE",
    "PAYMENT_ADAPTER_MODE",
    "DATABASE_ADAPTER_MODE",
  ])("rejects production when %s is not explicitly set", (name) => {
    const withoutAdapterMode = { ...productionCredentials };
    delete withoutAdapterMode[name as keyof typeof withoutAdapterMode];

    expect(() => loadRuntimeConfig(withoutAdapterMode)).toThrow(
      `PRODUCTION_CONFIG_INVALID: ${name} is required`,
    );
  });

  it.each([
    "AI_MODEL_PREVIEW",
    "AI_MODEL_DEEP_READING",
    "AI_MODEL_OUTPUT_REVIEW",
    "BETTER_AUTH_URL",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "CREEM_PRODUCT_ID_ONE",
    "CREEM_PRODUCT_ID_THREE",
    "CREEM_PRODUCT_ID_FIVE",
    "TURNSTILE_SECRET_KEY",
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    "NEXT_PUBLIC_APP_URL",
    "WORKFLOW_ADAPTER_MODE",
  ])("rejects production when required provider or workflow setting %s is missing", (name) => {
    const withoutRequiredSetting = { ...productionCredentials };
    delete withoutRequiredSetting[name as keyof typeof withoutRequiredSetting];

    expect(() => loadRuntimeConfig(withoutRequiredSetting)).toThrow(
      `PRODUCTION_CONFIG_INVALID: ${name} is required`,
    );
  });

  it("rejects missing production credentials", () => {
    const { CREEM_WEBHOOK_SECRET: _missing, ...withoutWebhookSecret } = productionCredentials;

    expect(() => loadRuntimeConfig(withoutWebhookSecret)).toThrow(
      "PRODUCTION_CONFIG_INVALID: CREEM_WEBHOOK_SECRET is required",
    );
  });

  it("rejects malformed versioned key sets", () => {
    expect(() =>
      loadRuntimeConfig({
        ...productionCredentials,
        SESSION_SIGNING_KEYS: "session-signing-key-without-version",
      }),
    ).toThrow("PRODUCTION_CONFIG_INVALID: SESSION_SIGNING_KEYS must use version:key entries");
  });

  it("accepts explicit local adapter modes in test mode without production credentials", () => {
    expect(
      loadRuntimeConfig({
        NODE_ENV: "test",
        AI_ADAPTER_MODE: "local",
        AUTH_ADAPTER_MODE: "dev",
        PAYMENT_ADAPTER_MODE: "simulated",
        DATABASE_ADAPTER_MODE: "memory",
      }),
    ).toMatchObject({
      mode: "test",
      ai: "local",
      auth: "dev",
      payment: "simulated",
      database: "memory",
      workflow: "local",
    });
  });

  it("rejects a production workflow adapter in test mode", () => {
    expect(() =>
      loadRuntimeConfig({
        NODE_ENV: "test",
        AI_ADAPTER_MODE: "local",
        AUTH_ADAPTER_MODE: "dev",
        PAYMENT_ADAPTER_MODE: "simulated",
        DATABASE_ADAPTER_MODE: "memory",
        WORKFLOW_ADAPTER_MODE: "vercel",
      }),
    ).toThrow("CONFIG_INVALID: WORKFLOW_ADAPTER_MODE must be one of: local");
  });

  it("rejects a secret reused across key purposes", () => {
    expect(() =>
      loadRuntimeConfig({
        ...productionCredentials,
        SESSION_SIGNING_KEYS: "v1:shared-secret",
        QUESTION_FINGERPRINT_KEYS: "v1:shared-secret",
      }),
    ).toThrow("PRODUCTION_CONFIG_INVALID: key material must not be reused across purposes");
  });

  it("returns a production configuration with explicit production adapters and key versions", () => {
    expect(loadRuntimeConfig(productionCredentials)).toEqual({
      mode: "production",
      ai: "ai-sdk",
      auth: "better-auth",
      payment: "creem",
      database: "postgres",
      baseUrl: "https://iching.example.com",
      credentials: {
        aiGatewayApiKey: "gateway-production-key",
        aiModelPreview: "openai/gpt-5-mini",
        aiModelDeepReading: "openai/gpt-5.2",
        aiModelOutputReview: "openai/gpt-5-mini",
        betterAuthSecret: "better-auth-production-secret",
        betterAuthUrl: "https://iching.example.com",
        googleClientId: "google-client-id",
        googleClientSecret: "google-client-secret",
        resendApiKey: "resend-api-key",
        emailFrom: "I Ching Coin <noreply@iching.example.com>",
        creemApiKey: "creem-production-key",
        creemWebhookSecret: "creem-webhook-secret",
        creemProductIdOne: "prod_one",
        creemProductIdThree: "prod_three",
        creemProductIdFive: "prod_five",
        databaseUrl: "postgres://user:password@db.example.com:5432/iching",
        turnstileSecretKey: "turnstile-secret-key",
        turnstileSiteKey: "turnstile-site-key",
        publicAppUrl: "https://iching.example.com",
        workflowAdapterMode: "vercel",
      },
      keys: {
        sessionSigning: [{ version: "v1", value: "session-signing-key" }],
        questionFingerprint: [{ version: "v1", value: "question-fingerprint-key" }],
        questionEncryption: [{ version: "v1", value: "question-encryption-key" }],
        resultIntegrity: [{ version: "v1", value: "result-integrity-key" }],
      },
    });
  });
});
