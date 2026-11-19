import test from "node:test";
import assert from "node:assert/strict";
import { evaluateRequiredGate } from "./required-gate.mjs";

const domains = [
  ["build", "buildSelected"],
  ["schema", "schemaSelected"],
  ["database", "databaseSelected"],
  ["reading", "readingSelected"],
  ["reading_lifecycle", "readingLifecycleSelected"],
  ["seo_static", "seoStaticSelected"],
  ["seo_browser", "seoBrowserSelected"],
  ["locale_browser", "localeBrowserSelected"],
  ["navigation", "navigationSelected"],
  ["auth_lifecycle", "authLifecycleSelected"],
  ["account_info", "accountInfoSelected"],
  ["hexagram", "hexagramSelected"],
  ["security", "securitySelected"],
  ["payment_refund", "paymentRefundSelected"],
  ["performance", "performanceSelected"],
];

const base = { select: "success", fast: "success" };
for (const [resultKey, selectedKey] of domains) {
  base[resultKey] = "success";
  base[selectedKey] = true;
}

for (const mandatory of ["select", "fast"]) {
  test(`${mandatory} is always mandatory`, () => {
    const result = evaluateRequiredGate({ ...base, [mandatory]: "failure" });
    assert.equal(result.ok, false);
    assert.deepEqual(result.failed, [mandatory]);
  });
}

for (const [resultKey, selectedKey] of domains) {
  for (const badResult of ["failure", "cancelled", "skipped", undefined]) {
    test(`selected ${resultKey} cannot be ${String(badResult)}`, () => {
      const result = evaluateRequiredGate({ ...base, [resultKey]: badResult });
      assert.equal(result.ok, false);
      assert.deepEqual(result.failed, [resultKey]);
    });
  }

  test(`unselected ${resultKey} accepts skipped`, () => {
    const result = evaluateRequiredGate({ ...base, [selectedKey]: false, [resultKey]: "skipped" });
    assert.equal(result.ok, true);
    assert.deepEqual(result.failed, []);
  });

  test(`unselected ${resultKey} accepts success`, () => {
    const result = evaluateRequiredGate({ ...base, [selectedKey]: false, [resultKey]: "success" });
    assert.equal(result.ok, true);
    assert.deepEqual(result.failed, []);
  });

  test(`unselected ${resultKey} still rejects failure`, () => {
    const result = evaluateRequiredGate({ ...base, [selectedKey]: false, [resultKey]: "failure" });
    assert.equal(result.ok, false);
    assert.deepEqual(result.failed, [resultKey]);
  });
}

test("all selected domains succeeding makes CI / Required pass", () => {
  const result = evaluateRequiredGate(base);
  assert.equal(result.ok, true);
  assert.deepEqual(result.failed, []);
});
