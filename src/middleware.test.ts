import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { middleware } from "./middleware";

function makeRequest(path: string, init: ConstructorParameters<typeof NextRequest>[1] = {}) {
  return new NextRequest(`https://www.quickiching.com${path}`, init);
}

const completeAuthEnv = {
  COMMERCIAL_V2_AUTH_ENABLED: "true",
  AUTH_ADAPTER_MODE: "better-auth",
  DATABASE_ADAPTER_MODE: "postgres",
  DATABASE_URL: "postgresql://user:password@db.example.com/quickiching",
  BETTER_AUTH_SECRET: "auth-secret-with-at-least-32-characters",
  BETTER_AUTH_URL: "https://www.quickiching.com",
  APP_BASE_URL: "https://www.quickiching.com",
  NEXT_PUBLIC_APP_URL: "https://www.quickiching.com",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  RESEND_API_KEY: "resend-api-key",
  EMAIL_FROM: "Quick I Ching <noreply@example.com>",
  ANONYMOUS_OWNER_KEYS: "v1:anonymous-owner-secret",
};

const completeReconcileEnv = {
  ...completeAuthEnv,
  COMMERCIAL_V2_RECONCILE_ENABLED: "true",
  WORKFLOW_ADAPTER_MODE: "vercel",
  CRON_SECRET: "cron-secret-material",
};

const completeDeepReadingEnv = {
  ...completeReconcileEnv,
  COMMERCIAL_V2_PAID_DEEP_READING_ENABLED: "true",
  AI_ADAPTER_MODE: "ai-sdk",
  AI_GATEWAY_API_KEY: "gateway-api-key",
  AI_GATEWAY_BASE_URL: "https://gateway.example.com",
  AI_SDK_GATEWAY_BASE_URL: "https://sdk-gateway.example.com",
  APP_SECRET: "app-secret-with-at-least-32-characters",
  AI_MODEL_PREVIEW: "preview-model",
  AI_MODEL_DEEP_READING: "deep-reading-model",
  AI_MODEL_OUTPUT_REVIEW: "review-model",
  AI_MAX_OUTPUT_TOKENS: "800",
  AI_MAX_REVIEW_OUTPUT_TOKENS: "400",
  SESSION_SIGNING_KEYS: "v1:session-signing-secret",
  QUESTION_FINGERPRINT_KEYS: "v1:fingerprint-secret",
  QUESTION_ENCRYPTION_KEYS: "v1:encryption-secret",
  RESULT_INTEGRITY_KEYS: "v1:integrity-secret",
};

const completeCheckoutEnv = {
  ...completeReconcileEnv,
  COMMERCIAL_V2_CHECKOUT_ENABLED: "true",
  COMMERCIAL_V2_WEBHOOK_INGESTION_ENABLED: "true",
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
  PAYMENT_CHECKOUT_URL_KEYS: "v1:payment-checkout-url-secret",
};

// Several cases below assert the closed state before opening a capability. That
// baseline must be established by the test, not inherited from whatever process
// the suite happens to run in: `scripts/vercel-build.mjs` runs `bun run test`
// during the Vercel build, where a fully configured commercial environment is
// present and would make every "disabled by default" assertion false. Clearing
// the six flags is sufficient — a capability can never be enabled without
// having been requested.
const COMMERCIAL_CAPABILITY_FLAGS = [
  "COMMERCIAL_V2_AUTH_ENABLED",
  "COMMERCIAL_V2_AI_PREVIEW_ENABLED",
  "COMMERCIAL_V2_CHECKOUT_ENABLED",
  "COMMERCIAL_V2_WEBHOOK_INGESTION_ENABLED",
  "COMMERCIAL_V2_PAID_DEEP_READING_ENABLED",
  "COMMERCIAL_V2_RECONCILE_ENABLED",
] as const;

describe("Public V1 middleware boundaries", () => {
  beforeEach(() => {
    for (const flag of COMMERCIAL_CAPABILITY_FLAGS) vi.stubEnv(flag, "");
    vi.stubEnv("BETTER_AUTH_TRUSTED_ORIGINS", "");
  });

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
    expect(middleware(makeRequest("/account")).status).toBe(410);
    expect(middleware(makeRequest("/api/auth/get-session")).status).toBe(404);
  });

  it("opens only the explicit Auth surface after the server capability is enabled", () => {
    for (const [name, value] of Object.entries(completeAuthEnv)) vi.stubEnv(name, value);

    expect(middleware(makeRequest("/signin")).status).toBe(200);
    expect(middleware(makeRequest("/account")).status).toBe(200);
    expect(middleware(makeRequest("/api/auth/get-session")).status).toBe(200);
    expect(middleware(makeRequest("/checkout")).status).toBe(410);
    expect(middleware(makeRequest("/api/orders")).status).toBe(404);
  });

  it("opens the Reconcile route only when Reconcile capability is enabled", () => {
    // Disabled by default
    expect(middleware(makeRequest("/api/internal/reconcile")).status).toBe(404);

    for (const [name, value] of Object.entries(completeReconcileEnv)) vi.stubEnv(name, value);

    expect(middleware(makeRequest("/api/internal/reconcile")).status).toBe(200);
    expect(middleware(makeRequest("/api/internal/reconcile/extra")).status).toBe(404);
  });

  it("opens Deep Reading route only when Paid Deep Reading capability is enabled", () => {
    const castingId = "00000000-0000-4000-8000-000000000001";
    // Disabled by default
    expect(middleware(makeRequest(`/api/readings/${castingId}/deep`, { method: "POST" })).status).toBe(404);

    for (const [name, value] of Object.entries(completeDeepReadingEnv)) vi.stubEnv(name, value);

    expect(middleware(makeRequest(`/api/readings/${castingId}/deep`, { method: "POST" })).status).toBe(200);
    expect(middleware(makeRequest(`/api/readings/${castingId}/deep/extra`, { method: "POST" })).status).toBe(404);
    expect(middleware(makeRequest("/api/readings/invalid-uuid/deep", { method: "POST" })).status).toBe(404);
  });

  it("allows the signed Waffo webhook when capability is enabled and blocks unregistered paths", () => {
    for (const [name, value] of Object.entries({
      COMMERCIAL_V2_WEBHOOK_INGESTION_ENABLED: "true",
      PAYMENT_ADAPTER_MODE: "waffo",
      DATABASE_ADAPTER_MODE: "postgres",
      DATABASE_URL: "postgresql://user:password@db.example.com/quickiching",
      WAFFO_ENVIRONMENT: "test",
      WAFFO_STORE_ID: "STO_test",
    })) vi.stubEnv(name, value);

    // Exact webhook route is passed through
    expect(middleware(makeRequest("/api/webhooks/waffo", { method: "POST" })).status).toBe(200);
    // Unregistered paths remain 404
    expect(middleware(makeRequest("/api/webhooks/waffo/extra", { method: "POST" })).status).toBe(404);
    expect(middleware(makeRequest("/api/webhooks/other", { method: "POST" })).status).toBe(404);
  });

  it("allows Checkout route when Checkout and its full dependency chain are enabled", () => {
    for (const [name, value] of Object.entries(completeCheckoutEnv)) vi.stubEnv(name, value);

    // When checkout is enabled with full dependencies, POST /api/checkout is allowed through (status 200)
    const allowed = middleware(makeRequest("/api/checkout", { method: "POST" }));
    expect(allowed.status).toBe(200);

    // When flag is disabled, it is blocked with 404
    vi.stubEnv("COMMERCIAL_V2_CHECKOUT_ENABLED", "false");
    expect(middleware(makeRequest("/api/checkout", { method: "POST" })).status).toBe(404);
    expect(middleware(makeRequest("/checkout")).status).toBe(410);
  });

  it("always allows /api/health and /api/ready routes through", () => {
    expect(middleware(makeRequest("/api/health")).status).toBe(200);
    expect(middleware(makeRequest("/api/health/")).status).toBe(200);
    expect(middleware(makeRequest("/api/ready")).status).toBe(200);
    expect(middleware(makeRequest("/api/ready/")).status).toBe(200);
  });

  it("opens the claim route only when Paid Deep Reading is enabled", () => {
    expect(middleware(makeRequest("/api/readings/claim", { method: "POST" })).status).toBe(404);

    for (const [name, value] of Object.entries(completeDeepReadingEnv)) vi.stubEnv(name, value);

    expect(middleware(makeRequest("/api/readings/claim", { method: "POST" })).status).toBe(200);
    expect(middleware(makeRequest("/api/readings/claim/", { method: "POST" })).status).toBe(200);
    expect(middleware(makeRequest("/api/readings/claim/extra", { method: "POST" })).status).toBe(404);
  });

  it("opens the order status route only when Checkout is enabled, and only for a well-formed id", () => {
    const orderId = "8b6d8846-cdce-4dde-9744-817b8329a5b6";
    expect(middleware(makeRequest(`/api/orders/${orderId}`)).status).toBe(404);

    for (const [name, value] of Object.entries(completeCheckoutEnv)) vi.stubEnv(name, value);

    expect(middleware(makeRequest(`/api/orders/${orderId}`)).status).toBe(200);
    expect(middleware(makeRequest(`/api/orders/${orderId}/`)).status).toBe(200);
    expect(middleware(makeRequest("/api/orders")).status).toBe(404);
    expect(middleware(makeRequest("/api/orders/not-a-uuid")).status).toBe(404);
    expect(middleware(makeRequest(`/api/orders/${orderId}/refund`, { method: "POST" })).status).toBe(404);
  });

  it("opens the signed-in result page only when Paid Deep Reading is enabled", () => {
    const castingId = "0f1d2f1e-9a3b-4c1d-8e2f-5a6b7c8d9e0f";
    expect(middleware(makeRequest(`/readings/${castingId}`)).status).toBe(404);

    for (const [name, value] of Object.entries(completeDeepReadingEnv)) vi.stubEnv(name, value);

    expect(middleware(makeRequest(`/readings/${castingId}`)).status).toBe(200);
    expect(middleware(makeRequest(`/readings/${castingId}/`)).status).toBe(200);
    expect(middleware(makeRequest(`/readings/${castingId}/extra`)).status).toBe(200);
  });

  it("never gates the Public V1 reading pages behind a commercial capability", () => {
    // Closed by default, and these must stay reachable either way.
    expect(middleware(makeRequest("/readings/three-coin/result")).status).toBe(200);
    expect(middleware(makeRequest("/readings/three-coin")).status).toBe(200);

    for (const [name, value] of Object.entries(completeDeepReadingEnv)) vi.stubEnv(name, value);

    expect(middleware(makeRequest("/readings/three-coin/result")).status).toBe(200);
  });

  it("opens only the return path under the otherwise Gone /checkout prefix", () => {
    expect(middleware(makeRequest("/checkout/return")).status).toBe(404);

    for (const [name, value] of Object.entries(completeCheckoutEnv)) vi.stubEnv(name, value);

    expect(middleware(makeRequest("/checkout/return")).status).toBe(200);
    expect(middleware(makeRequest("/checkout/return/")).status).toBe(200);
    // The legacy commercial entry points stay permanently Gone.
    expect(middleware(makeRequest("/checkout")).status).toBe(410);
    expect(middleware(makeRequest("/checkout/session")).status).toBe(410);
    expect(middleware(makeRequest("/checkout/return/extra")).status).toBe(410);
  });
});
