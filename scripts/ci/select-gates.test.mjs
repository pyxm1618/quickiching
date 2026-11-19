import test from "node:test";
import assert from "node:assert/strict";
import { classifyChangedFiles, shouldForceFullContext } from "./select-gates.mjs";

const pick = (files) => classifyChangedFiles(files);

const cases = [
  {
    name: "docs",
    files: ["README.md"],
    expect: { risk_class: "0", runtime: false, build: false, database: false, reading: false, public_seo: false, performance: false },
  },
  {
    name: "copy/static content",
    files: ["src/content/hexagrams/copy.ts"],
    expect: { risk_class: "1", runtime: true, build: true, seo_static: true, seo_browser: false, database: false, payment_refund: false },
  },
  {
    name: "CSS global",
    files: ["src/app/globals.css"],
    expect: { risk_class: "7", build: true, reading: true, seo_browser: true, navigation: true, account_info: true, hexagram_detail: true, database: false, payment_refund: false, performance: true },
  },
  {
    name: "UI component local",
    files: ["src/components/account/account-shell.tsx"],
    expect: { risk_class: "2", build: true, account_info: true, database: false, payment_refund: false, reading: false, performance: true },
  },
  {
    name: "shared UI component",
    files: ["src/components/ui/button.tsx"],
    expect: { risk_class: "7", build: true, reading: true, seo_browser: true, account_info: true, hexagram_detail: true, database: false, payment_refund: false },
  },
  {
    name: "navigation",
    files: ["src/components/scene-navigation/scene-navigation.tsx"],
    expect: { risk_class: "3", build: true, navigation: true, seo_browser: true, database: false, auth_lifecycle: false, payment_refund: false },
  },
  {
    name: "middleware",
    files: ["src/middleware.ts"],
    expect: { risk_class: "7", build: true, navigation: true, seo_browser: true, security: true, database: false, payment_refund: false },
  },
  {
    name: "next.config",
    files: ["next.config.mjs"],
    expect: { risk_class: "7", build: true, navigation: true, seo_browser: true, security: true, database: false, payment_refund: false, reading: false, account_info: false, performance: true },
  },
  {
    name: "tsconfig",
    files: ["tsconfig.json"],
    expect: { risk_class: "7", runtime: true, build: true, database: false, reading: false, public_seo: false, payment_refund: false, performance: false },
  },
  {
    name: "package.json",
    files: ["package.json"],
    expect: { risk_class: "7", runtime: true, build: true, security: true, database: false, reading: false, payment_refund: false, performance: false },
  },
  {
    name: "bun.lock",
    files: ["bun.lock"],
    expect: { risk_class: "7", runtime: true, build: true, security: true, database: false, reading: false, payment_refund: false, performance: false },
  },
  {
    name: "DB runtime",
    files: ["src/server/db/client.ts"],
    expect: { risk_class: "4", build: true, database: true, schema: false, reading: false, payment_refund: false, performance: false },
  },
  {
    name: "migration",
    files: ["drizzle/0013_future_contract.sql"],
    expect: { risk_class: "5", build: false, schema: true, database: true, auth_lifecycle: true, payment_refund: true, seo_browser: false, performance: false },
  },
  {
    name: "auth",
    files: ["src/server/auth/runtime.ts"],
    expect: { risk_class: "6", build: true, database: true, auth_lifecycle: true, security: true, payment_refund: false, public_seo: false },
  },
  {
    name: "payment",
    files: ["src/server/payments/postgres-repository.ts"],
    expect: { risk_class: "6", build: true, database: true, payment_refund: true, security: true, hexagram_detail: false, public_seo: false, performance: false },
  },
  {
    name: "refund",
    files: ["src/server/refunds/postgres-refund-repository.ts"],
    expect: { risk_class: "6", build: true, database: true, payment_refund: true, security: true, hexagram_detail: false, public_seo: false, performance: false },
  },
  {
    name: ".github workflow",
    files: [".github/workflows/ci.yml"],
    expect: { risk_class: "7", runtime: false, ci_contract: true, build: false, database: false, reading: false, public_seo: false, payment_refund: false, performance: false },
  },
  {
    name: "scripts/ci",
    files: ["scripts/ci/required-gate.mjs"],
    expect: { risk_class: "7", runtime: false, ci_contract: true, build: false, database: false, reading: false, public_seo: false, payment_refund: false, performance: false },
  },
  {
    name: "unknown server runtime fail-closed",
    files: ["src/server/new-cross-cutting/example.ts"],
    expect: { risk_class: "4", high_risk: true, build: true, database: true, reading: true, auth_lifecycle: true, payment_refund: true, security: true, public_seo: false, performance: false },
  },
];

for (const c of cases) {
  test(c.name, () => {
    const r = pick(c.files);
    for (const [key, value] of Object.entries(c.expect)) assert.equal(r[key], value, c.name + ": " + key);
  });
}

test("performance target selection is domain-aware", () => {
  assert.deepEqual(JSON.parse(pick(["src/components/account/account-shell.tsx"]).performance_targets), ["account.desktop"]);
  assert.deepEqual(JSON.parse(pick(["src/components/reading-result/reading-result-client.tsx"]).performance_targets), ["result.mobile", "result.desktop"]);
  assert.deepEqual(JSON.parse(pick(["src/components/hexagram-detail-page.tsx"]).performance_targets), ["hexagram-hub.desktop"]);
  assert.equal(JSON.parse(pick(["src/app/globals.css"]).performance_targets).length, 8);
});

test("force-full contexts remain full regression for main/nightly/release", () => {
  const r = classifyChangedFiles([], { forceFull: true });
  assert.equal(r.full, true);
  assert.equal(r.database, true);
  assert.equal(r.reading, true);
  assert.equal(r.payment_refund, true);
  assert.equal(r.performance, true);
  assert.equal(JSON.parse(r.performance_targets).length, 8);
});

test("integration and release PR contexts force full independently of changed paths", () => {
  assert.equal(shouldForceFullContext("pull_request", "integration/quickiching-ui-redesign"), true);
  assert.equal(shouldForceFullContext("pull_request", "release/2026-11"), true);
  assert.equal(shouldForceFullContext("pull_request", "feature/small-copy"), false);
});

test("push, schedule, release and workflow_dispatch contexts force full", () => {
  for (const eventName of ["push", "schedule", "release", "workflow_dispatch"]) {
    assert.equal(shouldForceFullContext(eventName, ""), true);
  }
});
