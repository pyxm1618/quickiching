import { describe, expect, it } from "vitest";
import { loadRuntimeConfig } from "./config";

function key(seed: number): string {
  const bytes = Buffer.from(Array.from({ length: 32 }, (_, index) => (seed + index * 17) % 256));
  return `base64:${bytes.toString("base64")}`;
}

function productionEnv(): Record<string, string> {
  return {
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
    SESSION_SIGNING_KEYS: `v1:${key(1)}`,
    SESSION_SIGNING_WRITE_VERSION: "v1",
    QUESTION_FINGERPRINT_KEYS: `v1:${key(33)}`,
    QUESTION_FINGERPRINT_WRITE_VERSION: "v1",
    QUESTION_ENCRYPTION_KEYS: `v1:${key(65)}`,
    QUESTION_ENCRYPTION_WRITE_VERSION: "v1",
    RESULT_INTEGRITY_KEYS: `v1:${key(97)}`,
    RESULT_INTEGRITY_WRITE_VERSION: "v1",
  };
}

describe("production public authentication configuration", () => {
  it.each(["NEXT_PUBLIC_AUTH_ADAPTER_MODE", "NEXT_PUBLIC_BETTER_AUTH_URL"])(
    "rejects a missing %s",
    (name) => {
      const env = productionEnv();
      delete env[name];
      expect(() => loadRuntimeConfig(env)).toThrow(`PRODUCTION_CONFIG_INVALID: ${name} is required`);
    },
  );

  it("requires the public Better Auth URL to use HTTPS", () => {
    expect(() => loadRuntimeConfig({
      ...productionEnv(),
      NEXT_PUBLIC_BETTER_AUTH_URL: "http://iching.example.com",
    })).toThrow("PRODUCTION_CONFIG_INVALID: NEXT_PUBLIC_BETTER_AUTH_URL must be an HTTPS URL");
  });

  it("requires every public and server auth URL to share one origin", () => {
    expect(() => loadRuntimeConfig({
      ...productionEnv(),
      NEXT_PUBLIC_BETTER_AUTH_URL: "https://auth.example.net",
    })).toThrow("PRODUCTION_CONFIG_INVALID: application and authentication URLs must share one origin");
  });

  it("requires the public adapter to match the production server adapter", () => {
    expect(() => loadRuntimeConfig({
      ...productionEnv(),
      NEXT_PUBLIC_AUTH_ADAPTER_MODE: "dev",
    })).toThrow("PRODUCTION_CONFIG_INVALID: NEXT_PUBLIC_AUTH_ADAPTER_MODE must be one of: better-auth");
  });
});
