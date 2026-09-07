import { describe, expect, it } from "vitest";
import { verifyRefundOperatorAuthorization } from "./operator-auth";

function request(value?: string) {
  return new Request("https://quickiching.example/api/internal/refunds/test", {
    headers: value ? { authorization: value } : {},
  });
}

describe("refund operator authorization", () => {
  it("accepts only the exact dedicated Bearer secret", () => {
    expect(verifyRefundOperatorAuthorization(request("Bearer operator-secret"), "operator-secret")).toBe(true);
    expect(verifyRefundOperatorAuthorization(request("Bearer wrong-secret"), "operator-secret")).toBe(false);
    expect(verifyRefundOperatorAuthorization(request(), "operator-secret")).toBe(false);
    expect(verifyRefundOperatorAuthorization(request("Basic operator-secret"), "operator-secret")).toBe(false);
  });

  it("fails closed when the operator secret is not configured", () => {
    expect(verifyRefundOperatorAuthorization(request("Bearer operator-secret"), "")).toBe(false);
  });
});
