import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  authorityConfigured: vi.fn(() => true),
  authenticate: vi.fn(() => ({ operatorId: "dispatcher.carol", authority: "dispatch" as const })),
}));

vi.mock("@/server/refunds/composition", () => ({
  createProductionRefundCommandService: () => ({ execute: mocks.execute }),
}));
vi.mock("@/server/refunds/operator-auth", () => ({
  refundOperatorAuthorityConfigured: mocks.authorityConfigured,
  authenticateRefundOperator: mocks.authenticate,
}));

import { POST } from "./route";

const refundId = "22222222-2222-4222-8222-222222222222";
const context = { params: Promise.resolve({ refundId }) };

function request() {
  return new Request(`https://staging.quickiching.com/api/internal/refunds/${refundId}/dispatch`, {
    method: "POST",
    headers: { Authorization: "Bearer dispatch-secret-0001" },
  });
}

describe("refund operator dispatch route provider-write outcomes", () => {
  beforeEach(() => {
    mocks.execute.mockReset();
    mocks.authorityConfigured.mockClear();
    mocks.authenticate.mockClear();
  });

  it("binds the provider dispatch command to the authenticated dispatch operator", async () => {
    mocks.execute.mockResolvedValueOnce({ outcome: "dispatched" });

    const response = await POST(request(), context);

    expect(response.status).toBe(200);
    expect(mocks.authenticate).toHaveBeenCalledWith(expect.any(Request), "dispatch");
    expect(mocks.execute).toHaveBeenCalledWith(refundId, "dispatcher.carol");
  });

  it("marks a proven not-dispatched provider write as safe for explicit operator retry", async () => {
    mocks.execute.mockRejectedValueOnce(new Error("REFUND_PROVIDER_WRITE_NOT_DISPATCHED"));

    const response = await POST(request(), context);

    expect(mocks.execute).toHaveBeenCalledWith(refundId, "dispatcher.carol");
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
