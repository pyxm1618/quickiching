import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  decide: vi.fn(),
  authorityConfigured: vi.fn(() => true),
  authenticate: vi.fn(() => ({ operatorId: "approver.alice", authority: "decision" as const })),
}));

vi.mock("@/server/refunds/composition", () => ({
  createProductionRefundRepository: () => ({ decide: mocks.decide }),
}));
vi.mock("@/server/refunds/operator-auth", () => ({
  refundOperatorAuthorityConfigured: mocks.authorityConfigured,
  authenticateRefundOperator: mocks.authenticate,
}));

import { POST } from "./route";

const refundId = "22222222-2222-4222-8222-222222222222";
const context = { params: Promise.resolve({ refundId }) };

function request() {
  return new Request(`https://staging.quickiching.com/api/internal/refunds/${refundId}/decision`, {
    method: "POST",
    headers: {
      Authorization: "Bearer decision-secret-0001",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "approve", note: "approved" }),
  });
}

describe("refund operator decision route identity", () => {
  it("passes only the authenticated server-derived operator identity to the decision repository", async () => {
    mocks.decide.mockResolvedValueOnce({ id: refundId, orderId: "order-1", status: "approved" });

    const response = await POST(request(), context);

    expect(response.status).toBe(200);
    expect(mocks.authenticate).toHaveBeenCalledWith(expect.any(Request), "decision");
    expect(mocks.decide).toHaveBeenCalledWith(expect.objectContaining({
      refundId,
      action: "approve",
      operatorId: "approver.alice",
      note: "approved",
    }));
  });
});
