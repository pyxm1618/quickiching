import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

const BASE = process.env.PUBLIC_V1_TEST_BASE_URL || "http://127.0.0.1:3000";
const BASE_ORIGIN = new URL(BASE).origin;
const STORAGE_KEY = "quickiching:public-v1:three-coin";
const FIXTURE_STEPS = [
  { lineIndex: 0, coinFaces: ["yang", "yang", "yang"], lineValue: 9, algorithmVersion: "three-coin-v1" },
  { lineIndex: 1, coinFaces: ["yin", "yin", "yin"], lineValue: 6, algorithmVersion: "three-coin-v1" },
  { lineIndex: 2, coinFaces: ["yang", "yin", "yin"], lineValue: 7, algorithmVersion: "three-coin-v1" },
  { lineIndex: 3, coinFaces: ["yang", "yang", "yang"], lineValue: 9, algorithmVersion: "three-coin-v1" },
  { lineIndex: 4, coinFaces: ["yang", "yin", "yin"], lineValue: 7, algorithmVersion: "three-coin-v1" },
  { lineIndex: 5, coinFaces: ["yang", "yin", "yin"], lineValue: 7, algorithmVersion: "three-coin-v1" },
];

const H1_CATALOG_SENTINEL = "test the first impulse before turning initiative into commitment";
const H13_CATALOG_SENTINEL = "state the common purpose before inviting people to identify with the group";
const H57_CATALOG_SENTINEL = "choose the first direction clearly before beginning subtle or repeated influence";
const H61_CATALOG_SENTINEL = "check the first inward conviction against evidence before asking others to trust it";

function log(message) {
  console.log(`[Interpretation Bundle Gate] ${message}`);
}

async function loadedJavascript(page) {
  const urls = await page.evaluate(() => [...new Set([
    ...[...document.scripts].map((script) => script.src).filter(Boolean),
    ...performance.getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => name.includes("/_next/") && name.includes(".js")),
  ])]);
  const sameOriginUrls = urls.filter((url) => new URL(url, BASE).origin === BASE_ORIGIN);
  const payloads = await page.evaluate(async (resourceUrls) => Promise.all(resourceUrls.map(async (url) => {
    const response = await fetch(url);
    return { url, text: await response.text() };
  })), sameOriginUrls);
  return {
    urls: sameOriginUrls,
    bytes: payloads.reduce((sum, payload) => sum + Buffer.byteLength(payload.text), 0),
    combined: payloads.map((payload) => payload.text).join("\n"),
  };
}

async function verifyHomepage(page) {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0", timeout: 30_000 });
  const scripts = await loadedJavascript(page);
  for (const sentinel of [H1_CATALOG_SENTINEL, H13_CATALOG_SENTINEL, H57_CATALOG_SENTINEL, H61_CATALOG_SENTINEL]) {
    assert(!scripts.combined.includes(sentinel), `Homepage downloaded V2 interpretation prose: ${sentinel}`);
  }
  log(`HOMEPAGE_JS resources=${scripts.urls.length} bytes=${scripts.bytes}; V2 catalog prose absent`);
}

async function verifyResult(page) {
  await page.evaluate(({ key, steps }) => sessionStorage.setItem(key, JSON.stringify(steps)), {
    key: STORAGE_KEY,
    steps: FIXTURE_STEPS,
  });
  await page.goto(`${BASE}/readings/three-coin/result`, { waitUntil: "networkidle0", timeout: 30_000 });
  await page.waitForFunction(() => document.body?.innerText.includes("Bottom Line"), { timeout: 15_000 });
  const scripts = await loadedJavascript(page);
  assert(scripts.combined.includes(H13_CATALOG_SENTINEL), "Result did not load the primary H13 interpretation chunk");
  assert(scripts.combined.includes(H57_CATALOG_SENTINEL), "Result did not load the relating H57 interpretation chunk");
  assert(!scripts.combined.includes(H1_CATALOG_SENTINEL), "Result eagerly loaded an unrelated H1 interpretation chunk");
  assert(!scripts.combined.includes(H61_CATALOG_SENTINEL), "Result eagerly loaded an unrelated H61 interpretation chunk");
  log(`RESULT_JS resources=${scripts.urls.length} bytes=${scripts.bytes}; selected H13/H57 chunks present; unrelated H1/H61 chunks absent`);
}

const executablePath = process.env.CHROME_PATH || await chromium.executablePath();
const browser = await puppeteer.launch({
  args: process.env.CHROME_PATH ? ["--no-sandbox", "--disable-dev-shm-usage"] : [...chromium.args, "--disable-dev-shm-usage"],
  executablePath,
  headless: true,
});
try {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  try {
    await verifyHomepage(page);
    await verifyResult(page);
  } finally {
    await context.close();
  }
  log("INTERPRETATION BUNDLE BOUNDARY PASS");
} finally {
  await browser.close();
}
