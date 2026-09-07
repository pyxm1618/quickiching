import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  verifyAuthorization: vi.fn(() => true),
}));

vi.mock("@/server/refunds/composition", () => ({
  createProductionRefundCommandService: () => ({ execute: mocks.execute }),
}));
vi.mock("@/server/refunds/operator-auth", () => ({
  verifyRefundOperatorAuthorization: mocks.verifyAuthorization,
}));

import { POST } from "./route";

const refundId = "22222222-2222-4222-8222-222222222222";
const context = { params: Promise.resolve({ refundId }) };

function request() {
  return new Request(`https://staging.quickiching.com/api/internal/refunds/${refundId}/dispatch`, {
    method: "POST",
    headers: { Authorization: "Bearer operator-secret" },
  });
}

describe("refund operator dispatch route provider-write outcomes", () => {
  beforeEach(() => {
    vi.stubEnv("REFUND_OPERATOR_SECRET", "operator-secret");
    mocks.execute.mockReset();
    mocks.verifyAuthorization.mockClear();
  });

  afterEach(() => vi.unstubAllEnvs());

  it("marks a proven not-dispatched provider write as safe for explicit operator retry", async () => {
    mocks.execute.mockRejectedValueOnce(new Error("REFUND_PROVIDER_WRITE_NOT_DISPATCHED"));

    const response = await POST(request(), context);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "REFUND_PROVIDER_WRITE_NOT_DISPATCHED",
      providerWriteDispatched: false,
      retryProviderWrite: true,
    });
  });

  it("marks a definite provider rejection terminal and never retryable", async () => {
    mocks.execute.mockRejectedValueOnce(new Error("REFUND_PROVIDER_REJECTED"));

    const response = await POST(request(), context);

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "REFUND_PROVIDER_REJECTED",
      providerRejected: true,
      retryProviderWrite: false,
    });
  });

  it("keeps an unknown provider outcome in reconciliation-only state", async () => {
    mocks.execute.mockRejectedValueOnce(new Error("REFUND_PROVIDER_WRITE_OUTCOME_UNKNOWN"));

    const response = await POST(request(), context);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "REFUND_PROVIDER_WRITE_OUTCOME_UNKNOWN",
      reconciliationRequired: true,
      retryProviderWrite: false,
    });
  });
});