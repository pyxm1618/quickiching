import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DOMAIN_KEYS = [
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

export function evaluateRequiredGate(input) {
  const failed = [];
  if (input.select !== "success") failed.push("select");
  if (input.fast !== "success") failed.push("fast");

  for (const [resultKey, selectedKey] of DOMAIN_KEYS) {
    const result = input[resultKey];
    if (input[selectedKey]) {
      if (result !== "success") failed.push(resultKey);
    } else if (!["success", "skipped"].includes(result)) {
      failed.push(resultKey);
    }
  }

  return { ok: failed.length === 0, failed };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const bool = (value) => value === "true";
  const result = evaluateRequiredGate({
    select: process.env.SELECT_RESULT,
    fast: process.env.FAST_RESULT,
    build: process.env.BUILD_RESULT,
    schema: process.env.SCHEMA_RESULT,
    database: process.env.DATABASE_RESULT,
    reading: process.env.READING_RESULT,
    reading_lifecycle: process.env.READING_LIFECYCLE_RESULT,
    seo_static: process.env.SEO_STATIC_RESULT,
    seo_browser: process.env.SEO_BROWSER_RESULT,
    locale_browser: process.env.LOCALE_BROWSER_RESULT,
    navigation: process.env.NAVIGATION_RESULT,
    auth_lifecycle: process.env.AUTH_LIFECYCLE_RESULT,
    account_info: process.env.ACCOUNT_INFO_RESULT,
    hexagram: process.env.HEXAGRAM_RESULT,
    security: process.env.SECURITY_RESULT,
    payment_refund: process.env.PAYMENT_REFUND_RESULT,
    performance: process.env.PERFORMANCE_RESULT,
    buildSelected: bool(process.env.BUILD_SELECTED),
    schemaSelected: bool(process.env.SCHEMA_SELECTED),
    databaseSelected: bool(process.env.DATABASE_SELECTED),
    readingSelected: bool(process.env.READING_SELECTED),
    readingLifecycleSelected: bool(process.env.READING_LIFECYCLE_SELECTED),
    seoStaticSelected: bool(process.env.SEO_STATIC_SELECTED),
    seoBrowserSelected: bool(process.env.SEO_BROWSER_SELECTED),
    localeBrowserSelected: bool(process.env.LOCALE_BROWSER_SELECTED),
    navigationSelected: bool(process.env.NAVIGATION_SELECTED),
    authLifecycleSelected: bool(process.env.AUTH_LIFECYCLE_SELECTED),
    accountInfoSelected: bool(process.env.ACCOUNT_INFO_SELECTED),
    hexagramSelected: bool(process.env.HEXAGRAM_SELECTED),
    securitySelected: bool(process.env.SECURITY_SELECTED),
    paymentRefundSelected: bool(process.env.PAYMENT_REFUND_SELECTED),
    performanceSelected: bool(process.env.PERFORMANCE_SELECTED),
  });
  console.log(JSON.stringify(result));
  if (!result.ok) process.exitCode = 1;
}
