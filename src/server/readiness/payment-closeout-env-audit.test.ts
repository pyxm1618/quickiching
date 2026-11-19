import { describe, expect, it } from "vitest";
import {
  auditPaymentCloseoutProductionEnv,
  auditPaymentCloseoutStagingEnv,
  type PaymentCloseoutEnvEntry,
} from "./payment-closeout-env-audit";
import { refundOperatorAuthorityConfigured } from "@/server/refunds/operator-auth";

type Mode = "staging" | "production";

const DECISION_CREDENTIALS = JSON.stringify({
  "approver.alice": "decision-secret-0001",
});
const DISPATCH_CREDENTIALS = JSON.stringify({
  "dispatcher.carol": "dispatch-secret-0001",
});

function productKeys(mode: Mode): string[] {
  const prefix = mode === "staging" ? "WAFFO_TEST" : "WAFFO_PROD";
  return [`${prefix}_PRODUCT_ID_ONE`, `${prefix}_PRODUCT_ID_THREE`, `${prefix}_PRODUCT_ID_FIVE`];
}

function validEntries(
  mode: Mode,
  credentials: { decision?: string; dispatch?: string } = {
    decision: DECISION_CREDENTIALS,
    dispatch: DISPATCH_CREDENTIALS,
  },
  productMode: Mode = mode,
): PaymentCloseoutEnvEntry[] {
  const entries: PaymentCloseoutEnvEntry[] = [
    { key: "APP_ENV", target: ["production"], value: mode, type: "plain" },
    { key: "WAFFO_ENVIRONMENT", target: ["production"], value: mode === "staging" ? "test" : "prod", type: "plain" },
    ...[
      "DATABASE_URL",
      "WAFFO_MERCHANT_ID",
      "WAFFO_PRIVATE_KEY",
      "WAFFO_STORE_ID",
      ...productKeys(productMode),
      "PAYMENT_CHECKOUT_URL_KEYS",
    ].map((key) => ({ key, target: ["production"], type: "sensitive" })),
  ];
  if (credentials.decision !== undefined) {
    entries.push({
      key: "REFUND_DECISION_OPERATOR_CREDENTIALS",
      target: ["production"],
      value: credentials.decision,
      type: "sensitive",
    });
  }
  if (credentials.dispatch !== undefined) {
    entries.push({
      key: "REFUND_DISPATCH_OPERATOR_CREDENTIALS",
      target: ["production"],
      value: credentials.dispatch,
      type: "sensitive",
    });
  }
  return entries;
}

function audit(mode: Mode, entries: readonly PaymentCloseoutEnvEntry[]) {
  return mode === "staging"
    ? auditPaymentCloseoutStagingEnv(entries)
    : auditPaymentCloseoutProductionEnv(entries);
}

describe("payment closeout staging env audit", () => {
  it("passes exact staging/test mapping while treating sensitive values as presence-only", () => {
    const result = auditPaymentCloseoutStagingEnv(validEntries("staging"));
    expect(result).toEqual({
      ok: true,
      appEnv: "staging",
      waffoEnvironment: "test",
      missingKeys: [],
      unreadableRequiredValues: [],
    });
  });

  it("reports missing keys and unreadable mapping values without exposing secret contents", () => {
    const result = auditPaymentCloseoutStagingEnv([
      { key: "APP_ENV", target: "production", type: "sensitive" },
      { key: "WAFFO_ENVIRONMENT", target: "production", type: "sensitive" },
      { key: "DATABASE_URL", target: "production", type: "sensitive" },
      { key: "WAFFO_MERCHANT_ID", target: "production", type: "sensitive" },
      { key: "WAFFO_PRIVATE_KEY", target: "production", type: "sensitive" },
      { key: "WAFFO_STORE_ID", target: "production", type: "sensitive" },
      { key: "WAFFO_TEST_PRODUCT_ID_ONE", target: "production", type: "sensitive" },
      { key: "WAFFO_TEST_PRODUCT_ID_THREE", target: "production", type: "sensitive" },
      { key: "WAFFO_TEST_PRODUCT_ID_FIVE", target: "production", type: "sensitive" },
      { key: "PAYMENT_CHECKOUT_URL_KEYS", target: "production", type: "sensitive" },
    ]);
    expect(result.ok).toBe(false);
    expect(result.missingKeys).toEqual([
      "REFUND_DECISION_OPERATOR_CREDENTIALS",
      "REFUND_DISPATCH_OPERATOR_CREDENTIALS",
    ]);
    expect(result.unreadableRequiredValues).toEqual(["APP_ENV", "WAFFO_ENVIRONMENT"]);
    expect(JSON.stringify(result)).not.toContain("DATABASE_URL=");
  });

  it("fails closed on the wrong readable environment mapping", () => {
    const entries = validEntries("staging").map((entry) => {
      if (entry.key === "APP_ENV") return { ...entry, value: "production" };
      if (entry.key === "WAFFO_ENVIRONMENT") return { ...entry, value: "prod" };
      return entry;
    });
    const result = auditPaymentCloseoutStagingEnv(entries);
    expect(result.ok).toBe(false);
    expect(result.appEnv).toBe("invalid");
    expect(result.waffoEnvironment).toBe("invalid");
  });
});

describe("payment closeout production env audit", () => {
  it("requires production/prod mapping and production product IDs", () => {
    const result = auditPaymentCloseoutProductionEnv(validEntries("production"));
    expect(result).toEqual({
      ok: true,
      appEnv: "production",
      waffoEnvironment: "prod",
      missingKeys: [],
      unreadableRequiredValues: [],
    });
  });

  it("does not accept Test product IDs as Production readiness", () => {
    const result = auditPaymentCloseoutProductionEnv(validEntries("production", {
      decision: DECISION_CREDENTIALS,
      dispatch: DISPATCH_CREDENTIALS,
    }, "staging"));
    expect(result.ok).toBe(false);
    expect(result.missingKeys).toEqual([
      "WAFFO_PROD_PRODUCT_ID_FIVE",
      "WAFFO_PROD_PRODUCT_ID_ONE",
      "WAFFO_PROD_PRODUCT_ID_THREE",
    ]);
  });
});

describe("refund operator credential readiness contract", () => {
  it.each(["staging", "production"] as const)("rejects legacy-only refund credentials in %s", (mode) => {
    const result = audit(mode, [
      ...validEntries(mode, { decision: undefined, dispatch: undefined }),
      { key: "REFUND_OPERATOR_SECRET", target: ["production"], value: "legacy-shared-secret-0001", type: "sensitive" },
    ]);
    expect(result.ok).toBe(false);
    expect(result.missingKeys).toEqual([
      "REFUND_DECISION_OPERATOR_CREDENTIALS",
      "REFUND_DISPATCH_OPERATOR_CREDENTIALS",
    ]);
  });

  it.each(["staging", "production"] as const)("accepts valid decision and dispatch credential maps in %s", (mode) => {
    expect(audit(mode, validEntries(mode)).ok).toBe(true);
  });

  it.each(["staging", "production"] as const)("requires decision credentials in %s", (mode) => {
    const result = audit(mode, validEntries(mode, { dispatch: DISPATCH_CREDENTIALS }));
    expect(result.ok).toBe(false);
    expect(result.missingKeys).toContain("REFUND_DECISION_OPERATOR_CREDENTIALS");
  });

  it.each(["staging", "production"] as const)("requires dispatch credentials in %s", (mode) => {
    const result = audit(mode, validEntries(mode, { decision: DECISION_CREDENTIALS }));
    expect(result.ok).toBe(false);
    expect(result.missingKeys).toContain("REFUND_DISPATCH_OPERATOR_CREDENTIALS");
  });

  it.each(["staging", "production"] as const)("rejects malformed credential JSON in %s", (mode) => {
    expect(audit(mode, validEntries(mode, {
      decision: "{not-json",
      dispatch: DISPATCH_CREDENTIALS,
    })).ok).toBe(false);
  });

  it.each([
    ["invalid operator ID", JSON.stringify({ " bad-id": "decision-secret-0001" }), DISPATCH_CREDENTIALS],
    ["invalid secret", JSON.stringify({ "approver.alice": "too-short" }), DISPATCH_CREDENTIALS],
  ] as const)("rejects %s in staging and production", (_label, decision, dispatch) => {
    for (const mode of ["staging", "production"] as const) {
      expect(audit(mode, validEntries(mode, { decision, dispatch })).ok).toBe(false);
    }
  });

  it.each(["staging", "production"] as const)("rejects decision/dispatch secret reuse in %s", (mode) => {
    const sharedSecret = "shared-secret-0000001";
    expect(audit(mode, validEntries(mode, {
      decision: JSON.stringify({ "approver.alice": sharedSecret }),
      dispatch: JSON.stringify({ "dispatcher.carol": sharedSecret }),
    })).ok).toBe(false);
  });

  it.each(["staging", "production"] as const)("matches runtime authority configuration in %s", (mode) => {
    const cases = [
      { decision: DECISION_CREDENTIALS, dispatch: DISPATCH_CREDENTIALS },
      { decision: "{not-json", dispatch: DISPATCH_CREDENTIALS },
      {
        decision: JSON.stringify({ "approver.alice": "shared-secret-0000001" }),
        dispatch: JSON.stringify({ "dispatcher.carol": "shared-secret-0000001" }),
      },
    ];
    for (const credentials of cases) {
      const runtimeEnv = {
        REFUND_DECISION_OPERATOR_CREDENTIALS: credentials.decision,
        REFUND_DISPATCH_OPERATOR_CREDENTIALS: credentials.dispatch,
      };
      const runtimeReady = refundOperatorAuthorityConfigured("decision", runtimeEnv)
        && refundOperatorAuthorityConfigured("dispatch", runtimeEnv);
      expect(audit(mode, validEntries(mode, credentials)).ok).toBe(runtimeReady);
    }
  });
});
