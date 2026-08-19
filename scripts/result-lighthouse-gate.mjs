import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { resolveChromeExecutable } from "./browser-runtime.mjs";
import { desktopConfig, navigation } from "lighthouse";

const BASE = process.env.PUBLIC_V1_TEST_BASE_URL || "http://127.0.0.1:3000";
const STORAGE_KEY = "quickiching:public-v1:three-coin";
const RESULT_URL = `${BASE}/readings/three-coin/result`;
const FIXTURE_STEPS = [
  { lineIndex: 0, coinFaces: ["yang", "yang", "yang"], lineValue: 9, algorithmVersion: "three-coin-v1" },
  { lineIndex: 1, coinFaces: ["yin", "yin", "yin"], lineValue: 6, algorithmVersion: "three-coin-v1" },
  { lineIndex: 2, coinFaces: ["yang", "yin", "yin"], lineValue: 7, algorithmVersion: "three-coin-v1" },
  { lineIndex: 3, coinFaces: ["yang", "yang", "yang"], lineValue: 9, algorithmVersion: "three-coin-v1" },
  { lineIndex: 4, coinFaces: ["yang", "yin", "yin"], lineValue: 7, algorithmVersion: "three-coin-v1" },
  { lineIndex: 5, coinFaces: ["yang", "yin", "yin"], lineValue: 7, algorithmVersion: "three-coin-v1" },
];

function log(message) {
  console.log(`[Result Lighthouse Gate] ${message}`);
}

function summarize(label, runnerResult) {
  assert(runnerResult?.lhr, `${label}: Lighthouse returned no result`);
  const report = runnerResult.lhr;
  assert(!report.runtimeError, `${label}: Lighthouse runtime error: ${report.runtimeError?.message ?? "unknown"}`);
  const performance = Math.round((report.categories.performance?.score ?? 0) * 100);
  const accessibility = Math.round((report.categories.accessibility?.score ?? 0) * 100);
  const seo = Math.round((report.categories.seo?.score ?? 0) * 100);
  const lcp = Math.round(report.audits["largest-contentful-paint"].numericValue ?? 0);
  const cls = Number(report.audits["cumulative-layout-shift"].numericValue ?? 0);
  const tbt = Math.round(report.audits["total-blocking-time"].numericValue ?? 0);
  log(`${label} performance=${performance} accessibility=${accessibility} seo=${seo} LCP_ms=${lcp} CLS=${cls.toFixed(4)} TBT_ms=${tbt}`);

  assert(accessibility >= 90, `${label}: accessibility score below 90`);
  assert(cls <= 0.1, `${label}: CLS exceeds 0.10`);
  assert(performance >= 65 && lcp <= 4000, `${label}: severe performance regression`);
  // The product result is intentionally noindex. Its SEO category is recorded but not used as an indexing gate.
  return { performance, accessibility, seo, lcp, cls, tbt };
}

async function seedReading(page) {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0", timeout: 30_000 });
  await page.evaluate(({ key, steps }) => sessionStorage.setItem(key, JSON.stringify(steps)), {
    key: STORAGE_KEY,
    steps: FIXTURE_STEPS,
  });
}

async function auditResult(browser, desktop) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  try {
    await page.setViewport(desktop
      ? { width: 1350, height: 940, deviceScaleFactor: 1 }
      : { width: 412, height: 915, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
    await seedReading(page);
    const runnerResult = await navigation(page, RESULT_URL, {
      config: desktop ? desktopConfig : undefined,
      flags: {
        logLevel: "error",
        onlyCategories: ["performance", "accessibility", "seo"],
        disableStorageReset: true,
      },
    });
    await page.waitForFunction(() => document.body?.innerText.includes("Bottom Line"), { timeout: 15_000 });
    const visible = await page.evaluate(() => document.body?.innerText.includes("Fellowship") && document.body?.innerText.includes("Gentle penetration"));
    assert(visible, `${desktop ? "desktop" : "mobile"}: Lighthouse audited an empty/incorrect result state`);
    return summarize(desktop ? "RESULT_DESKTOP" : "RESULT_MOBILE", runnerResult);
  } finally {
    await context.close();
  }
}

const { executablePath, usingSystemChrome } = await resolveChromeExecutable(chromium);
const browser = await puppeteer.launch({
  args: usingSystemChrome ? ["--no-sandbox", "--disable-dev-shm-usage"] : [...chromium.args, "--disable-dev-shm-usage"],
  executablePath,
  headless: true,
});
try {
  await auditResult(browser, false);
  await auditResult(browser, true);
  log("POPULATED RESULT MOBILE + DESKTOP LIGHTHOUSE PASS");
} finally {
  await browser.close();
}
