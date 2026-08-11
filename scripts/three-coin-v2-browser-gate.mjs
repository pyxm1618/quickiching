import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

const BASE = process.env.PUBLIC_V1_TEST_BASE_URL || "http://127.0.0.1:3000";
const STORAGE_KEY = "quickiching:public-v1:three-coin";
const RESULT_PATH = "/readings/three-coin/result";
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

async function waitForText(page, text, timeout = 15_000) {
  await page.waitForFunction((value) => document.body?.innerText.includes(value), { timeout }, text);
}

async function seedCompletedReading(page) {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0", timeout: 30_000 });
  await page.evaluate(({ key, steps }) => sessionStorage.setItem(key, JSON.stringify(steps)), {
    key: STORAGE_KEY,
    steps: FIXTURE_STEPS,
  });
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
    assert(!body.includes("Primary Hexagram 13"), "Invalid result state must not manufacture a reading");
    const href = await page.$eval('a[href="/#three-coin-reading"]', (node) => node.getAttribute("href"));
    assert.equal(href, "/#three-coin-reading");
    log("Invalid direct result URL PASS");
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
    await waitForText(page, "Gentle Penetration");
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

async function verifyExplicitReset(browser) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  try {
    await seedCompletedReading(page);
    await page.goto(`${BASE}${RESULT_PATH}`, { waitUntil: "networkidle0", timeout: 30_000 });
    await waitForText(page, "Start a New Reading");
    const clicked = await page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find((node) => node.textContent?.trim() === "Start a New Reading");
      if (!(button instanceof HTMLButtonElement)) return false;
      button.click();
      return true;
    });
    assert(clicked, "Start a New Reading button missing");
    await page.waitForFunction(() => location.pathname === "/" && location.hash === "#three-coin-reading", { timeout: 15_000 });
    await waitForText(page, "0 / 6 lines");
    const stored = await page.evaluate((key) => sessionStorage.getItem(key), STORAGE_KEY);
    assert.equal(stored, null, "Start a New Reading must clear the sealed Three-Coin session");
    log("Explicit reset PASS");
  } finally {
    await context.close();
  }
}

const executablePath = process.env.CHROME_PATH || await chromium.executablePath();
const browser = await puppeteer.launch({
  args: process.env.CHROME_PATH ? ["--no-sandbox", "--disable-dev-shm-usage"] : [...chromium.args, "--disable-dev-shm-usage"],
  executablePath,
  headless: true,
});
try {
  await verifyInvalidResult(browser);
  await verifySeededResult(browser, { width: 1440, height: 1000 });
  for (const width of [320, 375, 390]) {
    await verifySeededResult(browser, { width, height: 844 });
  }
  await verifyExplicitReset(browser);
  log("ALL THREE-COIN V2 RESULT GATES PASS");
} finally {
  await browser.close();
}
