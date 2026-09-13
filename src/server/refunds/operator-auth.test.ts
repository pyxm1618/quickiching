import { describe, expect, it } from "vitest";
import { resolveRefundOperatorSecret, verifyRefundOperatorAuthorization } from "./operator-auth";

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

  it("resolves secret with staging fallback to APP_SECRET", () => {
    expect(resolveRefundOperatorSecret({ REFUND_OPERATOR_SECRET: "my-secret" })).toBe("my-secret");
    expect(resolveRefundOperatorSecret({ QUICKICHING_DEPLOYMENT_TIER: "staging", APP_SECRET: "staging-app-secret" })).toBe("staging-app-secret");
    expect(resolveRefundOperatorSecret({ QUICKICHING_DEPLOYMENT_TIER: "production", APP_SECRET: "prod-app-secret" })).toBe("");
  });

  it("allows APP_SECRET on staging in verifyRefundOperatorAuthorization", () => {
    const env = { QUICKICHING_DEPLOYMENT_TIER: "staging", APP_SECRET: "staging-app-secret" };
    expect(verifyRefundOperatorAuthorization(request("Bearer staging-app-secret"), "staging-app-secret", env)).toBe(true);
  });
});
