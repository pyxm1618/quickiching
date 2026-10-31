import { assertPerformanceBudget, metricsFromReport } from "./performance-budget.mjs";
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { resolveChromeExecutable } from "./browser-runtime.mjs";
import { desktopConfig, navigation } from "lighthouse";

const BASE = process.env.PUBLIC_V1_TEST_BASE_URL || "http://127.0.0.1:3000";
const STORAGE_KEY = "quickiching:public-v1:three-coin";
const RESULT_URL = `${BASE}/readings/result`;
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

function diagnosticNode(node) {
  if (!node || typeof node !== "object") return null;
  return {
    selector: node.selector ?? null,
    snippet: node.snippet ?? null,
    nodeLabel: node.nodeLabel ?? null,
    path: node.path ?? null,
  };
}

function logMobileDiagnostics(report) {
  const auditIds = Object.keys(report.audits).filter((id) =>
    /(largest-contentful-paint|\blcp\b|render-blocking|font|network-requests|mainthread-work-breakdown|bootup-time|long-tasks|unused-javascript)/i.test(id),
  );
  log(`RESULT_MOBILE_DIAGNOSTIC_AUDITS ${JSON.stringify(auditIds)}`);

  for (const id of auditIds) {
    const audit = report.audits[id];
    if (!audit) continue;

    if (id === "lcp-breakdown-insight") {
      log(`RESULT_MOBILE_LCP_BREAKDOWN_RAW ${JSON.stringify(audit.details)}`);
    }

    if (id === "network-requests") {
      const items = Array.isArray(audit.details?.items) ? audit.details.items : [];
      const relevant = items
        .filter((item) => ["Font", "Script", "Stylesheet", "Document", "Image"].includes(item.resourceType))
        .map((item) => ({
          url: item.url,
          resourceType: item.resourceType,
          transferSize: item.transferSize,
          resourceSize: item.resourceSize,
          startTime: item.startTime,
          endTime: item.endTime,
          duration: item.endTime != null && item.startTime != null ? item.endTime - item.startTime : null,
          priority: item.priority ?? null,
        }));
      log(`RESULT_MOBILE_DIAGNOSTIC network-requests ${JSON.stringify(relevant)}`);
      continue;
    }

    const items = Array.isArray(audit.details?.items) ? audit.details.items : [];
    const compactItems = items.slice(0, 30).map((item) => {
      const result = {};
      for (const key of [
        "phase", "timing", "duration", "wastedMs", "totalBytes", "wastedBytes",
        "url", "resourceType", "transferSize", "resourceSize", "startTime", "endTime",
        "mainThreadTime", "scriptParseCompile", "scriptEvaluation", "group", "groupLabel",
      ]) {
        if (item?.[key] !== undefined) result[key] = item[key];
      }
      if (item?.node) result.node = diagnosticNode(item.node);
      if (item?.items && Array.isArray(item.items)) {
        result.items = item.items.slice(0, 20).map((nested) => ({
          ...Object.fromEntries(Object.entries(nested).filter(([key]) =>
            ["phase", "timing", "duration", "url", "resourceType", "transferSize", "resourceSize", "startTime", "endTime"].includes(key),
          )),
          ...(nested?.node ? { node: diagnosticNode(nested.node) } : {}),
        }));
      }
      return Object.keys(result).length ? result : item;
    });

    log(`RESULT_MOBILE_DIAGNOSTIC ${id} ${JSON.stringify({
      title: audit.title,
      score: audit.score,
      numericValue: audit.numericValue,
      numericUnit: audit.numericUnit,
      displayValue: audit.displayValue,
      detailsType: audit.details?.type ?? null,
      items: compactItems,
    })}`);
  }
}

async function logPageFontDiagnostics(page) {
  const diagnostics = await page.evaluate(() => {
    const fontFaces = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      if (!rules) continue;
      for (const rule of Array.from(rules)) {
        if (!(rule instanceof CSSFontFaceRule)) continue;
        fontFaces.push({
          family: rule.style.getPropertyValue("font-family"),
          src: rule.style.getPropertyValue("src"),
          weight: rule.style.getPropertyValue("font-weight"),
          style: rule.style.getPropertyValue("font-style"),
          unicodeRange: rule.style.getPropertyValue("unicode-range"),
        });
      }
    }

    const fontResources = performance.getEntriesByType("resource")
      .filter((entry) => entry.name.includes("/_next/static/media/") && /\.woff2(?:\?|$)/.test(entry.name))
      .map((entry) => ({
        url: entry.name,
        transferSize: entry.transferSize,
        decodedBodySize: entry.decodedBodySize,
        duration: entry.duration,
      }));

    const lcpNode = document.querySelector("#commercial-deep-section");
    const lcpStyle = lcpNode ? getComputedStyle(lcpNode) : null;

    return {
      lcpComputedStyle: lcpStyle ? {
        fontFamily: lcpStyle.fontFamily,
        fontSize: lcpStyle.fontSize,
        fontWeight: lcpStyle.fontWeight,
      } : null,
      loadedFonts: Array.from(document.fonts).map((font) => ({
        family: font.family,
        weight: font.weight,
        style: font.style,
        status: font.status,
      })),
      fontResources,
      fontFaces,
    };
  });

  const mapped = diagnostics.fontResources.map((resource) => {
    const filename = resource.url.split("/").pop()?.split("?")[0] ?? "";
    const faces = diagnostics.fontFaces.filter((face) => face.src.includes(filename));
    return { ...resource, faces };
  });
  log(`RESULT_MOBILE_FONT_MAP ${JSON.stringify({
    lcpComputedStyle: diagnostics.lcpComputedStyle,
    resources: mapped,
  })}`);
}

function summarize(label, runnerResult) {
  assert(runnerResult?.lhr, `${label}: Lighthouse returned no result`);
  const report = runnerResult.lhr;
  if (label === "RESULT_MOBILE") logMobileDiagnostics(report);
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
  log(`${label}_BUDGET_METRICS ${JSON.stringify(metricsFromReport(report))}`);
  assertPerformanceBudget(label, metricsFromReport(report), label === "RESULT_DESKTOP");
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
    await page.waitForSelector("[data-shared-reading-summary]", { timeout: 15_000 });
    const visible = await page.evaluate(() => ({
      sixLines: document.querySelectorAll("[data-summary-primary] [data-line-position]").length === 6,
      authGate: Boolean(document.querySelector("[data-auth-required-before-reveal]")),
      summary: Boolean(document.querySelector("[data-shared-reading-summary]")),
      contentClosed: document.querySelector(".shared-reading-content")?.hidden,
    }));
    assert(visible.sixLines && visible.summary && visible.contentClosed, "Lighthouse must audit the anonymous cast summary with reading content closed");
    assert.equal(visible.authGate, false, "No sign-in wall before basic results");
    if (!desktop) await logPageFontDiagnostics(page);
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
  log("ANONYMOUS CAST SUMMARY MOBILE + DESKTOP LIGHTHOUSE PASS");
} finally {
  await browser.close();
}
