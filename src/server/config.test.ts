import { describe, expect, it } from "vitest";
import { loadRuntimeConfig } from "./config";

function keyBytes(seed: number): Buffer {
  return Buffer.from(Array.from({ length: 32 }, (_, index) => (seed + index * 17) % 256));
}

function base64Key(seed: number): string {
  return `base64:${keyBytes(seed).toString("base64")}`;
}

function hexKey(seed: number): string {
  return `hex:${keyBytes(seed).toString("hex")}`;
}

const productionCredentials = {
  NODE_ENV: "production",
  APP_BASE_URL: "https://iching.example.com",
  AI_ADAPTER_MODE: "ai-sdk",
  AI_GATEWAY_API_KEY: "gateway-production-key",
  AI_MODEL_PREVIEW: "openai/gpt-5-mini",
  AI_MODEL_DEEP_READING: "openai/gpt-5.2",
  AI_MODEL_OUTPUT_REVIEW: "openai/gpt-5-mini",
  AUTH_ADAPTER_MODE: "better-auth",
  NEXT_PUBLIC_AUTH_ADAPTER_MODE: "better-auth",
  BETTER_AUTH_SECRET: "better-auth-production-secret-at-least-32-characters",
  BETTER_AUTH_URL: "https://iching.example.com",
  NEXT_PUBLIC_BETTER_AUTH_URL: "https://iching.example.com",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  RESEND_API_KEY: "resend-api-key",
  EMAIL_FROM: "I Ching Coin <noreply@iching.example.com>",
  PAYMENT_ADAPTER_MODE: "waffo",
  WAFFO_MERCHANT_ID: "MER_example",
  WAFFO_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nserver-only\\n-----END PRIVATE KEY-----",
  WAFFO_ENVIRONMENT: "test",
  WAFFO_STORE_ID: "STO_example",
  WAFFO_PRODUCT_ID_ONE: "PROD_one",
  WAFFO_PRODUCT_ID_THREE: "PROD_three",
  WAFFO_PRODUCT_ID_FIVE: "PROD_five",
  DATABASE_ADAPTER_MODE: "postgres",
  DATABASE_URL: "postgres://user:password@db.example.com:5432/iching",
  TURNSTILE_SECRET_KEY: "turnstile-secret-key",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "turnstile-site-key",
  NEXT_PUBLIC_APP_URL: "https://iching.example.com",
  WORKFLOW_ADAPTER_MODE: "vercel",
  SESSION_SIGNING_KEYS: `v2:${base64Key(1)},v1:${base64Key(2)}`,
  SESSION_SIGNING_WRITE_VERSION: "v1",
  QUESTION_FINGERPRINT_KEYS: `v2:${base64Key(33)},v1:${base64Key(34)}`,
  QUESTION_FINGERPRINT_WRITE_VERSION: "v1",
  QUESTION_ENCRYPTION_KEYS: `v2:${base64Key(65)},v1:${base64Key(66)}`,
  QUESTION_ENCRYPTION_WRITE_VERSION: "v1",
  RESULT_INTEGRITY_KEYS: `v2:${base64Key(97)},v1:${base64Key(98)}`,
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
    "NEXT_PUBLIC_AUTH_ADAPTER_MODE",
    "NEXT_PUBLIC_BETTER_AUTH_URL",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "WAFFO_MERCHANT_ID",
    "WAFFO_PRIVATE_KEY",
    "WAFFO_ENVIRONMENT",
    "WAFFO_STORE_ID",
    "WAFFO_PRODUCT_ID_ONE",
    "WAFFO_PRODUCT_ID_THREE",
    "WAFFO_PRODUCT_ID_FIVE",
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

  it.each(["APP_BASE_URL", "BETTER_AUTH_URL", "NEXT_PUBLIC_BETTER_AUTH_URL", "NEXT_PUBLIC_APP_URL"])(
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

  it("rejects raw unencoded production key material", () => {
    expect(() => loadRuntimeConfig({
      ...productionCredentials,
      SESSION_SIGNING_KEYS: "v1:a-raw-secret-is-not-an-accepted-key-format",
      SESSION_SIGNING_WRITE_VERSION: "v1",
    })).toThrow(
      "PRODUCTION_CONFIG_INVALID: SESSION_SIGNING_KEYS key v1 must use base64: or hex: encoding",
    );
  });

  it("rejects production key material shorter than 32 decoded bytes", () => {
    expect(() => loadRuntimeConfig({
      ...productionCredentials,
      SESSION_SIGNING_KEYS: `v1:base64:${Buffer.alloc(31, 7).toString("base64")}`,
      SESSION_SIGNING_WRITE_VERSION: "v1",
    })).toThrow(
      "PRODUCTION_CONFIG_INVALID: SESSION_SIGNING_KEYS key v1 must decode to at least 32 bytes",
    );
  });

  it("rejects low-entropy production key material", () => {
    expect(() => loadRuntimeConfig({
      ...productionCredentials,
      SESSION_SIGNING_KEYS: `v1:base64:${Buffer.alloc(32, 0).toString("base64")}`,
      SESSION_SIGNING_WRITE_VERSION: "v1",
    })).toThrow(
      "PRODUCTION_CONFIG_INVALID: SESSION_SIGNING_KEYS key v1 does not contain sufficient entropy",
    );
  });

  it("rejects encoded placeholder key material", () => {
    const placeholder = Buffer.from("change-me-change-me-change-me-change-me", "utf8");
    expect(() => loadRuntimeConfig({
      ...productionCredentials,
      SESSION_SIGNING_KEYS: `v1:base64:${placeholder.toString("base64")}`,
      SESSION_SIGNING_WRITE_VERSION: "v1",
    })).toThrow(
      "PRODUCTION_CONFIG_INVALID: SESSION_SIGNING_KEYS key v1 contains placeholder material",
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

  it("rejects decoded key material reused across purposes even with different encodings", () => {
    const shared = keyBytes(129);
    expect(() => loadRuntimeConfig({
      ...productionCredentials,
      SESSION_SIGNING_KEYS: `v1:base64:${shared.toString("base64")}`,
      SESSION_SIGNING_WRITE_VERSION: "v1",
      QUESTION_FINGERPRINT_KEYS: `v1:hex:${shared.toString("hex")}`,
      QUESTION_FINGERPRINT_WRITE_VERSION: "v1",
    })).toThrow("PRODUCTION_CONFIG_INVALID: key material must not be reused across purposes");
  });

  it("returns production keyrings with explicit single-write and multi-read versions", () => {
    const config = loadRuntimeConfig(productionCredentials);
    expect(config).toMatchObject({
      mode: "production",
      ai: "ai-sdk",
      auth: "better-auth",
      payment: "waffo",
      database: "postgres",
      credentials: {
        publicAuthAdapterMode: "better-auth",
        publicBetterAuthUrl: "https://iching.example.com",
      },
      keys: {
        sessionSigning: {
          writeVersion: "v1",
          read: [
            { version: "v2", value: base64Key(1) },
            { version: "v1", value: base64Key(2) },
          ],
        },
        questionFingerprint: {
          writeVersion: "v1",
          read: [
            { version: "v2", value: base64Key(33) },
            { version: "v1", value: base64Key(34) },
          ],
        },
      },
    });
  });

  it("accepts both base64 and hex encoded high-entropy keys", () => {
    expect(loadRuntimeConfig({
      ...productionCredentials,
      SESSION_SIGNING_KEYS: `v1:${hexKey(161)}`,
      SESSION_SIGNING_WRITE_VERSION: "v1",
    })).toMatchObject({
      keys: {
        sessionSigning: {
          read: [{ version: "v1", value: hexKey(161) }],
        },
      },
    });
  });
});
