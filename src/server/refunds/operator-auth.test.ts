import { describe, expect, it } from "vitest";
import {
  authenticateRefundOperator,
  refundOperatorAuthorityConfigured,
  refundOperatorCredentialConfigurationValid,
} from "./operator-auth";

function request(value?: string) {
  return new Request("https://quickiching.example/api/internal/refunds/test", {
    headers: value ? { authorization: value } : {},
  });
}

const env = {
  REFUND_DECISION_OPERATOR_CREDENTIALS: JSON.stringify({
    "approver.alice": "decision-secret-0001",
    "approver.bob": "decision-secret-0002",
  }),
  REFUND_DISPATCH_OPERATOR_CREDENTIALS: JSON.stringify({
    "dispatcher.carol": "dispatch-secret-0001",
  }),
};

describe("refund operator authorization", () => {
  it("derives the authenticated operator identity from the server-side credential map", () => {
    expect(authenticateRefundOperator(
      request("Bearer decision-secret-0001"),
      "decision",
      env,
    )).toEqual({ operatorId: "approver.alice", authority: "decision" });
    expect(authenticateRefundOperator(
      request("Bearer decision-secret-0002"),
      "decision",
      env,
    )).toEqual({ operatorId: "approver.bob", authority: "decision" });
  });

  it("keeps decision and provider-dispatch authority cryptographically separate", () => {
    expect(authenticateRefundOperator(
      request("Bearer decision-secret-0001"),
      "dispatch",
      env,
    )).toBeNull();
    expect(authenticateRefundOperator(
      request("Bearer dispatch-secret-0001"),
      "decision",
      env,
    )).toBeNull();
    expect(authenticateRefundOperator(
      request("Bearer dispatch-secret-0001"),
      "dispatch",
      env,
    )).toEqual({ operatorId: "dispatcher.carol", authority: "dispatch" });
  });

  it("fails closed on missing, malformed, duplicate, or legacy shared credentials", () => {
    expect(refundOperatorAuthorityConfigured("decision", {})).toBe(false);
    expect(authenticateRefundOperator(request("Bearer anything-at-all"), "decision", {})).toBeNull();

    const malformed = { REFUND_DECISION_OPERATOR_CREDENTIALS: "{not-json" };
    expect(refundOperatorAuthorityConfigured("decision", malformed)).toBe(false);

    const duplicateAcrossAuthorities = {
      REFUND_DECISION_OPERATOR_CREDENTIALS: JSON.stringify({ alice: "shared-secret-0001" }),
      REFUND_DISPATCH_OPERATOR_CREDENTIALS: JSON.stringify({ bob: "shared-secret-0001" }),
    };
    expect(refundOperatorAuthorityConfigured("decision", duplicateAcrossAuthorities)).toBe(false);
    expect(refundOperatorAuthorityConfigured("dispatch", duplicateAcrossAuthorities)).toBe(false);

    const legacyOnly = { REFUND_OPERATOR_SECRET: "legacy-shared-secret" };
    expect(refundOperatorAuthorityConfigured("decision", legacyOnly)).toBe(false);
    expect(refundOperatorAuthorityConfigured("dispatch", legacyOnly)).toBe(false);
  });

  it("validates the complete readiness credential contract with the runtime parser", () => {
    expect(refundOperatorCredentialConfigurationValid(env)).toBe(true);
    expect(refundOperatorCredentialConfigurationValid({
      REFUND_DECISION_OPERATOR_CREDENTIALS: env.REFUND_DECISION_OPERATOR_CREDENTIALS,
    })).toBe(false);
    expect(refundOperatorCredentialConfigurationValid({
      REFUND_DISPATCH_OPERATOR_CREDENTIALS: env.REFUND_DISPATCH_OPERATOR_CREDENTIALS,
    })).toBe(false);
    expect(refundOperatorCredentialConfigurationValid({
      REFUND_DECISION_OPERATOR_CREDENTIALS: "{not-json",
      REFUND_DISPATCH_OPERATOR_CREDENTIALS: env.REFUND_DISPATCH_OPERATOR_CREDENTIALS,
    })).toBe(false);
  });

  it("rejects invalid bearer shapes and unknown credentials", () => {
    expect(authenticateRefundOperator(request(), "decision", env)).toBeNull();
    expect(authenticateRefundOperator(request("Basic decision-secret-0001"), "decision", env)).toBeNull();
    expect(authenticateRefundOperator(request("Bearer wrong-secret-00000"), "decision", env)).toBeNull();
  });
});
