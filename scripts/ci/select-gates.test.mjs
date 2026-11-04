import test from "node:test";
import assert from "node:assert/strict";
import { classifyChangedFiles, shouldForceFullContext } from "./select-gates.mjs";

function pick(files) {
  return classifyChangedFiles(files);
}

test("DB-only change selects Core + Database without unrelated browser domains", () => {
  const r = pick(["src/server/db/client.ts"]);
  assert.equal(r.full, false);
  assert.equal(r.database, true);
  assert.equal(r.reading, false);
  assert.equal(r.payment, false);
  assert.equal(r.performance, false);
});

test("Three-Coin-only change selects Reading + Performance", () => {
  const r = pick(["src/components/public-reading/three-coin-tool.tsx"]);
  assert.equal(r.full, false);
  assert.equal(r.reading, true);
  assert.equal(r.performance, true);
  assert.deepEqual(JSON.parse(r.performance_targets), ["three-coin.desktop", "result.mobile", "result.desktop"]);
});


test("Reading result component selects Reading + Performance", () => {
  const r = pick(["src/components/reading-result/reading-result-client.tsx"]);
  assert.equal(r.reading, true);
  assert.equal(r.performance, true);
  assert.deepEqual(JSON.parse(r.performance_targets), ["three-coin.desktop", "result.mobile", "result.desktop"]);
});

test("Hexagram detail component selects Public/SEO + Hexagram structural gate + Performance", () => {
  const r = pick(["src/components/hexagram-detail-page.tsx"]);
  assert.equal(r.public_seo, true);
  assert.equal(r.hexagram_detail, true);
  assert.equal(r.performance, true);
  assert.deepEqual(JSON.parse(r.performance_targets), ["home.mobile", "home.desktop", "hexagram-hub.desktop"]);
});

test("Info component selects Public/SEO + Account/Info + Info performance", () => {
  const r = pick(["src/components/info-pages/info-pages.module.css"]);
  assert.equal(r.public_seo, true);
  assert.equal(r.account_info, true);
  assert.equal(r.performance, true);
  assert.deepEqual(JSON.parse(r.performance_targets), ["home.mobile", "home.desktop", "info.desktop"]);
});

test("Account-only change selects Account/Info + Performance", () => {
  const r = pick(["src/components/account/account-shell.tsx"]);
  assert.equal(r.account_info, true);
  assert.equal(r.performance, true);
  assert.deepEqual(JSON.parse(r.performance_targets), ["account.desktop"]);
});

test("Info-only change selects Public/SEO + Account/Info + Performance", () => {
  const r = pick(["src/app/(default)/guides/how-to-ask-the-i-ching/page.tsx"]);
  assert.equal(r.public_seo, true);
  assert.equal(r.account_info, true);
  assert.equal(r.performance, true);
  assert.deepEqual(JSON.parse(r.performance_targets), ["home.mobile", "home.desktop", "info.desktop"]);
});

test("Payment-only server change selects Payment + Database", () => {
  const r = pick(["src/server/payments/postgres-repository.ts"]);
  assert.equal(r.payment, true);
  assert.equal(r.database, true);
  assert.equal(r.performance, false);
});

for (const file of [
  "src/app/globals.css",
  "package.json",
  ".github/workflows/ci.yml",
  "drizzle/0013_future_contract.sql",
]) {
  test(`${file} forces FULL mode`, () => {
    const r = pick([file]);
    assert.equal(r.full, true);
    assert.equal(r.database, true);
    assert.equal(r.reading, true);
    assert.equal(r.public_seo, true);
    assert.equal(r.account_info, true);
    assert.equal(r.payment, true);
    assert.equal(r.hexagram_detail, true);
    assert.equal(r.performance, true);
  });
}

test("push/main and workflow_dispatch can force FULL independently of diff", () => {
  const r = classifyChangedFiles([], { forceFull: true });
  assert.equal(r.full, true);
  assert.equal(JSON.parse(r.performance_targets).length, 8);
});

test("integration and release PR contexts force FULL independently of changed paths", () => {
  assert.equal(shouldForceFullContext("pull_request", "integration/quickiching-ui-redesign"), true);
  assert.equal(shouldForceFullContext("pull_request", "release/2026-11"), true);
  assert.equal(shouldForceFullContext("pull_request", "feature/small-copy"), false);
});

test("push main and workflow dispatch contexts force FULL", () => {
  assert.equal(shouldForceFullContext("push", ""), true);
  assert.equal(shouldForceFullContext("workflow_dispatch", ""), true);
});
