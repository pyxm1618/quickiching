import test from "node:test";
import assert from "node:assert/strict";
import { evaluateRequiredGate } from "./required-gate.mjs";

const base = {
  select: "success",
  core: "success",
  database: "success",
  product: "success",
  performance: "success",
  databaseSelected: true,
  productSelected: true,
  performanceSelected: true,
};

test("a selected domain failure makes CI / Required fail", () => {
  const result = evaluateRequiredGate({ ...base, database: "failure" });
  assert.equal(result.ok, false);
  assert.deepEqual(result.failed, ["database"]);
});

test("an unrelated skipped domain is accepted", () => {
  const result = evaluateRequiredGate({
    ...base,
    database: "skipped",
    databaseSelected: false,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.failed, []);
});

test("a selected skipped domain cannot false-green", () => {
  const result = evaluateRequiredGate({ ...base, product: "skipped" });
  assert.equal(result.ok, false);
  assert.deepEqual(result.failed, ["product"]);
});

test("Core and selector are always mandatory", () => {
  assert.equal(evaluateRequiredGate({ ...base, core: "failure" }).ok, false);
  assert.equal(evaluateRequiredGate({ ...base, select: "failure" }).ok, false);
});
