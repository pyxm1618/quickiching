import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const normalize = (value) => value.replaceAll("\\", "/").replace(/^\.\//, "");
const any = (files, patterns) => files.some((file) => patterns.some((pattern) =>
  typeof pattern === "string" ? file.startsWith(pattern) : pattern.test(file)
));

export const FULL_PATTERNS = [
  ".github/",
  "package.json",
  "bun.lock",
  /^next\.config\./,
  /^tsconfig(?:\..+)?\.json$/,
  /^middleware\./,
  /^src\/middleware\./,
  /^src\/(?:config\/)?routes?(?:\.|\/)/,
  /^src\/i18n\/(?:routing|navigation)/,
  "src/app/globals.css",
  /\/layout\.tsx$/,
  "src/components/ui/",
  "src/server/config.ts",
  "src/server/capabilities.ts",
  "src/server/loaders.ts",
  "src/server/repository.ts",
  "src/domain/public-reading/",
  /^src\/lib\/completed-public-reading/,
  "src/server/auth/",
  /^src\/server\/db\/(?:schema|.+-schema)\.ts$/,
  "drizzle/",
  "scripts/ci/",
  "scripts/check-migration-integrity.mjs",
  "scripts/test-postgres-serial.mjs",
  "scripts/browser-runtime.mjs",
  "scripts/performance-",
  "scripts/result-lighthouse-gate.mjs",
  "config/performance-gates.json",
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
  /^src\/server\/.+\.integration\.test\.ts$/,
  "drizzle/",
  "scripts/test-postgres-serial.mjs",
  "scripts/check-migration-integrity.mjs",
];

const READING = [
  "src/components/public-reading/",
  "src/components/reading-result/",
  "src/components/three-coin-result/",
  "src/components/hex/",
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
  /^src\/lib\/(?:three-coin|completed-public-reading)/,
  /\/methods\/(?:three-coin|yarrow-stalks|mei-hua-yi-shu|manual-cast)\//,
  /\/readings\/(?:result|deep)\//,
  "scripts/reading-business-browser.mjs",
  "scripts/three-coin-v2-browser-gate.mjs",
  "scripts/mei-hua-ui-browser-gate.mjs",
  "scripts/public-p0-browser-gate.mjs",
  "scripts/ritual-scene-boundary-gate.mjs",
  "scripts/ritual-motion-gate.mjs",
  "scripts/ritual-qa-fixture.mjs",
];

const PUBLIC_SEO = [
  "src/app/",
  "src/i18n/",
  "src/config/",
  "src/domain/interpretation/",
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
  "scripts/hexagram-detail-ui-browser.mjs",
  "docs/design/hexagram-detail/",
  "public/",
  /^scripts\/(?:.*seo.*|browser-gate|multilingual-browser-gate|scene-navigation-qa|logo-browser-gate|interpretation-bundle-gate)\./,
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

const PAYMENT = [
  "src/domain/entitlements/",
  "src/server/repositories/entitlement-repository.ts",
  "src/server/payments/",
  "src/server/refunds/",
  "src/server/reconcile/",
  /\/api\/(?:payments|refunds|webhooks)\//,
  /^scripts\/payment-/,
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
  "next.config.",
  "scripts/performance-",
  "scripts/result-lighthouse-gate.mjs",
  "scripts/public-p0-lighthouse-gate.mjs",
  "config/performance-gates.json",
];

const ALL_PERFORMANCE_TARGETS = [
  "home.mobile",
  "home.desktop",
  "three-coin.desktop",
  "result.mobile",
  "result.desktop",
  "info.desktop",
  "account.desktop",
  "hexagram-hub.desktop",
  "hexagram-detail.mobile",
];

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
  const full = forceFull || any(files, FULL_PATTERNS);

  const selected = {
    full,
    database: full || any(files, DATABASE),
    reading: full || any(files, READING),
    public_seo: full || any(files, PUBLIC_SEO),
    account_info: full || any(files, ACCOUNT_INFO),
    payment: full || any(files, PAYMENT),
    hexagram_detail: full || any(files, HEXAGRAM_DETAIL),
    performance: full || any(files, PERFORMANCE),
  };

  const targets = new Set();
  if (full) {
    ALL_PERFORMANCE_TARGETS.forEach((target) => targets.add(target));
  } else {
    if (selected.reading) {
      targets.add("three-coin.desktop");
      targets.add("result.mobile");
      targets.add("result.desktop");
    }
    if (selected.public_seo) {
      targets.add("home.mobile");
      targets.add("home.desktop");
    }
    if (selected.hexagram_detail) {
      targets.add("hexagram-hub.desktop");
      targets.add("hexagram-detail.mobile");
    }
    if (selected.account_info) {
      if (files.some((file) => /\/(?:guides|help|privacy|terms|acceptable-use)\//.test(file) || file.startsWith("src/components/info-pages/"))) targets.add("info.desktop");
      if (files.some((file) => file.startsWith("src/components/account/") || file.startsWith("src/components/auth/") || /\/(?:account|my-readings)\//.test(file))) targets.add("account.desktop");
    }
  }

  selected.performance_targets = JSON.stringify([...targets]);
  return selected;
}

function emit(result) {
  const lines = Object.entries(result).map(([key, value]) => `${key}=${typeof value === "boolean" ? String(value) : value}`);
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
