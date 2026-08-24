import { beforeEach, describe, expect, it, vi } from "vitest";
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

vi.mock("@/server/payments/capability", () => ({
  isCheckoutCapabilityEnabled: () => mocks.enabled,
}));
vi.mock("@/server/auth/server", () => ({ getAuth: mocks.getAuth }));
vi.mock("@/server/payments/composition", () => ({
  createProductionCheckoutService: mocks.createService,
}));

import { POST, PUT } from "./route";

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://www.quickiching.com/api/checkout", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://www.quickiching.com",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("CP4 checkout route", () => {
  beforeEach(() => {
    mocks.enabled = true;
    mocks.session = { user: { id: "user-1", email: "buyer@example.com" } };
    mocks.getAuth.mockReset().mockReturnValue({
      api: { getSession: vi.fn(async () => mocks.session) },
    });
    mocks.createCheckout.mockReset().mockResolvedValue({
      orderId: "8b6d8846-cdce-4dde-9744-817b8329a5b6",
      checkoutUrl: "https://pancake.waffo.ai/checkout/session#token=redirect-token",
      expiresAt: new Date("2026-08-24T03:00:00.000Z"),
    });
    mocks.createService.mockReset().mockResolvedValue({ create: mocks.createCheckout });
  });

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
      { origin: "https://attacker.example", "sec-fetch-site": "cross-site" },
    ));
    expect(response.status).toBe(403);
    expect(mocks.getAuth).not.toHaveBeenCalled();
  });

  it("accepts only product and idempotency identity, never client price or credits", async () => {
    const response = await POST(request({
      productKey: "three",
      requestId: "request-1234567890",
      amountMinor: 1,
      credits: 999,
    }));
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
      userId: "user-1",
      buyerEmail: "buyer@example.com",
      productKey: "three",
      requestId: "request-1234567890",
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
  });

  it("rejects unsupported methods", async () => {
    const response = await PUT();
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });
});
