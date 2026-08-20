import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { resolveChromeExecutable } from "./browser-runtime.mjs";

const BASE = process.env.PUBLIC_V1_TEST_BASE_URL || "http://127.0.0.1:3000";
const STORAGE_KEY = "quickiching:public-v1:three-coin";
const RESULT_PATH = "/readings/three-coin/result";
const HOME_TITLE = "I Ching Online — Free Hexagram Reading | Quick I Ching";
const HOME_DESCRIPTION = "Use the I Ching online with three coins, yarrow stalks, or Mei Hua Yi Shu. Cast your hexagram, see changing lines, and get a free basic interpretation.";
const NOT_FOUND_TITLE = "Page Not Found | Quick I Ching";
const FIXTURE_STEPS = [
  { lineIndex: 0, coinFaces: ["yang", "yang", "yang"], lineValue: 9, algorithmVersion: "three-coin-v1" },
  { lineIndex: 1, coinFaces: ["yin", "yin", "yin"], lineValue: 6, algorithmVersion: "three-coin-v1" },
  { lineIndex: 2, coinFaces: ["yang", "yin", "yin"], lineValue: 7, algorithmVersion: "three-coin-v1" },
  { lineIndex: 3, coinFaces: ["yang", "yang", "yang"], lineValue: 9, algorithmVersion: "three-coin-v1" },
  { lineIndex: 4, coinFaces: ["yang", "yin", "yin"], lineValue: 7, algorithmVersion: "three-coin-v1" },
  { lineIndex: 5, coinFaces: ["yang", "yin", "yin"], lineValue: 7, algorithmVersion: "three-coin-v1" },
];

function log(message) {
  console.log(`[Three-Coin V2 Browser Gate] ${message}`);
}

function metadataContents(html, name) {
  const values = [];
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const metaName = /\bname=["']([^"']+)["']/i.exec(tag)?.[1];
    if (metaName?.toLowerCase() !== name.toLowerCase()) continue;
    values.push(/\bcontent=["']([^"']*)["']/i.exec(tag)?.[1] ?? "");
  }
  return values;
}

function propertyContents(html, property) {
  const values = [];
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const metaProperty = /\bproperty=["']([^"']+)["']/i.exec(tag)?.[1];
    if (metaProperty?.toLowerCase() !== property.toLowerCase()) continue;
    values.push(/\bcontent=["']([^"']*)["']/i.exec(tag)?.[1] ?? "");
  }
  return values;
}

function titleValues(html) {
  return [...html.matchAll(/<title>([^<]*)<\/title>/gi)].map((match) => match[1]);
}

function canonicalValues(html) {
  const values = [];
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = /\brel=["']([^"']+)["']/i.exec(tag)?.[1] ?? "";
    if (!rel.split(/\s+/).some((value) => value.toLowerCase() === "canonical")) continue;
    values.push(/\bhref=["']([^"']*)["']/i.exec(tag)?.[1] ?? "");
  }
  return values;
}

async function verifySeoAnd404() {
  const resultResponse = await fetch(`${BASE}${RESULT_PATH}`);
  assert.equal(resultResponse.status, 200, "Three-Coin result route must be HTTP 200");
  const resultHtml = await resultResponse.text();
  const resultRobots = metadataContents(resultHtml, "robots");
  assert.equal(resultRobots.length, 1, `Result page must emit one robots meta, received ${resultRobots.length}`);
  assert(/\bnoindex\b/i.test(resultRobots[0]), "Result page must be noindex");
  assert(/\bfollow\b/i.test(resultRobots[0]) && !/\bnofollow\b/i.test(resultRobots[0]), "Result page must be follow");
  assert.deepEqual(canonicalValues(resultHtml), [], "Result page must not emit a canonical URL");
  assert(!resultHtml.includes(HOME_TITLE), "Result page must not inherit homepage title");
  assert(!resultHtml.includes(HOME_DESCRIPTION), "Result page must not inherit homepage description");

  const missingResponse = await fetch(`${BASE}/this-page-must-not-exist`);
  assert.equal(missingResponse.status, 404, "Random missing URL must remain HTTP 404");
  const missingHtml = await missingResponse.text();
  assert.deepEqual(titleValues(missingHtml), [NOT_FOUND_TITLE], "404 must emit exactly one explicit 404 title");
  const missingRobots = metadataContents(missingHtml, "robots");
  assert(missingRobots.length >= 1, `404 must emit a robots meta, received ${missingRobots.length}`);
  assert(missingRobots.every((value) => /\bnoindex\b/i.test(value)), "404 must be noindex");
  assert(missingRobots.every((value) => !/(^|[,\s])index([,\s]|$)/i.test(value.replace(/noindex/gi, ""))), "404 must not emit index");
  assert(!missingHtml.includes(HOME_TITLE), "404 must not inherit homepage title");
  assert(!missingHtml.includes(HOME_DESCRIPTION), "404 must not inherit homepage description");
  assert.deepEqual(canonicalValues(missingHtml), [], "404 must not emit homepage canonical");
  assert(!propertyContents(missingHtml, "og:title").includes(HOME_TITLE), "404 must not inherit homepage OG title");
  assert(!propertyContents(missingHtml, "og:description").includes(HOME_DESCRIPTION), "404 must not inherit homepage OG description");
  assert(!propertyContents(missingHtml, "og:url").includes("https://www.quickiching.com"), "404 must not inherit homepage OG URL");
  log("Result SEO + clean 404 metadata PASS");
}

async function waitForText(page, text, timeout = 15_000) {
  await page.waitForFunction((value) => document.body?.innerText.toLocaleLowerCase().includes(value.toLocaleLowerCase()), { timeout }, text);
}

async function clickButton(page, label) {
  const clicked = await page.evaluate((wanted) => {
    const button = [...document.querySelectorAll("button")].find((node) => node.textContent?.trim() === wanted);
    if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
    button.click();
    return true;
  }, label);
  assert(clicked, `Unable to click enabled button: ${label}`);
}

async function seedCompletedReading(page) {
  // Seed on a same-origin non-app document first so the homepage's initial mount reads the
  // completed session. Seeding after the homepage mounts would leave its React state at 0/6,
  // and Back/Forward cache restoration would test an artificial state that users cannot create.
  await page.goto(`${BASE}/robots.txt`, { waitUntil: "networkidle0", timeout: 30_000 });
  await page.evaluate(({ key, steps }) => sessionStorage.setItem(key, JSON.stringify(steps)), {
    key: STORAGE_KEY,
    steps: FIXTURE_STEPS,
  });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0", timeout: 30_000 });
  await clickButton(page, "Skip for now");
  await waitForText(page, "Ask · editable before the result");
  await waitForText(page, "6 / 6 lines");

  const completedState = await page.evaluate(() => ({
    anchorCount: document.querySelectorAll("#three-coin-reading").length,
    sidebarResetCount: [...document.querySelectorAll(".ritual-sidebar button")].filter((node) => node.textContent?.trim() === "New reading").length,
    hasReveal: [...document.querySelectorAll("a")].some((node) => node.textContent?.trim() === "Reveal Your Reading"),
  }));
  assert.equal(completedState.anchorCount, 1, "Homepage must contain exactly one #three-coin-reading anchor");
  assert.equal(completedState.sidebarResetCount, 0, "Completed Three-Coin chamber must not expose the sidebar destructive New reading control");
  assert(completedState.hasReveal, "Completed Three-Coin chamber must expose Reveal Your Reading");
}

async function assertNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  assert(dimensions.scrollWidth <= dimensions.clientWidth + 1, `Horizontal overflow: ${dimensions.scrollWidth} > ${dimensions.clientWidth}`);
}

async function resultText(page) {
  return page.$eval("main", (node) => node.textContent ?? "");
}

async function verifyInvalidResult(browser) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  try {
    const response = await page.goto(`${BASE}${RESULT_PATH}`, { waitUntil: "networkidle0", timeout: 30_000 });
    assert.equal(response?.status(), 200, "Product result route should remain HTTP 200 even without a completed browser reading");
    await waitForText(page, "No completed reading found");
    await waitForText(page, "Complete a six-line Three-Coin reading before opening a result.");
    const body = await resultText(page);
    assert(!body.includes("Fellowship"), "Invalid result state must not manufacture a reading");
    const href = await page.$eval('a[href="/#three-coin-reading"]', (node) => node.getAttribute("href"));
    assert.equal(href, "/#three-coin-reading");
    log("Invalid direct result URL PASS");
  } finally {
    await context.close();
  }
}

async function verifyStorageReadFailure(browser) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.evaluateOnNewDocument((key) => {
    const originalGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function getItem(itemKey) {
      if (itemKey === key) throw new DOMException("Storage blocked", "SecurityError");
      return originalGetItem.call(this, itemKey);
    };
  }, STORAGE_KEY);
  try {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle0", timeout: 30_000 });
    await clickButton(page, "Skip for now");
  await waitForText(page, "Ask · editable before the result");
    await waitForText(page, "THREE_COIN_SESSION_READ_FAILED");
    const state = await page.evaluate(() => ({
      anchorCount: document.querySelectorAll("#three-coin-reading").length,
      castDisabled: [...document.querySelectorAll("button")].some((node) => node.textContent?.trim() === "Toss three coins" && node.disabled),
      revealCount: [...document.querySelectorAll("a")].filter((node) => node.textContent?.trim() === "Reveal Your Reading").length,
    }));
    assert.equal(state.anchorCount, 1, "Storage failure state must retain one Three-Coin anchor");
    assert(state.castDisabled, "Three-Coin cast control must be disabled when browser storage cannot be read");
    assert.equal(state.revealCount, 0, "Storage read failure must never expose Reveal Your Reading");
    log("sessionStorage getItem fail-fast PASS");
  } finally {
    await context.close();
  }
}

async function verifyStorageWriteFailureRetry(browser) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.evaluateOnNewDocument((key) => {
    const originalSetItem = Storage.prototype.setItem;
    Object.defineProperty(window, "__restoreThreeCoinSetItem", {
      configurable: true,
      value: () => { Storage.prototype.setItem = originalSetItem; },
    });
    Storage.prototype.setItem = function setItem(itemKey, value) {
      if (itemKey === key) throw new DOMException("Storage blocked", "QuotaExceededError");
      return originalSetItem.call(this, itemKey, value);
    };
  }, STORAGE_KEY);
  try {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle0", timeout: 30_000 });
    await clickButton(page, "Skip for now");
  await waitForText(page, "Ask · editable before the result");
    await waitForText(page, "0 / 6 lines");
    await clickButton(page, "Toss three coins");
    await waitForText(page, "THREE_COIN_SESSION_WRITE_FAILED");
    await waitForText(page, "Retry saving this cast");

    const failedState = await page.evaluate((key) => {
      const errorBox = document.querySelector("[data-three-coin-storage-error]");
      const match = errorBox?.textContent?.match(/Line 1 was cast as ([6789])/);
      const raw = sessionStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : null;
      return {
        castValue: match ? Number(match[1]) : null,
        progress: document.body?.innerText.includes("0 / 6 lines"),
        storedSteps: Array.isArray(parsed) ? parsed : parsed?.data?.steps ?? null,
        revealCount: [...document.querySelectorAll("a")].filter((node) => node.textContent?.trim() === "Reveal Your Reading").length,
      };
    }, STORAGE_KEY);
    assert([6, 7, 8, 9].includes(failedState.castValue), "Failed write state must retain the authoritative cast value in memory");
    assert(failedState.progress, "Failed write must not visually advance sealed progress");
    assert.equal(failedState.storedSteps, null, "Failed write must not manufacture persisted line data");
    assert.equal(failedState.revealCount, 0, "Failed write must not expose Reveal Your Reading");

    await page.evaluate(() => window.__restoreThreeCoinSetItem());
    await clickButton(page, "Retry saving this cast");
    await waitForText(page, "1 / 6 lines");
    const storedValue = await page.evaluate((key) => {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const steps = Array.isArray(parsed) ? parsed : parsed?.data?.steps ?? [];
      return steps[0]?.lineValue ?? null;
    }, STORAGE_KEY);
    assert.equal(storedValue, failedState.castValue, "Retry must persist the same cast value rather than rerolling the line");
    log("sessionStorage setItem fail-fast + same-cast retry PASS");
  } finally {
    await context.close();
  }
}

async function verifySeededResult(browser, viewport) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport(viewport);
  try {
    await seedCompletedReading(page);
    await page.goto(`${BASE}${RESULT_PATH}`, { waitUntil: "networkidle0", timeout: 30_000 });
    await waitForText(page, "Your Three-Coin Reading");
    await waitForText(page, "Fellowship");
    await waitForText(page, "Changing Line 1");
    await waitForText(page, "Changing Line 2");
    await waitForText(page, "Changing Line 4");
    await waitForText(page, "Gentle penetration");
    for (const heading of [
      "The Primary Hexagram",
      "Understanding the Structure",
      "Changing Lines",
      "The Relating Hexagram",
      "Bringing the Reading Together",
      "Bottom Line",
      "Questions to Sit With",
      "What to Watch",
    ]) await waitForText(page, heading);

    const beforeRefresh = await resultText(page);
    await page.reload({ waitUntil: "networkidle0" });
    await waitForText(page, "Bottom Line");
    assert.equal(await resultText(page), beforeRefresh, "Refresh must reproduce exactly the same visible reading text");

    await page.goBack({ waitUntil: "networkidle0" });
    await waitForText(page, "6 / 6 lines");
    const storedAfterBack = await page.evaluate((key) => sessionStorage.getItem(key), STORAGE_KEY);
    assert(storedAfterBack, "Back navigation must preserve the sealed reading");
    await page.goForward({ waitUntil: "networkidle0" });
    await waitForText(page, "Bottom Line");
    assert.equal(await resultText(page), beforeRefresh, "Forward navigation must restore the identical reading");

    await assertNoHorizontalOverflow(page);
    log(`${viewport.width}px seeded result / refresh / back / forward PASS`);
  } finally {
    await context.close();
  }
}

async function verifyClearFailure(browser) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  try {
    await seedCompletedReading(page);
    await page.goto(`${BASE}${RESULT_PATH}`, { waitUntil: "networkidle0", timeout: 30_000 });
    await waitForText(page, "Your Three-Coin Reading");
    await page.evaluate((key) => {
      const originalRemoveItem = Storage.prototype.removeItem;
      Object.defineProperty(window, "__restoreThreeCoinRemoveItem", {
        configurable: true,
        value: () => { Storage.prototype.removeItem = originalRemoveItem; },
      });
      Storage.prototype.removeItem = function removeItem(itemKey) {
        if (itemKey === key) throw new DOMException("Storage blocked", "SecurityError");
        return originalRemoveItem.call(this, itemKey);
      };
    }, STORAGE_KEY);

    await clickButton(page, "Start a New Reading");
    await waitForText(page, "THREE_COIN_SESSION_CLEAR_FAILED");
    const failureState = await page.evaluate((key) => ({
      pathname: location.pathname,
      stored: sessionStorage.getItem(key),
      stillShowsResult: document.body?.innerText.includes("Your Three-Coin Reading"),
    }), STORAGE_KEY);
    assert.equal(failureState.pathname, RESULT_PATH, "Clear failure must keep the user on the existing result page");
    assert(failureState.stored, "Clear failure must preserve the sealed reading");
    assert(failureState.stillShowsResult, "Clear failure must keep the current reading visible");
    log("sessionStorage removeItem fail-fast PASS");
  } finally {
    await context.close();
  }
}

async function verifyExplicitReset(browser) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  try {
    await seedCompletedReading(page);
    await page.goto(`${BASE}${RESULT_PATH}`, { waitUntil: "networkidle0", timeout: 30_000 });
    await waitForText(page, "Start a New Reading");
    await clickButton(page, "Start a New Reading");
    await page.waitForFunction(() => location.pathname === "/" && location.hash === "#three-coin-reading", { timeout: 15_000 });
    await clickButton(page, "Skip for now");
    await waitForText(page, "0 / 6 lines");
    const storedSteps = await page.evaluate((key) => {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : parsed?.data?.steps ?? null;
    }, STORAGE_KEY);
    assert.equal(storedSteps, null, "Start a New Reading must clear the sealed Three-Coin line data");
    log("Explicit reset PASS");
  } finally {
    await context.close();
  }
}

await verifySeoAnd404();
const { executablePath, usingSystemChrome } = await resolveChromeExecutable(chromium);
const browser = await puppeteer.launch({
  args: usingSystemChrome ? ["--no-sandbox", "--disable-dev-shm-usage"] : [...chromium.args, "--disable-dev-shm-usage"],
  executablePath,
  headless: true,
});
try {
  await verifyInvalidResult(browser);
  await verifyStorageReadFailure(browser);
  await verifyStorageWriteFailureRetry(browser);
  await verifySeededResult(browser, { width: 1440, height: 1000 });
  for (const width of [320, 375, 390]) {
    await verifySeededResult(browser, { width, height: 844 });
  }
  await verifyClearFailure(browser);
  await verifyExplicitReset(browser);
  log("ALL THREE-COIN V2 RESULT GATES PASS");
} finally {
  await browser.close();
}
