import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const normalize = (value) => value.replaceAll("\\", "/").replace(/^\.\//, "");
const any = (files, patterns) => files.some((file) => patterns.some((pattern) =>
  typeof pattern === "string" ? file.startsWith(pattern) : pattern.test(file)
));

const ALL_PERFORMANCE_TARGETS = [
  "home.mobile",
  "home.desktop",
  "three-coin.desktop",
  "result.mobile",
  "result.desktop",
  "info.desktop",
  "account.desktop",
  "hexagram-hub.desktop",
];

const CI_ARCHITECTURE = [".github/", "scripts/ci/"];
const NON_RUNTIME = [
  /^README(?:\.|$)/i,
  /^docs\//,
  /^\.github\/(?:ISSUE_TEMPLATE|PULL_REQUEST_TEMPLATE)/,
  /\.md$/i,
];
const GLOBAL_INFRA = [
  ".github/",
  "scripts/ci/",
  "package.json",
  "bun.lock",
  /^tsconfig(?:\..+)?\.json$/,
  /^next\.config\./,
  /^middleware\./,
  /^src\/middleware\./,
  "src/app/globals.css",
  "src/components/ui/",
  "config/performance-gates.json",
];
const STATIC_CONTENT = [
  "src/content/",
  "src/data/",
  "src/i18n/messages/",
  "src/messages/",
  "public/",
];
const FRONTEND_RUNTIME = [
  "src/app/",
  "src/components/",
  "src/i18n/",
  "src/config/",
  /^middleware\./,
  /^src\/middleware\./,
  /^next\.config\./,
];
const DATABASE_SCHEMA = [
  "drizzle/",
  /^src\/server\/db\/(?:schema|.+-schema)\.ts$/,
  "scripts/check-migration-integrity.mjs",
];
const AUTH_RUNTIME = [
  "src/server/auth/",
  /\/api\/auth\//,
  "src/lib/browser-lifecycle-cleanup",
  "scripts/navigation-context-browser-gate.mjs",
  "scripts/reading-lifecycle-final-browser-gate.mjs",
];
const PAYMENT_REFUND = [
  "src/domain/entitlements/",
  "src/server/repositories/entitlement-repository.ts",
  "src/server/payments/",
  "src/server/refunds/",
  "src/server/reconcile/",
  /\/api\/(?:payments|refunds|webhooks)\//,
  /^scripts\/(?:payment|refund|reconcile)-/,
  "src/lib/browser-lifecycle-cleanup",
  "scripts/reading-lifecycle-final-browser-gate.mjs",
];
const SECURITY = [
  "package.json",
  "bun.lock",
  /^next\.config\./,
  /^middleware\./,
  /^src\/middleware\./,
  "src/server/auth/",
  "src/server/payments/",
  "src/server/refunds/",
  "src/server/reconcile/",
  "src/server/security/",
  "src/server/capabilities.ts",
  "src/server/config.ts",
  /^scripts\/ci\/(?:dependency-audit-gate|secret-scan)\.mjs$/,
];
const DATABASE = [
  "src/server/db/",
  "src/server/generation/",
  "src/server/repositories/",
  "src/domain/entitlements/",
  "src/server/readiness/",
  "src/server/account/",
  "src/server/auth/",
  "src/server/payments/",
  "src/server/refunds/",
  "src/server/reconcile/",
  "src/app/api/",
  "drizzle/",
  "scripts/test-postgres-serial.mjs",
  "scripts/check-migration-integrity.mjs",
  /^src\/server\/.+\.integration\.test\.ts$/,
];
const READING = [
  "src/components/public-reading/",
  "src/components/reading-result/",
  "src/components/three-coin-result/",
  "src/domain/casting/",
  "src/domain/generation/",
  "src/domain/interpretation/",
  "src/domain/questions/",
  "src/domain/risk/",
  "src/domain/public-reading/",
  "src/server/generation/",
  "src/server/workflows/",
  "src/server/services/",
  "src/server/casting-guards",
  "src/server/repositories/casting-repository.ts",
  "src/server/repositories/reading-repository.ts",
  "src/server/repositories/review-repository.ts",
  "src/app/api/readings/",
  /^src\/lib\/(?:three-coin|completed-public-reading|reading-resume|reading-handoff)/,
  /\/methods\/(?:three-coin|yarrow-stalks|mei-hua-yi-shu|manual-cast)\//,
  /\/readings\/(?:result|deep)\//,
  /^scripts\/(?:reading-business-browser|manual-cast-ui-browser-gate|three-coin-v2-browser-gate|home-mobile-chrome-gate|ritual-scene-boundary-gate|mei-hua-ui-browser-gate|public-p0-browser-gate|reading-lifecycle-browser-gate)\.mjs$/,
];
const READING_LIFECYCLE = [
  "src/server/generation/",
  "src/server/workflows/",
  "src/server/repositories/reading-repository.ts",
  /^src\/lib\/(?:reading-resume|reading-handoff|browser-lifecycle-cleanup)/,
  "scripts/reading-lifecycle-browser-gate.mjs",
];

const SEO_STATIC = [
  "src/content/",
  "src/data/",
  "src/domain/interpretation/",
  "src/components/hex/",
  "src/components/hexagram-detail-page",
  "src/components/info-pages/",
  /^scripts\/hexagram-seo-(?:registry-gate|quality-audit)\.mjs$/,
  /^scripts\/interpretation-bundle-gate\.mjs$/,
];
const SEO_BROWSER = [
  "src/content/hexagrams/seo.ts",
  "src/domain/public-reading/classical.ts",
  "src/domain/interpretation/",
  "scripts/interpretation-bundle-gate.mjs",
  "src/app/",
  "src/components/hex/",
  "src/components/hexagram-detail-page",
  "src/components/info-pages/",
  "src/components/scene-navigation",
  "src/components/site-header",
  "src/components/brand-mark",
  "src/components/analytics-consent",
  "src/components/consent-gated-analytics",
  "src/components/privacy-settings-button",
  "src/components/site-analytics",
  /^next\.config\./,
  /^middleware\./,
  /^src\/middleware\./,
  /^scripts\/(?:hexagram-seo-browser-gate|chinese-seo-browser-gate|browser-gate|on-page-seo-browser-gate|logo-browser-gate)\.mjs$/,
];
const LOCALE_BROWSER = [
  "src/i18n/",
  /^src\/app\/.+\/zh(?:\/|$)/,
  /^scripts\/(?:chinese-interactive-language-gate|chinese-seo-browser-gate|multilingual-browser-gate)\.mjs$/,
];
const NAVIGATION = [
  /^src\/app\/(?:layout|not-found|global-error)\./,
  /\/layout\.tsx$/,
  "src/components/scene-navigation",
  "src/components/site-header",
  "src/navigation/",
  /^src\/i18n\/(?:routing|navigation)/,
  /^src\/(?:config\/)?routes?(?:\.|\/)/,
  /^next\.config\./,
  /^middleware\./,
  /^src\/middleware\./,
  /^scripts\/(?:scene-navigation-qa|navigation-shell-browser-gate|navigation-context-browser-gate|home-mobile-chrome-gate)\.mjs$/,
];
const ACCOUNT_INFO = [
  "src/components/account/",
  "src/components/auth/",
  "src/components/info-pages/",
  /\/account\//,
  /\/my-readings\//,
  /\/(?:guides|help|privacy|terms|acceptable-use)\//,
  "scripts/group3-visual-capture.mjs",
  "scripts/group3-visual-qa-fixture.mjs",
];
const HEXAGRAM_DETAIL = [
  /\/hexagrams\//,
  "src/components/hex/",
  "src/components/hexagram-detail-page",
  /^scripts\/hexagram-(?:detail|seo)/,
  "docs/design/hexagram-detail/",
  "public/hexagram-detail/",
];
const PERFORMANCE = [
  "src/app/",
  "src/components/",
  "src/styles/",
  "public/",
  /^next\.config\./,
  "scripts/performance-",
  "scripts/result-lighthouse-gate.mjs",
  "scripts/public-p0-lighthouse-gate.mjs",
  "config/performance-gates.json",
];
const BROAD_FRONTEND = [
  "src/app/globals.css",
  "src/components/ui/",
  /^src\/app\/(?:layout|global-error|not-found)\./,
];
const BUILD_IMPACT = [
  "src/",
  "public/",
  "package.json",
  "bun.lock",
  /^tsconfig(?:\..+)?\.json$/,
  /^next\.config\./,
  /^middleware\./,
  /^src\/middleware\./,
];

const KNOWN_SERVER = [DATABASE, READING, AUTH_RUNTIME, PAYMENT_REFUND, SECURITY];
function isUnknownCrossCuttingServerRuntime(file) {
  return file.startsWith("src/server/") && !KNOWN_SERVER.some((patterns) => any([file], patterns));
}

function classifyFile(file) {
  if (any([file], GLOBAL_INFRA)) return 7;
  if (any([file], AUTH_RUNTIME) || any([file], PAYMENT_REFUND) || any([file], SECURITY)) return 6;
  if (any([file], DATABASE_SCHEMA)) return 5;
  if (file.startsWith("src/server/") || file.startsWith("src/domain/")) return 4;
  if (any([file], NAVIGATION)) return 3;
  if (file.startsWith("src/components/")) return 2;
  if (any([file], FRONTEND_RUNTIME)) return 3;
  if (any([file], STATIC_CONTENT)) return 1;
  return 0;
}

export function shouldForceFullContext(eventName, headRef = "") {
  if (eventName && eventName !== "pull_request") return true;
  const normalizedHead = headRef.trim();
  return normalizedHead === "integration"
    || normalizedHead === "release"
    || normalizedHead.startsWith("integration/")
    || normalizedHead.startsWith("release/");
}

export function classifyChangedFiles(rawFiles, { forceFull = false } = {}) {
  const files = rawFiles.map(normalize).filter(Boolean);
  const unknownServerRuntime = files.some(isUnknownCrossCuttingServerRuntime);
  const riskClass = forceFull ? 7 : files.reduce((highest, file) => Math.max(highest, classifyFile(file)), 0);
  const ciArchitecture = any(files, CI_ARCHITECTURE);
  const onlyNonRuntime = files.length > 0 && files.every((file) => any([file], NON_RUNTIME) || any([file], CI_ARCHITECTURE));
  const runtime = forceFull || (!onlyNonRuntime && files.length > 0);
  const build = forceFull || (runtime && any(files, BUILD_IMPACT));
  const schema = forceFull || any(files, DATABASE_SCHEMA);

  const broadFrontend = any(files, BROAD_FRONTEND);
  const dependencyChange = any(files, ["package.json", "bun.lock"]);
  const tsconfigChange = any(files, [/^tsconfig(?:\..+)?\.json$/]);
  const dependencyCompilerOnly = files.length > 0 && files.every((file) =>
    file === "package.json"
    || file === "bun.lock"
    || /^tsconfig(?:\..+)?\.json$/.test(file)
  );
  const nextConfigChange = any(files, [/^next\.config\./]);

  const selected = {
    full: forceFull,
    risk_class: String(riskClass),
    high_risk: forceFull || riskClass >= 5 || unknownServerRuntime,
    runtime,
    ci_contract: forceFull || ciArchitecture,
    build,
    schema,
    database: forceFull || any(files, DATABASE),
    reading: forceFull || any(files, READING),
    reading_lifecycle: forceFull || any(files, READING_LIFECYCLE),
    seo_static: forceFull || any(files, SEO_STATIC),
    seo_browser: forceFull || any(files, SEO_BROWSER),
    locale_browser: forceFull || any(files, LOCALE_BROWSER),
    navigation: forceFull || any(files, NAVIGATION),
    auth_lifecycle: forceFull || any(files, AUTH_RUNTIME),
    account_info: forceFull || any(files, ACCOUNT_INFO),
    hexagram_detail: forceFull || any(files, HEXAGRAM_DETAIL),
    payment_refund: forceFull || any(files, PAYMENT_REFUND),
    security: forceFull || any(files, SECURITY),
    performance: forceFull || any(files, PERFORMANCE),
  };

  if (broadFrontend) {
    selected.reading = true;
    selected.seo_browser = true;
    selected.locale_browser = true;
    selected.navigation = true;
    selected.account_info = true;
    selected.hexagram_detail = true;
    selected.performance = true;
  }

  if (nextConfigChange) {
    selected.seo_browser = true;
    selected.navigation = true;
    selected.security = true;
    selected.performance = true;
  }

  if (dependencyChange) {
    selected.security = true;
  }

  if (schema) {
    selected.database = true;
    selected.auth_lifecycle = true;
    selected.payment_refund = true;
  }

  if (unknownServerRuntime) {
    selected.database = true;
    selected.reading = true;
    selected.reading_lifecycle = true;
    selected.auth_lifecycle = true;
    selected.payment_refund = true;
    selected.security = true;
  }

  if (onlyNonRuntime && !forceFull) {
    selected.database = false;
    selected.reading = false;
    selected.reading_lifecycle = false;
    selected.seo_static = false;
    selected.seo_browser = false;
    selected.locale_browser = false;
    selected.navigation = false;
    selected.auth_lifecycle = false;
    selected.account_info = false;
    selected.hexagram_detail = false;
    selected.payment_refund = false;
    selected.security = false;
    selected.performance = false;
  }

  // Dependency and compiler changes validate install/build/unit/security, but do not
  // imply that every business browser or database domain is affected.
  if (dependencyCompilerOnly && !forceFull) {
    selected.database = false;
    selected.reading = false;
    selected.reading_lifecycle = false;
    selected.seo_static = false;
    selected.seo_browser = false;
    selected.locale_browser = false;
    selected.navigation = false;
    selected.auth_lifecycle = false;
    selected.account_info = false;
    selected.hexagram_detail = false;
    selected.payment_refund = false;
    selected.performance = false;
    if (dependencyChange) selected.security = true;
  }

  // R2/R3 execute inside CI / Auth Lifecycle. Preserve that gate ownership only
  // after exclusions/resets have established the domains that are truly affected.
  if (selected.navigation || selected.reading_lifecycle) {
    selected.auth_lifecycle = true;
  }

  selected.public_seo = selected.seo_static || selected.seo_browser || selected.locale_browser;
  selected.payment = selected.payment_refund;

  const targets = new Set();
  if (forceFull || broadFrontend || nextConfigChange || any(files, ["config/performance-gates.json"])) {
    ALL_PERFORMANCE_TARGETS.forEach((target) => targets.add(target));
  } else {
    if (files.some((file) => file.startsWith("src/components/public-reading/") || file.includes("/methods/three-coin/") || file.startsWith("src/components/three-coin-result/"))) {
      targets.add("three-coin.desktop");
    }
    if (files.some((file) => file.startsWith("src/components/reading-result/") || /\/readings\/(?:result|deep)\//.test(file))) {
      targets.add("result.mobile");
      targets.add("result.desktop");
    }
    if (selected.account_info && files.some((file) => file.startsWith("src/components/account/") || file.startsWith("src/components/auth/") || /\/(?:account|my-readings)\//.test(file))) {
      targets.add("account.desktop");
    }
    if (selected.account_info && files.some((file) => file.startsWith("src/components/info-pages/") || /\/(?:guides|help|privacy|terms|acceptable-use)\//.test(file))) {
      targets.add("info.desktop");
    }
    if (selected.hexagram_detail) targets.add("hexagram-hub.desktop");
    if (files.some((file) => /^src\/app\/(?:\(default\)\/)?page\.tsx$/.test(file) || file.startsWith("src/components/analytics-consent") || file.startsWith("src/components/site-analytics"))) {
      targets.add("home.mobile");
      targets.add("home.desktop");
    }
    if (files.some((file) => file.startsWith("public/") || file.startsWith("src/styles/"))) {
      ALL_PERFORMANCE_TARGETS.forEach((target) => targets.add(target));
    }
  }

  selected.performance_targets = JSON.stringify([...targets]);
  if (!forceFull && targets.size === 0) selected.performance = false;
  return selected;
}

function emit(result) {
  const lines = Object.entries(result).map(([key, value]) => key + "=" + (typeof value === "boolean" ? String(value) : value));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, lines.join("\n") + "\n");
  else process.stdout.write(lines.join("\n") + "\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const files = Buffer.concat(chunks).toString("utf8").split(/\r?\n/);
  emit(classifyChangedFiles(files, {
    forceFull: process.env.CI_FORCE_FULL === "1"
      || shouldForceFullContext(process.env.CI_EVENT_NAME ?? "", process.env.CI_HEAD_REF ?? ""),
  }));
}
