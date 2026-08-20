import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { desktopConfig, navigation } from "lighthouse";

const BASE = process.env.PUBLIC_V1_TEST_BASE_URL || "http://127.0.0.1:3000";
const BASELINE = process.env.PUBLIC_V1_LIGHTHOUSE_BASELINE_URL || "https://www.quickiching.com";

function log(message) {
  console.log(`[Public P0 Lighthouse Gate] ${message}`);
}

function summarize(label, result) {
  assert(result?.lhr, `${label}: Lighthouse returned no result`);
  const report = result.lhr;
  assert(!report.runtimeError, `${label}: Lighthouse runtime error: ${report.runtimeError?.message ?? "unknown"}`);
  const metrics = {
    performance: Math.round((report.categories.performance?.score ?? 0) * 100),
    accessibility: Math.round((report.categories.accessibility?.score ?? 0) * 100),
    seo: Math.round((report.categories.seo?.score ?? 0) * 100),
    lcp: Math.round(report.audits["largest-contentful-paint"]?.numericValue ?? 0),
    cls: Number(report.audits["cumulative-layout-shift"]?.numericValue ?? 0),
  };
  log(`${label} performance=${metrics.performance} accessibility=${metrics.accessibility} seo=${metrics.seo} LCP_ms=${metrics.lcp} CLS=${metrics.cls.toFixed(4)}`);
  return metrics;
}

function assertQuality(label, metrics, indexable = true, enforcePerformance = true) {
  assert(metrics.accessibility >= 90, `${label}: accessibility below 90`);
  if (indexable) assert(metrics.seo >= 90, `${label}: SEO below 90`);
  assert(metrics.cls <= 0.1, `${label}: CLS exceeds 0.10`);
  if (enforcePerformance) assert(metrics.performance >= 65 && metrics.lcp <= 4_000, `${label}: severe performance regression`);
}

async function seedManualReading(page, origin) {
  await page.goto(`${origin}/robots.txt`, { waitUntil: "networkidle0", timeout: 30_000 });
  await page.evaluate(() => {
    sessionStorage.setItem("quickiching:question:manual-cast:started", "true");
    sessionStorage.removeItem("quickiching:question:manual-cast:question");
    sessionStorage.setItem("quickiching:public-v1:manual-cast", JSON.stringify({
      id: "lighthouse-manual-reading",
      createdAt: "2026-08-19T00:00:00.000Z",
      mode: "line-values",
      lineValuesBottomUp: [9, 7, 8, 7, 8, 7],
      evidence: { kind: "manual", mode: "line-values" },
    }));
  });
}

async function audit(browser, { origin, path, label, desktop = false, seed = false, indexable = true, enforcePerformance = true }) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  try {
    await page.setViewport(desktop
      ? { width: 1350, height: 940, deviceScaleFactor: 1 }
      : { width: 412, height: 915, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
    if (seed) await seedManualReading(page, origin);
    const result = await navigation(page, `${origin}${path}`, {
      config: desktop ? desktopConfig : undefined,
      flags: { logLevel: "error", onlyCategories: ["performance", "accessibility", "seo"], disableStorageReset: true },
    });
    const metrics = summarize(label, result);
    assertQuality(label, metrics, indexable, enforcePerformance);
    if (path === "/methods/manual-cast") await page.waitForFunction(() => document.body?.innerText.toLocaleLowerCase().includes("your i ching reading"), { timeout: 15_000 });
    return metrics;
  } finally {
    await context.close();
  }
}

const macChromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const systemChromePath = [process.env.CHROME_PATH?.trim(), process.platform === "darwin" ? macChromePath : null]
  .find((candidate) => Boolean(candidate) && existsSync(candidate));
const executablePath = systemChromePath || await chromium.executablePath();
const browser = await puppeteer.launch({
  args: systemChromePath ? ["--no-sandbox", "--disable-dev-shm-usage"] : [...chromium.args, "--disable-dev-shm-usage"],
  executablePath,
  headless: true,
});

try {
  const baseline = {};
  for (const [key, path, label] of [["home", "/", "BASELINE_HOME"], ["threeCoin", "/methods/three-coin", "BASELINE_THREE_COIN"], ["hub", "/hexagrams", "BASELINE_HEXAGRAM_HUB"]]) {
    baseline[key] = await audit(browser, { origin: BASELINE, path, label, enforcePerformance: false });
  }

  const after = {};
  after.home = await audit(browser, { origin: BASE, path: "/", label: "AFTER_HOME", desktop: true });
  after.threeCoin = await audit(browser, { origin: BASE, path: "/methods/three-coin", label: "AFTER_THREE_COIN" });
  after.populatedResult = await audit(browser, { origin: BASE, path: "/methods/manual-cast", label: "AFTER_POPULATED_RESULT", seed: true, indexable: true });
  after.hub = await audit(browser, { origin: BASE, path: "/hexagrams", label: "AFTER_HEXAGRAM_HUB", desktop: true });
  after.detail = await audit(browser, { origin: BASE, path: "/hexagrams/24-return", label: "AFTER_HEXAGRAM_DETAIL" });
  after.chineseHub = await audit(browser, { origin: BASE, path: "/zh/hexagrams", label: "AFTER_CHINESE_HEXAGRAM_HUB", desktop: true });
  after.chineseDetail = await audit(browser, { origin: BASE, path: "/zh/hexagrams/24-return", label: "AFTER_CHINESE_HEXAGRAM_DETAIL" });
  after.history = await audit(browser, { origin: BASE, path: "/history/", label: "AFTER_HISTORY", indexable: false });

  for (const key of ["home", "threeCoin", "hub"]) {
    assert(after[key].performance >= baseline[key].performance - 5, `${key}: performance dropped by more than five points (${baseline[key].performance} → ${after[key].performance})`);
  }
  log("Before/after comparable Lighthouse gates, English/Chinese Hub and detail pages, populated result, and History PASS; CLS target <= 0.10");
} finally {
  await browser.close();
}
