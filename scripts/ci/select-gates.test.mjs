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
    expect: { risk_class: "3", build: true, navigation: true, seo_browser: true, database: false, auth_lifecycle: true, payment_refund: false },
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

test("HIGH-001 reading lifecycle ownership selects Auth Lifecycle for R3", () => {
  const cases = [
    ["reading resume", "src/lib/reading-resume.ts", { build: true }],
    ["reading handoff", "src/lib/reading-handoff.ts", { build: true }],
    ["reading workflow", "src/server/workflows/deep-reading-workflow.ts", { build: true }],
    ["reading repository", "src/server/repositories/reading-repository.ts", { build: true, database: true }],
  ];

  for (const [name, file, extra] of cases) {
    const r = pick([file]);
    assert.equal(r.reading, true, name + ": reading");
    assert.equal(r.reading_lifecycle, true, name + ": reading_lifecycle");
    assert.equal(r.auth_lifecycle, true, name + ": auth_lifecycle");
    assert.equal(r.build, true, name + ": build");
    if (extra.database) assert.equal(r.database, true, name + ": database");
  }
});

test("HIGH-001 navigation ownership selects Auth Lifecycle for R2", () => {
  const scene = pick(["src/components/scene-navigation/scene-navigation.tsx"]);
  assert.equal(scene.navigation, true);
  assert.equal(scene.auth_lifecycle, true);
  assert.equal(scene.seo_browser, true);
  assert.equal(scene.build, true);

  const locale = pick(["src/navigation/locale-navigation.ts"]);
  assert.equal(locale.build, true);
  assert.equal(locale.navigation, true);
  assert.equal(locale.auth_lifecycle, true);
});

test("mixed dependency plus auth changes preserve Auth Lifecycle ownership", () => {
  const result = pick(["package.json", "bun.lock", "src/server/auth/server.ts"]);
  assert.equal(result.runtime, true);
  assert.equal(result.build, true);
  assert.equal(result.database, true);
  assert.equal(result.auth_lifecycle, true);
  assert.equal(result.security, true);
});

test("HIGH-001 negative controls avoid Auth Lifecycle over-trigger", () => {
  const controls = [
    ["docs", "README.md"],
    ["CI-only", "scripts/ci/select-gates.mjs"],
    ["tsconfig-only", "tsconfig.json"],
    ["package-only", "package.json"],
    ["bun-lock-only", "bun.lock"],
    ["unrelated local UI", "src/components/privacy-settings-button.tsx"],
  ];

  for (const [name, file] of controls) {
    const r = pick([file]);
    assert.equal(r.auth_lifecycle, false, name + ": auth_lifecycle");
  }

  const docs = pick(["README.md"]);
  assert.equal(docs.navigation, false);
  assert.equal(docs.reading_lifecycle, false);

  const ciOnly = pick(["scripts/ci/select-gates.mjs"]);
  assert.equal(ciOnly.navigation, false);
  assert.equal(ciOnly.reading_lifecycle, false);

  for (const file of ["tsconfig.json", "package.json", "bun.lock"]) {
    const r = pick([file]);
    assert.equal(r.navigation, false, file + ": navigation");
    assert.equal(r.reading_lifecycle, false, file + ": reading_lifecycle");
  }
});

test("Reading lifecycle is selected only for lifecycle/persistence blast radius", () => {
  const localUi = pick(["src/components/public-reading/three-coin-tool.tsx"]);
  assert.equal(localUi.reading, true);
  assert.equal(localUi.reading_lifecycle, false);
  assert.equal(localUi.auth_lifecycle, false);

  const lifecycle = pick(["src/server/generation/deep-reading-service.ts"]);
  assert.equal(lifecycle.reading, true);
  assert.equal(lifecycle.reading_lifecycle, true);
  assert.equal(lifecycle.auth_lifecycle, true);
  assert.equal(lifecycle.database, true);
});

test("Unknown server runtime also fail-closes Reading lifecycle", () => {
  const r = pick(["src/server/new-cross-cutting/example.ts"]);
  assert.equal(r.reading_lifecycle, true);
  assert.equal(r.high_risk, true);
});

test("SEO registry source selects rendered SEO browser quality audit", () => {
  const r = pick(["src/content/hexagrams/seo.ts"]);
  assert.equal(r.seo_static, true);
  assert.equal(r.seo_browser, true);
  assert.equal(r.database, false);
  assert.equal(r.payment_refund, false);
});

test("Interpretation bundle changes select both static registry and rendered SEO browser", () => {
  const r = pick(["src/domain/interpretation/reading-text.ts"]);
  assert.equal(r.seo_static, true);
  assert.equal(r.seo_browser, true);
  assert.equal(r.database, false);
  assert.equal(r.payment_refund, false);
});

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
  assert.equal(r.reading_lifecycle, true);
  assert.equal(r.payment_refund, true);
  assert.equal(r.payment, true);
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

// PR #144 shipped a Home regression that merged green: ritual.css collapsed the
// localized hero heading on mobile, yet the selector only asked for
// three-coin.desktop and skipped the locale gate entirely. These cases pin the
// blast radius of the Home surface so the same change can never merge unwatched.
const PR_144_FILES = [
  ".github/workflows/ci.yml",
  "bun.lock",
  "package.json",
  "scripts/ci/select-gates.mjs",
  "scripts/home-mobile-chrome-gate.mjs",
  "scripts/production-schema-release.ts",
  "src/components/public-reading/ritual.css",
  "src/components/scene-navigation.css",
  "src/content/hexagrams/seo.test.ts",
  "src/content/hexagrams/seo.ts",
  "src/server/readiness/production-schema-release.test.ts",
  "src/server/readiness/production-schema-release.ts",
];

test("PR #144 change set selects Locale Browser and Home Lighthouse targets", () => {
  const r = pick(PR_144_FILES);
  assert.equal(r.locale_browser, true, "locale_browser");
  assert.equal(r.public_seo, true, "public_seo");
  assert.equal(r.performance, true, "performance");
  const targets = JSON.parse(r.performance_targets);
  assert.ok(targets.includes("home.mobile"), "home.mobile must be measured");
  assert.ok(targets.includes("home.desktop"), "home.desktop must be measured");
  assert.ok(targets.includes("three-coin.desktop"), "three-coin.desktop must stay selected");
});

test("Home surface styles own the Home performance targets", () => {
  const ritual = pick(["src/components/public-reading/ritual.css"]);
  assert.equal(ritual.reading, true, "ritual.css must select Reading");
  assert.equal(ritual.locale_browser, true, "ritual.css carries the localized hero heading");
  assert.deepEqual(JSON.parse(ritual.performance_targets), ["three-coin.desktop", "home.mobile", "home.desktop"]);

  const navigationSheet = pick(["src/components/scene-navigation.css"]);
  assert.equal(navigationSheet.navigation, true, "navigation sheet must select Navigation");
  assert.equal(navigationSheet.locale_browser, true, "navigation labels are localized");
  assert.deepEqual(JSON.parse(navigationSheet.performance_targets), ["home.mobile", "home.desktop"]);

  const consent = pick(["src/components/analytics-consent.tsx"]);
  assert.equal(consent.locale_browser, true, "consent copy is localized");
  assert.deepEqual(JSON.parse(consent.performance_targets), ["home.mobile", "home.desktop"]);

  const zhHome = pick(["src/app/(localized)/zh/page.tsx"]);
  assert.equal(zhHome.locale_browser, true, "localized home route must select the locale gate");
  assert.deepEqual(JSON.parse(zhHome.performance_targets), ["home.mobile", "home.desktop"]);
});

test("unrelated local UI still avoids the Home and locale blast radius", () => {
  const local = pick(["src/components/privacy-settings-button.tsx"]);
  assert.equal(local.locale_browser, false, "locale_browser");
  assert.deepEqual(JSON.parse(local.performance_targets), [], "performance_targets");
  assert.equal(local.performance, false, "performance");
});
