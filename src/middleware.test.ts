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
});
