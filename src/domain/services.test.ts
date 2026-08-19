import { describe, it, expect } from "vitest";
import { evaluateRisk } from "./risk/engine";
import { normalizeQuestion, normalizeComposite, fingerprintQuestion, fingerprintKeyVersion } from "./questions/normalize";
import {
  PRODUCTS,
  getProduct,
  entitlementExpiry,
  compensationExpiry,
  CURRENCY,
} from "./entitlements/pricing";
import {
  batchIdentityHolds,
  selectEarliestExpiringBatch,
  freezeOne,
  consumeReserved,
  releaseReserved,
  type EntitlementBatch,
} from "./entitlements/batch";
import { canTransition, transition, evaluateClocks } from "./casting/lifecycle";

const now = new Date("2026-07-29T12:00:00Z");

describe("Risk engine (§11.1 regression contract)", () => {
  it("chemotherapy alone is NOT blocked (mention, no decision action)", () => {
    expect(evaluateRisk("chemotherapy", "other").status).toBe("allowed");
  });
  it("'Should I stop chemotherapy?' is a professional-decision block", () => {
    expect(evaluateRisk("Should I stop chemotherapy?", "other").status).toBe("professional_decision_blocked");
  });
  it("'Should I buy Bitcoin?' is a professional-decision block", () => {
    expect(evaluateRisk("Should I buy Bitcoin?", "wealth").status).toBe("professional_decision_blocked");
  });
  it("career context at a crypto company is allowed", () => {
    expect(
      evaluateRisk("I work at a crypto company. Should I accept a product manager role?", "career").status,
    ).toBe("allowed");
  });
  it("pharmaceutical marketing project is allowed (project, not treatment)", () => {
    expect(evaluateRisk("Should our pharmaceutical marketing project continue?", "career").status).toBe("allowed");
  });
  it("does not let a work mention cancel a direct investment decision", () => {
    expect(
      evaluateRisk("I work at a crypto company. Should I buy Bitcoin?", "career").status,
    ).toBe("professional_decision_blocked");
  });
  it("asks for clarification when a high-risk object is paired with an ambiguous action", () => {
    expect(evaluateRisk("I need guidance about my chemotherapy", "other").status).toBe("needs_clarification");
  });
  it("handles Unicode normalization variants (Chemo⁠therapy)", () => {
    expect(evaluateRisk("Should I stop Chemo⁠therapy?", "other").status).toBe("professional_decision_blocked");
  });
  it("detects emergency self-harm and blocks before any decision logic", () => {
    expect(evaluateRisk("I want to kill myself", "other").status).toBe("emergency_blocked");
  });
  it.each([
    ["我想自杀", "emergency_blocked"],
    ["我应该停止服用胰岛素吗？", "professional_decision_blocked"],
    ["我应该把全部积蓄买英伟达股票吗？", "professional_decision_blocked"],
    ["Should I stop taking insulin?", "professional_decision_blocked"],
    ["Should I plead guilty?", "professional_decision_blocked"],
  ] as const)("blocks multilingual high-risk request: %s", (question, expected) => {
    expect(evaluateRisk(question, "other").status).toBe(expected);
  });
  it("does not block an ordinary Chinese career reflection", () => {
    expect(evaluateRisk("我是否应该调整职业发展方向？", "career").status).toBe("allowed");
  });
  it("ordinary question is allowed with no codes", () => {
    const d = evaluateRisk("Should I change my career path?", "career");
    expect(d.status).toBe("allowed");
    expect(d.matchedRuleCodes).toEqual([]);
  });
});

describe("72-hour same-question lock (§10.1)", () => {
  it("normalizes case, punctuation and whitespace to the same string", () => {
    const a = normalizeQuestion("  Should I   move to  a new City?!  ");
    const b = normalizeQuestion("should i move to a new city");
    expect(a).toBe(b);
  });
  it("fingerprint is stable for identical input and key", () => {
    const c = normalizeComposite("career", "what_do_i_need_to_see_clearly", "Should I move to a new city");
    const f1 = fingerprintQuestion(c, "secret-key", "v1");
    const f2 = fingerprintQuestion(c, "secret-key", "v1");
    expect(f1).toBe(f2);
    expect(fingerprintKeyVersion(f1)).toBe("v1");
  });
  it("different question yields a different fingerprint", () => {
    const c1 = normalizeComposite("career", "what_do_i_need_to_see_clearly", "Should I move to a new city");
    const c2 = normalizeComposite("career", "what_do_i_need_to_see_clearly", "Should I stay at my job");
    expect(fingerprintQuestion(c1, "k", "v1")).not.toBe(fingerprintQuestion(c2, "k", "v1"));
  });
});

describe("Pricing & entitlements (§13)", () => {
  it("exposes the three MVP products with .99 pricing in USD", () => {
    expect(getProduct("one")?.unitPriceUsd).toBe(2.99);
    expect(getProduct("three")?.unitPriceUsd).toBe(6.99);
    expect(getProduct("five")?.unitPriceUsd).toBe(9.99);
    expect(CURRENCY).toBe("USD");
    expect(PRODUCTS.one.quantity).toBe(1);
  });
  it("entitlement validity is 12 months from purchase", () => {
    const exp = entitlementExpiry(new Date("2026-01-15T00:00:00Z"));
    expect(exp.getUTCFullYear()).toBe(2027);
    expect(exp.getUTCMonth()).toBe(0);
  });
  it("compensation expiry is the later of original and granted+30d", () => {
    const orig = new Date("2026-08-01T00:00:00Z");
    const granted = new Date("2026-07-29T00:00:00Z");
    const exp = compensationExpiry(orig, granted);
    // granted + 30d = 2026-08-28, which is later than orig (2026-08-01).
    expect(exp.getUTCDate()).toBe(28);
    expect(exp.getUTCMonth()).toBe(7);
  });

  const mkBatch = (over: Partial<EntitlementBatch>): EntitlementBatch => ({
    id: "b1",
    quantityTotal: 3,
    quantityAvailable: 3,
    quantityReserved: 0,
    quantityConsumed: 0,
    quantityRevoked: 0,
    expiresAt: new Date("2027-01-01T00:00:00Z"),
    ...over,
  });

  it("batch identity holds initially", () => {
    expect(batchIdentityHolds(mkBatch({}))).toBe(true);
  });
  it("rejects negative and fractional counters even when their sum matches", () => {
    expect(batchIdentityHolds(mkBatch({ quantityAvailable: 4, quantityReserved: -1 }))).toBe(false);
    expect(batchIdentityHolds(mkBatch({ quantityAvailable: 2.5, quantityReserved: 0.5 }))).toBe(false);
  });

  it("selects the earliest-expiring usable batch", () => {
    const soon = mkBatch({ id: "b_soon", expiresAt: new Date("2026-09-01T00:00:00Z"), quantityAvailable: 1 });
    const later = mkBatch({ id: "b_later", expiresAt: new Date("2027-01-01T00:00:00Z"), quantityAvailable: 1 });
    const selected = selectEarliestExpiringBatch([later, soon], now);
    expect(selected?.id).toBe("b_soon");
  });

  it("freeze -> consume keeps the identity and decrements correctly", () => {
    const batches = [mkBatch({ id: "b", quantityTotal: 3, quantityAvailable: 3 })];
    const fr = freezeOne(batches, now, "r1", "l1");
    if (fr.kind !== "reserved") throw new Error("expected reserved");
    expect(fr.batch.quantityAvailable).toBe(2);
    expect(fr.batch.quantityReserved).toBe(1);
    expect(batchIdentityHolds(fr.batch)).toBe(true);
    const consumed = consumeReserved(fr.batch, "r1", "l2", now);
    expect(consumed.batch.quantityReserved).toBe(0);
    expect(consumed.batch.quantityConsumed).toBe(1);
    expect(batchIdentityHolds(consumed.batch)).toBe(true);
  });

  it("release on failure restores availability; expiry routes to revoked", () => {
    const b = mkBatch({ id: "b", quantityTotal: 3, quantityAvailable: 2, quantityReserved: 1 });
    const released = releaseReserved(b, "l3", now, false);
    expect(released.batch.quantityAvailable).toBe(3);
    expect(released.batch.quantityReserved).toBe(0);
    const expired = releaseReserved(b, "l4", now, true);
    expect(expired.batch.quantityRevoked).toBe(1);
    expect(expired.batch.quantityReserved).toBe(0);
    expect(batchIdentityHolds(expired.batch)).toBe(true);
  });
});

describe("Casting lifecycle (§7.1, §7.3)", () => {
  it("allows only forward transitions", () => {
    expect(canTransition("draft", "casting")).toBe(true);
    expect(canTransition("casting", "awaiting_reveal")).toBe(true);
    expect(canTransition("awaiting_reveal", "revealed")).toBe(true);
    expect(canTransition("revealed", "user_deleted")).toBe(true);
    expect(canTransition("revealed", "casting")).toBe(false);
    expect(canTransition("expired", "revealed")).toBe(false);
  });
  it("transition throws on invalid move", () => {
    expect(() => transition("draft", "revealed")).toThrow(/CAST_INVALID_TRANSITION/);
  });
  it("evaluates the two 24h clocks independently", () => {
    const base = new Date("2026-07-29T00:00:00Z");
    const castingExpires = new Date(base.getTime() + 24 * 3600 * 1000);
    const revealExpires = new Date(base.getTime() + 48 * 3600 * 1000);
    const before = evaluateClocks({
      firstIrreversibleStepAt: base,
      castingExpiresAt: castingExpires,
      completedAt: base,
      revealExpiresAt: revealExpires,
      now: new Date(base.getTime() + 23 * 3600 * 1000),
    });
    expect(before.castingExpired).toBe(false);
    expect(before.revealExpired).toBe(false);
    const after = evaluateClocks({
      firstIrreversibleStepAt: base,
      castingExpiresAt: castingExpires,
      completedAt: base,
      revealExpiresAt: revealExpires,
      now: new Date(base.getTime() + 49 * 3600 * 1000),
    });
    expect(after.castingExpired).toBe(true);
    expect(after.revealExpired).toBe(true);
  });
});
