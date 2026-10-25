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

  it("never falls back to APP_SECRET in staging", () => {
    expect(resolveRefundOperatorSecret({ REFUND_OPERATOR_SECRET: "my-secret" })).toBe("my-secret");
    expect(resolveRefundOperatorSecret({ QUICKICHING_DEPLOYMENT_TIER: "staging", APP_SECRET: "staging-app-secret" })).toBe("");
    expect(resolveRefundOperatorSecret({ QUICKICHING_DEPLOYMENT_TIER: "production", APP_SECRET: "prod-app-secret" })).toBe("");
  });

  it("fails closed on staging when the dedicated refund secret is absent", () => {
    const env = { QUICKICHING_DEPLOYMENT_TIER: "staging", APP_SECRET: "staging-app-secret" };
    const expected = resolveRefundOperatorSecret(env);
    expect(verifyRefundOperatorAuthorization(request("Bearer staging-app-secret"), expected)).toBe(false);
  });
});
