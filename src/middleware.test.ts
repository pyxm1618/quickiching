import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { middleware } from "./middleware";

function makeRequest(path: string, init: ConstructorParameters<typeof NextRequest>[1] = {}) {
  return new NextRequest(`https://www.quickiching.com${path}`, init);
}

describe("Public V1 middleware boundaries", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("rejects Next-Action requests with a noindex 404 before route handling", () => {
    const response = middleware(makeRequest("/methods/three-coin", {
      method: "POST",
      headers: { "Next-Action": "legacy-action-id" },
    }));

    expect(response.status).toBe(404);
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });

  it("leaves ordinary public page GET requests alone", () => {
    expect(middleware(makeRequest("/methods/three-coin")).status).toBe(200);
  });

  it("leaves the personalized interpretation API available to its route", () => {
    expect(middleware(makeRequest("/api/personalized-interpretation", { method: "POST" })).status).toBe(200);
  });

  it("keeps Auth routes closed when the server capability is disabled", () => {
    expect(middleware(makeRequest("/signin")).status).toBe(410);
    expect(middleware(makeRequest("/api/auth/get-session")).status).toBe(404);
  });

  it("opens only the explicit Auth surface after the server capability is enabled", () => {
    for (const [name, value] of Object.entries({
      COMMERCIAL_V2_AUTH_ENABLED: "true",
      COMMERCIAL_V2_AI_PREVIEW_ENABLED: "false",
      COMMERCIAL_V2_CHECKOUT_ENABLED: "false",
      COMMERCIAL_V2_WEBHOOK_INGESTION_ENABLED: "false",
      COMMERCIAL_V2_PAID_DEEP_READING_ENABLED: "false",
      COMMERCIAL_V2_RECONCILE_ENABLED: "false",
      AUTH_ADAPTER_MODE: "better-auth",
      DATABASE_ADAPTER_MODE: "postgres",
      DATABASE_URL: "postgresql://user:password@db.example.com/quickiching",
      BETTER_AUTH_SECRET: "auth-secret-with-at-least-32-characters",
      BETTER_AUTH_URL: "https://www.quickiching.com",
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
      RESEND_API_KEY: "resend-api-key",
      EMAIL_FROM: "Quick I Ching <noreply@example.com>",
      ANONYMOUS_OWNER_KEYS: "v1:anonymous-owner-secret",
    })) vi.stubEnv(name, value);

    expect(middleware(makeRequest("/signin")).status).toBe(200);
    expect(middleware(makeRequest("/api/auth/get-session")).status).toBe(200);
    expect(middleware(makeRequest("/account")).status).toBe(410);
    expect(middleware(makeRequest("/checkout")).status).toBe(410);
    expect(middleware(makeRequest("/api/orders")).status).toBe(404);
  });

  it("opens only the exact authenticated Preview route when AI Preview is fully enabled", () => {
    for (const [name, value] of Object.entries({
      COMMERCIAL_V2_AUTH_ENABLED: "true",
      COMMERCIAL_V2_AI_PREVIEW_ENABLED: "true",
      COMMERCIAL_V2_CHECKOUT_ENABLED: "false",
      COMMERCIAL_V2_WEBHOOK_INGESTION_ENABLED: "false",
      COMMERCIAL_V2_PAID_DEEP_READING_ENABLED: "false",
      COMMERCIAL_V2_RECONCILE_ENABLED: "false",
      AUTH_ADAPTER_MODE: "better-auth",
      DATABASE_ADAPTER_MODE: "postgres",
      DATABASE_URL: "postgresql://user:password@db.example.com/quickiching",
      BETTER_AUTH_SECRET: "auth-secret-with-at-least-32-characters",
      BETTER_AUTH_URL: "https://www.quickiching.com",
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
      RESEND_API_KEY: "resend-api-key",
      EMAIL_FROM: "Quick I Ching <noreply@example.com>",
      ANONYMOUS_OWNER_KEYS: "v1:anonymous-owner-secret",
      AI_ADAPTER_MODE: "ai-sdk",
      AI_GATEWAY_API_KEY: "gateway-api-key",
      AI_GATEWAY_BASE_URL: "https://gateway.example.com",
      AI_SDK_GATEWAY_BASE_URL: "https://sdk-gateway.example.com",
      APP_SECRET: "app-secret-with-at-least-32-characters",
      AI_MODEL_PREVIEW: "preview-model",
      AI_MODEL_OUTPUT_REVIEW: "review-model",
      AI_MAX_OUTPUT_TOKENS: "800",
      AI_MAX_REVIEW_OUTPUT_TOKENS: "400",
      QUESTION_FINGERPRINT_KEYS: "v1:fingerprint-secret",
      QUESTION_ENCRYPTION_KEYS: "v1:encryption-secret",
      RESULT_INTEGRITY_KEYS: "v1:integrity-secret",
    })) vi.stubEnv(name, value);

    const castingId = "00000000-0000-4000-8000-000000000001";
    expect(middleware(makeRequest(`/api/readings/${castingId}/preview`)).status).toBe(200);
    expect(middleware(makeRequest(`/api/readings/${castingId}/preview/extra`)).status).toBe(404);
    expect(middleware(makeRequest(`/api/readings/${castingId}`)).status).toBe(200);
    expect(middleware(makeRequest("/api/readings/not-a-uuid/preview")).status).toBe(404);
  });

  it("keeps the exact Preview route closed when its capability is disabled", () => {
    const castingId = "00000000-0000-4000-8000-000000000001";
    expect(middleware(makeRequest(`/api/readings/${castingId}/preview`)).status).toBe(404);
  });

  it("keeps the signed Waffo webhook closed until a durable consumer exists", () => {
    for (const [name, value] of Object.entries({
      COMMERCIAL_V2_WEBHOOK_INGESTION_ENABLED: "true",
      PAYMENT_ADAPTER_MODE: "waffo",
      DATABASE_ADAPTER_MODE: "postgres",
      DATABASE_URL: "postgresql://user:password@db.example.com/quickiching",
      WAFFO_ENVIRONMENT: "test",
      WAFFO_STORE_ID: "STO_test",
    })) vi.stubEnv(name, value);

    expect(middleware(makeRequest("/api/webhooks/waffo", { method: "POST" })).status).toBe(404);
    expect(middleware(makeRequest("/api/webhooks/waffo/extra", { method: "POST" })).status).toBe(404);
    expect(middleware(makeRequest("/api/webhooks/other", { method: "POST" })).status).toBe(404);
    expect(middleware(makeRequest("/api/checkout", { method: "POST" })).status).toBe(404);
  });

  it("keeps checkout closed even with complete-looking credentials before CP5", () => {
    for (const [name, value] of Object.entries({
      COMMERCIAL_V2_AUTH_ENABLED: "true",
      COMMERCIAL_V2_CHECKOUT_ENABLED: "true",
      COMMERCIAL_V2_WEBHOOK_INGESTION_ENABLED: "true",
      AUTH_ADAPTER_MODE: "better-auth",
      DATABASE_ADAPTER_MODE: "postgres",
      DATABASE_URL: "postgresql://user:password@db.example.com/quickiching",
      BETTER_AUTH_SECRET: "auth-secret-with-at-least-32-characters",
      BETTER_AUTH_URL: "https://www.quickiching.com",
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
      RESEND_API_KEY: "resend-api-key",
      EMAIL_FROM: "Quick I Ching <noreply@example.com>",
      ANONYMOUS_OWNER_KEYS: "v1:anonymous-owner-secret",
      PAYMENT_ADAPTER_MODE: "waffo",
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
      APP_BASE_URL: "https://www.quickiching.com",
      PAYMENT_CHECKOUT_URL_KEYS: "v1:payment-checkout-url-secret",
    })) vi.stubEnv(name, value);

    expect(middleware(makeRequest("/api/checkout", { method: "POST" })).status).toBe(404);
    expect(middleware(makeRequest("/api/checkout/extra", { method: "POST" })).status).toBe(404);
    expect(middleware(makeRequest("/checkout"))).toBeDefined();
    expect(middleware(makeRequest("/checkout")).status).toBe(410);
  });
});
