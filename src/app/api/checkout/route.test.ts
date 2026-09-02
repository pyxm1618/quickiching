import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CheckoutServiceError } from "@/server/payments/checkout-service";

const mocks = vi.hoisted(() => ({
  enabled: true,
  getAuth: vi.fn(),
  createService: vi.fn(),
  createCheckout: vi.fn(),
  session: { user: { id: "user-1", email: "buyer@example.com" } } as {
    user: { id: string; email: string };
  } | null,
}));
const MAX_TEST_CHECKOUT_BYTES = 4 * 1024;

vi.mock("@/server/payments/capability", () => ({ isCheckoutCapabilityEnabled: () => mocks.enabled }));
vi.mock("@/server/auth/server", () => ({ getAuth: mocks.getAuth }));
vi.mock("@/server/payments/composition", () => ({ createProductionCheckoutService: mocks.createService }));

import { POST, PUT } from "./route";

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://www.quickiching.com/api/checkout", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://www.quickiching.com",
      referer: "https://www.quickiching.com/account",
      "sec-fetch-site": "same-origin",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("CP4 checkout route", () => {
  beforeEach(() => {
    vi.stubEnv("APP_BASE_URL", "https://www.quickiching.com");
    vi.stubEnv("BETTER_AUTH_URL", "https://www.quickiching.com");
    mocks.enabled = true;
    mocks.session = { user: { id: "user-1", email: "buyer@example.com" } };
    mocks.getAuth.mockReset().mockReturnValue({ api: { getSession: vi.fn(async () => mocks.session) } });
    mocks.createCheckout.mockReset().mockResolvedValue({
      orderId: "8b6d8846-cdce-4dde-9744-817b8329a5b6",
      checkoutUrl: "https://pancake.waffo.ai/checkout/session#token=redirect-token",
      expiresAt: new Date("2026-08-24T03:00:00.000Z"),
    });
    mocks.createService.mockReset().mockResolvedValue({ create: mocks.createCheckout });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("returns capability-off 404 before Auth, database, or provider composition", async () => {
    mocks.enabled = false;
    const response = await POST(request({ productKey: "three", requestId: "request-1234567890" }));
    expect(response.status).toBe(404);
    expect(mocks.getAuth).not.toHaveBeenCalled();
    expect(mocks.createService).not.toHaveBeenCalled();
  });

  it("rejects cross-site requests before Auth and persistence", async () => {
    const response = await POST(request(
      { productKey: "three", requestId: "request-1234567890" },
      { origin: "https://attacker.example", referer: "https://attacker.example/x", "sec-fetch-site": "cross-site" },
    ));
    expect(response.status).toBe(403);
    expect(mocks.getAuth).not.toHaveBeenCalled();
  });

  it.each(["origin", "referer", "sec-fetch-site"])("requires %s CSRF evidence", async (header) => {
    const headers: Record<string, string> = {
      origin: "https://www.quickiching.com",
      referer: "https://www.quickiching.com/account",
      "sec-fetch-site": "same-origin",
    };
    delete headers[header];
    const response = await POST(new Request("https://www.quickiching.com/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ productKey: "three", requestId: "request-1234567890" }),
    }));
    expect(response.status).toBe(403);
    expect(mocks.getAuth).not.toHaveBeenCalled();
  });

  it("accepts only product and idempotency identity, never client price or credits", async () => {
    const response = await POST(request({ productKey: "three", requestId: "request-1234567890", amountMinor: 1, credits: 999 }));
    expect(response.status).toBe(400);
    expect(mocks.createService).not.toHaveBeenCalled();
  });

  it("requires a Better Auth session", async () => {
    mocks.session = null;
    const response = await POST(request({ productKey: "three", requestId: "request-1234567890" }));
    expect(response.status).toBe(401);
    expect(mocks.createService).not.toHaveBeenCalled();
  });

  it("passes server session identity and returns a no-store redirect boundary", async () => {
    const response = await POST(request({ productKey: "three", requestId: "request-1234567890" }));
    expect(response.status).toBe(200);
    expect(mocks.createCheckout).toHaveBeenCalledWith({
      userId: "user-1", buyerEmail: "buyer@example.com", productKey: "three", requestId: "request-1234567890",
      locale: "en",
    });
    await expect(response.json()).resolves.toEqual({
      orderId: "8b6d8846-cdce-4dde-9744-817b8329a5b6",
      checkoutUrl: "https://pancake.waffo.ai/checkout/session#token=redirect-token",
      expiresAt: "2026-08-24T03:00:00.000Z",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("maps service failures to bounded responses without provider or user details", async () => {
    mocks.createCheckout.mockRejectedValue(new Error("private key buyer@example.com"));
    const response = await POST(request({ productKey: "one", requestId: "request-1234567890" }));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private key");
    mocks.createCheckout.mockRejectedValue(new CheckoutServiceError("CHECKOUT_IDEMPOTENCY_CONFLICT", false));
    const conflict = await POST(request({ productKey: "one", requestId: "request-1234567890" }));
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toEqual({ error: "CHECKOUT_IDEMPOTENCY_CONFLICT", retryable: false });
    mocks.createCheckout.mockRejectedValue(new CheckoutServiceError("CHECKOUT_RATE_LIMITED", true, 37));
    const limited = await POST(request({ productKey: "one", requestId: "request-1234567890" }));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("37");
  });

  it("cancels a chunked checkout body at the byte boundary without Content-Length", async () => {
    let cancelled = false;
    let sentOversizedChunk = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new TextEncoder().encode("{" + "x".repeat(MAX_TEST_CHECKOUT_BYTES - 3))); },
      pull(controller) {
        if (sentOversizedChunk) return;
        sentOversizedChunk = true;
        controller.enqueue(new TextEncoder().encode("oversized"));
        setTimeout(() => { if (!cancelled) controller.close(); }, 50);
      },
      cancel() { cancelled = true; },
    });
    const response = await POST(new Request("https://www.quickiching.com/api/checkout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://www.quickiching.com",
        referer: "https://www.quickiching.com/account",
        "sec-fetch-site": "same-origin",
      },
      body: stream,
      duplex: "half",
    } as RequestInit));
    expect(response.status).toBe(413);
    expect(cancelled).toBe(true);
    expect(mocks.getAuth).not.toHaveBeenCalled();
  });

  it("rejects unsupported methods", async () => {
    const response = await PUT();
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });
});
