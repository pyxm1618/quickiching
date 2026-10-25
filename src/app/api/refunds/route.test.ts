import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enabled: true,
  sameOrigin: true,
}));

vi.mock("@/server/payments/capability", () => ({ isCheckoutCapabilityEnabled: () => mocks.enabled }));
vi.mock("@/server/http/origin-guard", () => ({ isStrictSameOriginRequest: () => mocks.sameOrigin }));
vi.mock("@/server/refunds/composition", () => ({ createProductionRefundRepository: vi.fn() }));

import { POST } from "./route";

describe("refund capability defense in depth", () => {
  beforeEach(() => {
    mocks.enabled = true;
    mocks.sameOrigin = true;
  });

  it("returns not found when checkout capability is disabled", async () => {
    mocks.enabled = false;
    const response = await POST(new Request("https://www.quickiching.com/api/refunds", { method: "POST" }));
    expect(response.status).toBe(404);
  });
});
