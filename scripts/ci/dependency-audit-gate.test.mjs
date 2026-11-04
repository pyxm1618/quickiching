import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAuditAgainstBaseline, parseAuditAdvisories } from "./dependency-audit-gate.mjs";

const baseline = {
  uniqueAdvisories: [
    { id: "GHSA-aaaa-bbbb-cccc", severity: "high", summary: "known" },
    { id: "GHSA-dddd-eeee-ffff", severity: "critical", summary: "known critical" },
  ],
};

test("audit parser deduplicates advisory instances by GHSA id", () => {
  const output = [
    "high: one - https://github.com/advisories/GHSA-aaaa-bbbb-cccc",
    "high: duplicate instance - https://github.com/advisories/GHSA-aaaa-bbbb-cccc",
  ].join("\n");
  assert.deepEqual(parseAuditAdvisories(output).map((item) => item.id), ["GHSA-aaaa-bbbb-cccc"]);
});

test("known baseline debt does not false-red unrelated changes", () => {
  const result = evaluateAuditAgainstBaseline(
    [{ id: "GHSA-aaaa-bbbb-cccc", severity: "high", summary: "known" }],
    baseline,
  );
  assert.deepEqual(result.newAdvisories, []);
  assert.deepEqual(result.resolvedAdvisories.map((item) => item.id), ["GHSA-dddd-eeee-ffff"]);
});

test("new high or critical advisory IDs fail the regression contract", () => {
  const result = evaluateAuditAgainstBaseline(
    [
      { id: "GHSA-aaaa-bbbb-cccc", severity: "high", summary: "known" },
      { id: "GHSA-1111-2222-3333", severity: "critical", summary: "new" },
    ],
    baseline,
  );
  assert.deepEqual(result.newAdvisories.map((item) => item.id), ["GHSA-1111-2222-3333"]);
});
