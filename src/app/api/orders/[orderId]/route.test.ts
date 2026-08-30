import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enabled: true,
  resolveSession: vi.fn(),
  createReader: vi.fn(),
  readOrderForUser: vi.fn(),
  session: { user: { id: "user-1", email: "buyer@example.com" } } as {
    user: { id: string; email: string };
  } | null,
}));

vi.mock("@/server/payments/capability", () => ({
  isCheckoutCapabilityEnabled: () => mocks.enabled,
}));
vi.mock("@/lib/auth/session", () => ({ resolveSession: mocks.resolveSession }));
vi.mock("@/server/payments/order-status", () => ({
  createProductionOrderStatusReader: mocks.createReader,
}));

import { GET, POST } from "./route";

const ORDER = "8b6d8846-cdce-4dde-9744-817b8329a5b6";

function request(orderId = ORDER) {
  return new Request(`https://www.quickiching.com/api/orders/${orderId}`, { method: "GET" });
}

function params(orderId = ORDER) {
  return { params: Promise.resolve({ orderId }) };
}

describe("order status route", () => {
  beforeEach(() => {
    mocks.enabled = true;
    mocks.session = { user: { id: "user-1", email: "buyer@example.com" } };
    mocks.resolveSession.mockReset().mockImplementation(async () => mocks.session);
    mocks.readOrderForUser.mockReset().mockResolvedValue({
      status: "paid",
      productKey: "three",
      quantity: 3,
    });
    mocks.createReader.mockReset().mockResolvedValue({ readOrderForUser: mocks.readOrderForUser });
  });

  afterEach(() => vi.restoreAllMocks());

  it("returns 404 before auth or database access when checkout is closed", async () => {
    mocks.enabled = false;

    const response = await GET(request(), params());

    expect(response.status).toBe(404);
    expect(mocks.resolveSession).not.toHaveBeenCalled();
    expect(mocks.createReader).not.toHaveBeenCalled();
  });

  it("requires a signed-in reader", async () => {
    mocks.session = null;

    const response = await GET(request(), params());

    expect(response.status).toBe(401);
    expect(mocks.readOrderForUser).not.toHaveBeenCalled();
  });

  it("reports an auth outage as 503 rather than as signed out", async () => {
    mocks.resolveSession.mockRejectedValue(new Error("AUTH_BACKEND_DOWN"));

    const response = await GET(request(), params());

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: "AUTH_UNAVAILABLE" });
  });

  it("scopes the lookup to the session user, never a caller-named one", async () => {
    await GET(request(), params());

    expect(mocks.readOrderForUser).toHaveBeenCalledWith("user-1", ORDER);
  });

  it("answers 404 for an order the reader does not own", async () => {
    // The reader scopes by user, so someone else's order comes back as null.
    mocks.readOrderForUser.mockResolvedValue(null);

    const response = await GET(request(), params());

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: "ORDER_NOT_FOUND" });
  });

  it.each([
    ["not-a-uuid"],
    ["../../../etc/passwd"],
    ["8b6d8846-cdce-4dde-9744"],
    ["8b6d8846cdce4dde9744817b8329a5b6"],
  ])("rejects a malformed order id (%s) without querying", async (orderId) => {
    const response = await GET(request(orderId), params(orderId));

    expect(response.status).toBe(404);
    expect(mocks.createReader).not.toHaveBeenCalled();
  });

  it("returns only status, product key and quantity", async () => {
    const response = await GET(request(), params());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "paid", productKey: "three", quantity: 3 });
  });

  it("never leaks provider or checkout fields", async () => {
    mocks.readOrderForUser.mockResolvedValue({
      status: "checkout_created",
      productKey: "one",
      quantity: 1,
    });

    const serialized = JSON.stringify(await (await GET(request(), params())).json());

    expect(serialized).not.toContain("checkoutUrl");
    expect(serialized).not.toContain("provider");
    expect(serialized).not.toContain("claimToken");
  });

  it("is never cached or indexed", async () => {
    const response = await GET(request(), params());

    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("reports a repository outage as 503", async () => {
    mocks.readOrderForUser.mockRejectedValue(new Error("connection refused"));

    const response = await GET(request(), params());

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: "ORDER_STATUS_UNAVAILABLE" });
  });

  it("does not answer POST", async () => {
    expect((await POST()).status).toBe(405);
  });
});
