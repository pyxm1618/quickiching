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
  BETTER_AUTH_SECRET: "better-auth-production-secret-at-least-32-characters",
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
  SESSION_SIGNING_KEYS: "v2:session-signing-key-new,v1:session-signing-key-old",
  SESSION_SIGNING_WRITE_VERSION: "v1",
  QUESTION_FINGERPRINT_KEYS: "v2:question-fingerprint-key-new,v1:question-fingerprint-key-old",
  QUESTION_FINGERPRINT_WRITE_VERSION: "v1",
  QUESTION_ENCRYPTION_KEYS: "v2:question-encryption-key-new,v1:question-encryption-key-old",
  QUESTION_ENCRYPTION_WRITE_VERSION: "v1",
  RESULT_INTEGRITY_KEYS: "v2:result-integrity-key-new,v1:result-integrity-key-old",
  RESULT_INTEGRITY_WRITE_VERSION: "v1",
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
    "SESSION_SIGNING_WRITE_VERSION",
    "QUESTION_FINGERPRINT_WRITE_VERSION",
    "QUESTION_ENCRYPTION_WRITE_VERSION",
    "RESULT_INTEGRITY_WRITE_VERSION",
  ])("rejects production when required setting %s is missing", (name) => {
    const withoutRequiredSetting = { ...productionCredentials };
    delete withoutRequiredSetting[name as keyof typeof withoutRequiredSetting];

    expect(() => loadRuntimeConfig(withoutRequiredSetting)).toThrow(
      `PRODUCTION_CONFIG_INVALID: ${name} is required`,
    );
  });

  it("rejects a Better Auth secret shorter than 32 characters", () => {
    expect(() => loadRuntimeConfig({
      ...productionCredentials,
      BETTER_AUTH_SECRET: "too-short",
    })).toThrow("PRODUCTION_CONFIG_INVALID: BETTER_AUTH_SECRET must be at least 32 characters");
  });

  it.each(["APP_BASE_URL", "BETTER_AUTH_URL", "NEXT_PUBLIC_APP_URL"])(
    "requires HTTPS for production URL %s",
    (name) => {
      expect(() => loadRuntimeConfig({
        ...productionCredentials,
        [name]: "http://iching.example.com",
      })).toThrow(`PRODUCTION_CONFIG_INVALID: ${name} must be an HTTPS URL`);
    },
  );

  it("rejects malformed versioned key sets", () => {
    expect(() => loadRuntimeConfig({
      ...productionCredentials,
      SESSION_SIGNING_KEYS: "session-signing-key-without-version",
    })).toThrow(
      "PRODUCTION_CONFIG_INVALID: SESSION_SIGNING_KEYS must use unique version:key entries",
    );
  });

  it("rejects a write version that is not in its readable key set", () => {
    expect(() => loadRuntimeConfig({
      ...productionCredentials,
      QUESTION_FINGERPRINT_WRITE_VERSION: "v3",
    })).toThrow(
      "PRODUCTION_CONFIG_INVALID: QUESTION_FINGERPRINT_WRITE_VERSION must reference a version in QUESTION_FINGERPRINT_KEYS",
    );
  });

  it("accepts explicit local adapter modes without any production secret", () => {
    expect(loadRuntimeConfig({
      NODE_ENV: "test",
      AI_ADAPTER_MODE: "local",
      AUTH_ADAPTER_MODE: "dev",
      PAYMENT_ADAPTER_MODE: "simulated",
      DATABASE_ADAPTER_MODE: "memory",
    })).toMatchObject({
      mode: "test",
      ai: "local",
      auth: "dev",
      payment: "simulated",
      database: "memory",
      workflow: "local",
      keys: {
        sessionSigning: { writeVersion: "v1" },
        questionFingerprint: { writeVersion: "v1" },
        questionEncryption: { writeVersion: "v1" },
        resultIntegrity: { writeVersion: "v1" },
      },
    });
  });

  it("rejects a production workflow adapter in test mode", () => {
    expect(() => loadRuntimeConfig({
      NODE_ENV: "test",
      WORKFLOW_ADAPTER_MODE: "vercel",
    })).toThrow("CONFIG_INVALID: WORKFLOW_ADAPTER_MODE must be one of: local");
  });

  it("rejects a secret reused across key purposes", () => {
    expect(() => loadRuntimeConfig({
      ...productionCredentials,
      SESSION_SIGNING_KEYS: "v1:shared-secret",
      SESSION_SIGNING_WRITE_VERSION: "v1",
      QUESTION_FINGERPRINT_KEYS: "v1:shared-secret",
      QUESTION_FINGERPRINT_WRITE_VERSION: "v1",
    })).toThrow("PRODUCTION_CONFIG_INVALID: key material must not be reused across purposes");
  });

  it("returns production keyrings with explicit single-write and multi-read versions", () => {
    const config = loadRuntimeConfig(productionCredentials);

    expect(config).toMatchObject({
      mode: "production",
      ai: "ai-sdk",
      auth: "better-auth",
      payment: "creem",
      database: "postgres",
      keys: {
        sessionSigning: {
          writeVersion: "v1",
          read: [
            { version: "v2", value: "session-signing-key-new" },
            { version: "v1", value: "session-signing-key-old" },
          ],
        },
        questionFingerprint: {
          writeVersion: "v1",
          read: [
            { version: "v2", value: "question-fingerprint-key-new" },
            { version: "v1", value: "question-fingerprint-key-old" },
          ],
        },
      },
    });
  });
});
