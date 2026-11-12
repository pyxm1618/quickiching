import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
import { resolveChromeExecutable } from "./browser-runtime.mjs";

const BASE = process.env.PUBLIC_V1_TEST_BASE_URL || "http://127.0.0.1:3000";
const STORAGE_KEY = "quickiching:public-v1:three-coin";
const COMPLETED_READING_KEY = "quickiching:public-v1:completed-reading";
const FIXTURE_CASTING_ID = "11111111-1111-4111-8111-111111111111";
const RESULT_PATH = "/readings/choice";
const HOME_TITLE = "I Ching Online — Free Hexagram Reading | Quick I Ching";
const HOME_DESCRIPTION = "Use the I Ching online with Three-Coin, Yarrow Stalk, Mei Hua Yi Shu, or Manual Cast. See changing lines and get a free grounded interpretation.";
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
  if (["Cast the Coins", "Record This Cast"].includes(label)) {
    await page.waitForFunction(wanted => [...document.querySelectorAll("button")].some(node => node.textContent?.trim() === wanted && !node.disabled), {timeout:3000}, label);
  }
  const clicked = await page.evaluate((wanted) => {
    const button = [...document.querySelectorAll("button")].find((node) => node.textContent?.trim() === wanted);
    if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
    button.click();
    return true;
  }, label);
  assert(clicked, `Unable to click enabled button: ${label}`);
}

async function seedCompletedReadingStorage(page) {
  // Seed a sealed, question-free session using the current envelope format.
  await page.goto(`${BASE}/robots.txt`, { waitUntil: "networkidle0", timeout: 30_000 });
  await page.evaluate(({ key, completedKey, castingId, steps }) => {
    const createdAt = "2026-09-27T00:00:00.000Z";
    sessionStorage.setItem(key, JSON.stringify({
      schemaVersion: 1,
      id: castingId,
      createdAt,
      started: true,
      coreQuestionFrozenAtCast: true,
      data: { steps },
    }));
    sessionStorage.setItem(completedKey, JSON.stringify({
      schemaVersion: 1,
      id: castingId,
      createdAt,
      method: "three-coin",
      methodVersion: "three-coin-v1",
      lineValuesBottomUp: steps.map((step) => step.lineValue),
      evidence: { kind: "three-coin", steps },
    }));
  }, {
    key: STORAGE_KEY,
    completedKey: COMPLETED_READING_KEY,
    castingId: FIXTURE_CASTING_ID,
    steps: FIXTURE_STEPS,
  });
}

async function seedCompletedReading(page) {
  // A restored six-line cast must recover directly into the canonical Result Choice route.
  await seedCompletedReadingStorage(page);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0", timeout: 30_000 });
  await page.waitForFunction(
    (resultPath, castingId) => location.pathname === resultPath && new URLSearchParams(location.search).get("session") === castingId,
    { timeout: 30_000 },
    RESULT_PATH,
    FIXTURE_CASTING_ID,
  );
  await page.waitForSelector("[data-result-choice]", { timeout: 15_000 });
  assert.equal(await page.$("[data-completed-cast-gate]"), null, "Result Choice must appear before authentication");

  const completedState = await page.evaluate(({ completedKey, castingId }) => {
    const raw = sessionStorage.getItem(completedKey);
    const completed = raw ? JSON.parse(raw) : null;
    return {
      pathname: location.pathname,
      session: new URLSearchParams(location.search).get("session"),
      completedId: completed?.id ?? null,
      ritualCompleteViewVisible: document.querySelector('[data-ritual-view="complete"]') !== null,
    };
  }, { completedKey: COMPLETED_READING_KEY, castingId: FIXTURE_CASTING_ID });
  assert.equal(completedState.pathname, RESULT_PATH, "Restored completed cast must recover into the canonical Result Choice route");
  assert.equal(completedState.session, FIXTURE_CASTING_ID, "Recovered Result Choice route must preserve the same stable casting id");
  assert.equal(completedState.completedId, FIXTURE_CASTING_ID, "Recovered completed-reading payload must preserve the same stable casting id");
  assert.equal(completedState.ritualCompleteViewVisible, false, "Restored six-line cast must not leave the user stuck on a completed casting screen");
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

async function verifyFormalEntryPoints(browser) {
  for (const path of ["/", "/zh", "/methods/three-coin", "/zh/methods/three-coin"]) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    try {
      const response = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0", timeout: 30_000 });
      assert.equal(response?.status(), 200, `${path} must return HTTP 200`);
      await page.waitForSelector('[data-three-coin-ritual]');
      await page.waitForSelector('[data-three-coin-presentation="ritual"]');
      assert.equal(await page.$('[data-question-first]'), null, `${path} must not mount the retired generic Three-Coin question UI`);
      assert.equal(await page.evaluate(() => document.querySelectorAll('[data-three-coin-ritual]').length), 1, `${path} must mount exactly one formal Three-Coin ritual`);
    } finally {
      await context.close();
    }
  }
  log("EN/ZH Home + /methods/three-coin formal entry points PASS");
}

async function verifyInvalidResult(browser) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  try {
    const response = await page.goto(`${BASE}${RESULT_PATH}`, { waitUntil: "networkidle0", timeout: 30_000 });
    assert.equal(response?.status(), 200, "Product result route should remain HTTP 200 even without a completed browser reading");
    await waitForText(page, "No completed cast was found");
    const body = await resultText(page);
    assert(!body.includes("Fellowship"), "Invalid result state must not manufacture a reading");
    const href = await page.$eval('a[href="/"]', (node) => node.getAttribute("href"));
    assert.equal(href, "/");
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
    await clickButton(page, "Skip — free reading only");
    await waitForText(page, "This question could not be saved.");
    const state = await page.evaluate(() => ({
      questionPromptVisible: document.querySelector("[data-three-coin-ritual] textarea") !== null,
      castControlsVisible: document.querySelector('[data-three-coin-presentation] .hold-button') !== null,
      savedQuestionError: document.body?.innerText.includes("This question could not be saved."),
    }));
    assert(state.questionPromptVisible, "Question prompt must remain visible when its storage read fails");
    assert.equal(state.castControlsVisible, false, "Casting must remain unavailable until the question state can be persisted");
    assert(state.savedQuestionError, "Storage read failure must explain why the question cannot be saved");
    log("sessionStorage read failure blocks casting before the question is persisted PASS");
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
      if (itemKey === key) {
        let parsed;
        try {
          parsed = JSON.parse(value);
        } catch {
          parsed = null;
        }
        if (parsed && typeof parsed === "object" && "data" in parsed) {
          throw new DOMException("Storage blocked", "QuotaExceededError");
        }
      }
      return originalSetItem.call(this, itemKey, value);
    };
  }, STORAGE_KEY);
  try {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle0", timeout: 30_000 });
    await clickButton(page, "Skip — free reading only");
    await page.waitForSelector("[data-question-confirm]", { timeout: 5000 });
    await clickButton(page, "Cast the Coins");
    await page.waitForSelector(".hold-button:not(:disabled)");
    assert.equal(await page.$$eval('.ritual-six-lines li[data-state="done"]',nodes=>nodes.length),0);
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
        progress: document.querySelectorAll('.ritual-six-lines li[data-state="done"]').length===0,
        storedSteps: parsed?.data?.steps ?? null,
        revealCount: [...document.querySelectorAll("a")].filter((node) => node.textContent?.trim() === "Reveal Your Reading").length,
      };
    }, STORAGE_KEY);
    assert([6, 7, 8, 9].includes(failedState.castValue), "Failed write state must retain the authoritative cast value in memory");
    assert(failedState.progress, "Failed write must not visually advance sealed progress");
    assert.equal(failedState.storedSteps, null, "Failed write must not manufacture persisted line data");
    assert.equal(failedState.revealCount, 0, "Failed write must not expose Reveal Your Reading");

    await page.evaluate(() => window.__restoreThreeCoinSetItem());
    await clickButton(page, "Retry saving this cast");
    await waitForText(page, "Record This Cast");
    const storedValue = await page.evaluate((key) => {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const steps = parsed?.data?.steps ?? [];
      return steps[0]?.lineValue ?? null;
    }, STORAGE_KEY);
    assert.equal(storedValue, failedState.castValue, "Retry must persist the same cast value rather than rerolling the line");
    await clickButton(page, "Record This Cast");
    await page.waitForFunction(()=>document.querySelectorAll('.ritual-six-lines li[data-state="done"]').length===1);
    log("sessionStorage setItem fail-fast + same-cast retry + visual record PASS");
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
    await page.waitForSelector("[data-result-choice]", { timeout: 15_000 });
    await waitForText(page, "Primary Hexagram");
    await waitForText(page, "Deep Reading");
    await waitForText(page, "Free Reading");

    const choiceState = await page.evaluate(() => ({
      authGate: document.querySelector("[data-auth-required-before-reveal]") !== null,
      choice: document.querySelector("[data-result-choice]") !== null,
      primaryChoice: document.querySelector("[data-result-choice-primary]") !== null,
      relatingChoice: document.querySelector("[data-result-choice-relating]") !== null,
      freeChoice: document.querySelector("[data-result-choice-free]") !== null,
      deepChoice: document.querySelector("[data-result-choice-deep]") !== null,
      primaryCard: document.querySelector("[data-primary-card]") !== null,
      deepEntry: document.querySelector("[data-deep-reading-entry]") !== null,
    }));
    assert(choiceState.choice, "Anonymous completed cast must render Result Choice");
    assert.equal(choiceState.authGate, false, "Result Choice must not require authentication");
    assert(choiceState.primaryChoice && choiceState.relatingChoice, "Result Choice must show the completed cast summary");
    assert(choiceState.freeChoice && choiceState.deepChoice, "Result Choice must offer both reading destinations");
    assert.equal(choiceState.primaryCard, false, "Result Choice must not render Free Reading content");
    assert.equal(choiceState.deepEntry, false, "Result Choice must not render Deep Reading content");

    const beforeRefresh = await resultText(page);
    await page.reload({ waitUntil: "networkidle0" });
    await page.waitForSelector("[data-result-choice]", { timeout: 15_000 });
    assert.equal(await resultText(page), beforeRefresh, "Refresh must reproduce the same anonymous Result Choice");

    await page.goBack({ waitUntil: "networkidle0" });
    await page.waitForFunction(
      (resultPath, castingId) => location.pathname === resultPath && new URLSearchParams(location.search).get("session") === castingId,
      { timeout: 30_000 },
      RESULT_PATH,
      FIXTURE_CASTING_ID,
    );
    await page.waitForSelector("[data-result-choice]", { timeout: 15_000 });
    assert.equal(await page.$("[data-completed-cast-gate]"), null, "Back navigation must stay before authentication");
    const storedAfterBack = await page.evaluate((key) => sessionStorage.getItem(key), STORAGE_KEY);
    assert(storedAfterBack, "Back navigation must preserve the sealed reading");
    assert.equal(await page.$('[data-ritual-view="complete"]'), null, "Back navigation must not strand the user on the completed casting screen");

    await assertNoHorizontalOverflow(page);
    log(`${viewport.width}px completed-cast Result Choice / refresh / back recovery PASS`);
  } finally {
    await context.close();
  }
}

async function verifyHistorySaveRetry(browser) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const requests = [];
  let pending = null;
  try {
    await seedCompletedReading(page);
    const completed = await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key)), STORAGE_KEY);

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname === "/api/readings" && request.method() === "POST") {
        requests.push(JSON.parse(request.postData()));
        pending = request;
        return;
      }
      if (url.pathname.startsWith("/api/readings/browser-gate-saved-cast/") && request.method() === "GET") {
        return request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "not_started" }) });
      }
      if (request.method() !== "GET" && request.method() !== "HEAD") return request.abort("blockedbyclient");
      request.continue();
    });

    await page.goto(`${BASE}/ritual-qa-local?view=saving`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForSelector("[data-account-reading-saving]");
    assert(pending, "Authenticated save fixture must issue POST /api/readings");
    assert.equal(await page.$("[data-public-reading-result]"), null, "Result must remain concealed while History save is pending");

    await pending.respond({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "READING_SAVE_FAILED" }) });
    pending = null;
    await page.waitForSelector("[data-retry-account-reading-save]");
    assert.equal(await page.$("[data-public-reading-result]"), null, "Save failure must keep the result concealed");

    await clickButton(page, "Retry saving this cast");
    await page.waitForSelector("[data-account-reading-saving]");
    assert(pending, "Retry must issue the same POST /api/readings");
    assert.deepEqual(requests[1], requests[0], "Retry must reuse the identical saved-cast payload");
    assert.equal(requests[1].clientCastingId, completed.id, "History save must use the same stable browser casting id");
    assert.deepEqual(
      requests[1].lineValuesBottomUp,
      completed.data.steps.map((step) => step.lineValue),
      "History save must use the exact completed six lines",
    );

    await pending.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ castingId: "browser-gate-saved-cast" }) });
    pending = null;
    await page.waitForSelector("[data-public-reading-result]", { timeout: 15_000 });
    const restored = await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key)), STORAGE_KEY);
    assert.deepEqual(restored, completed, "History retry/reveal must not replace or reroll the completed cast");
    log("History save failure/retry + same-cast reveal PASS");
  } finally {
    await context.close();
  }
}

async function verifyClearFailure(browser) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  try {
    await seedCompletedReadingStorage(page);
    await page.goto(`${BASE}/ritual-qa-local`, { waitUntil: "networkidle0", timeout: 30_000 });
    await page.waitForSelector("[data-public-reading-result]:not([data-reading-localization-loading])");
    assert.equal(await page.$eval("#public-reading-result-title", node => node.textContent), "Your Free Reading");
    const removeItemFailureArmed = await page.evaluate((key) => {
      const originalRemoveItem = Storage.prototype.removeItem;
      Object.defineProperty(window, "__restoreThreeCoinRemoveItem", {
        configurable: true,
        value: () => {
          Object.defineProperty(Storage.prototype, "removeItem", {
            configurable: true,
            writable: true,
            value: originalRemoveItem,
          });
        },
      });
      Object.defineProperty(Storage.prototype, "removeItem", {
        configurable: true,
        writable: true,
        value: function removeItem(itemKey) {
          if (this === sessionStorage && itemKey === key) {
            throw new DOMException("Storage blocked", "SecurityError");
          }
          return originalRemoveItem.call(this, itemKey);
        },
      });

      const before = sessionStorage.getItem(key);
      let blocked = false;
      try {
        sessionStorage.removeItem(key);
      } catch {
        blocked = true;
      }
      return blocked && before !== null && sessionStorage.getItem(key) === before;
    }, STORAGE_KEY);
    assert(removeItemFailureArmed, "Browser gate must prove sessionStorage.removeItem failure injection before testing clear fail-fast");

    await clickButton(page, "Start a New Reading");
    await page.waitForSelector('[data-three-coin-clear-error="THREE_COIN_SESSION_CLEAR_FAILED"]', { timeout: 15_000 });
    await waitForText(page, "THREE_COIN_SESSION_CLEAR_FAILED");
    const failureState = await page.evaluate((key) => ({
      pathname: location.pathname,
      stored: sessionStorage.getItem(key),
      stillShowsResult: Boolean(document.querySelector("[data-public-reading-result]:not([data-reading-localization-loading])")),
    }), STORAGE_KEY);
    assert.equal(failureState.pathname, "/ritual-qa-local", "Clear failure must keep the user on the existing saved-result page");
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
    await seedCompletedReadingStorage(page);
    await page.goto(`${BASE}/ritual-qa-local`, { waitUntil: "networkidle0", timeout: 30_000 });
    await waitForText(page, "Start a New Reading");
    await clickButton(page, "Start a New Reading");
    await page.waitForFunction(() => location.pathname === "/methods/three-coin", { timeout: 15_000 });
    await clickButton(page, "Skip — free reading only");
    await page.waitForSelector('[data-experience-stage="question-confirm"]');
    await page.waitForSelector('[data-home-primary-action]:not(:disabled)', { timeout: 15_000 });
    await clickButton(page, "Cast the Coins");
    await page.waitForSelector(".hold-button:not(:disabled)");
    assert.equal(await page.$$eval('.ritual-six-lines li[data-state="done"]',nodes=>nodes.length),0);
    const storedSteps = await page.evaluate((key) => {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.data?.steps ?? null;
    }, STORAGE_KEY);
    assert.equal(storedSteps, null, "Start a New Reading must clear the sealed Three-Coin line data");
    log("Explicit reset PASS");
  } finally {
    await context.close();
  }
}

await verifySeoAnd404();
const chromiumProxy = {
  async executablePath() {
    const { default: chromium } = await import("@sparticuz/chromium");
    return chromium.executablePath();
  },
};
const { executablePath, usingSystemChrome } = await resolveChromeExecutable(chromiumProxy);
const serverlessChromium = usingSystemChrome ? null : (await import("@sparticuz/chromium")).default;
const browser = await puppeteer.launch({
  args: usingSystemChrome ? ["--no-sandbox", "--disable-dev-shm-usage"] : [...serverlessChromium.args, "--disable-dev-shm-usage"],
  executablePath,
  headless: true,
});
try {
  await verifyFormalEntryPoints(browser);
  await verifyInvalidResult(browser);
  await verifyStorageReadFailure(browser);
  await verifyStorageWriteFailureRetry(browser);
  await verifySeededResult(browser, { width: 1440, height: 1000 });
  for (const width of [320, 375, 390]) {
    await verifySeededResult(browser, { width, height: 844 });
  }
  if (process.argv.includes("--public-only")) {
    log("PUBLIC THREE-COIN RESULT-CHOICE-FIRST GATES PASS; authenticated Free/Deep fixture cases run separately in Three-Coin engineering regression");
  } else {
    await verifyHistorySaveRetry(browser);
    await verifyClearFailure(browser);
    await verifyExplicitReset(browser);
    log("ALL THREE-COIN V2 RESULT-CHOICE-FIRST GATES PASS");
  }
} finally {
  await browser.close();
}
