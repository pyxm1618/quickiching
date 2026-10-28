import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { resolveChromeExecutable } from "./browser-runtime.mjs";

const BASE = process.env.PUBLIC_V1_TEST_BASE_URL || "http://127.0.0.1:3000";
const BASE_ORIGIN = new URL(BASE).origin;
const FIXTURE_STEPS = [
  { lineIndex: 0, coinFaces: ["yang", "yang", "yang"], lineValue: 9, algorithmVersion: "three-coin-v1" },
  { lineIndex: 1, coinFaces: ["yin", "yin", "yin"], lineValue: 6, algorithmVersion: "three-coin-v1" },
  { lineIndex: 2, coinFaces: ["yang", "yin", "yin"], lineValue: 7, algorithmVersion: "three-coin-v1" },
  { lineIndex: 3, coinFaces: ["yang", "yang", "yang"], lineValue: 9, algorithmVersion: "three-coin-v1" },
  { lineIndex: 4, coinFaces: ["yang", "yin", "yin"], lineValue: 7, algorithmVersion: "three-coin-v1" },
  { lineIndex: 5, coinFaces: ["yang", "yin", "yin"], lineValue: 7, algorithmVersion: "three-coin-v1" },
];

// These are stable authored-prose sentinels from four different dynamic catalog chunks.
// The fixture resolves to H13 → H57, so those chunks must load while unrelated H1/H61 stay absent.
const H1_CATALOG_SENTINEL = "Creative force describes a situation with strong capacity to initiate, shape, and sustain movement.";
const H13_CATALOG_SENTINEL = "Fellowship describes cooperation built around a purpose that can be stated in the open.";
const H57_CATALOG_SENTINEL = "Gentle penetration describes influence that becomes effective through repeated, small entry rather than one dramatic push.";
const H61_CATALOG_SENTINEL = "Inner truth describes credibility produced when belief, speech, and conduct become congruent enough that trust does not depend on performance.";

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
  // Three-Coin results are now correctly sealed behind auth + account History persistence.
  // Use the existing Manual Cast path to exercise the same shared PublicReadingResult bundle loader
  // without bypassing the Three-Coin reveal gate.
  await page.goto(`${BASE}/methods/manual-cast`, { waitUntil: "networkidle0", timeout: 30_000 });
  const clickButton = async (label) => {
    const clicked = await page.evaluate((wanted) => {
      const button = [...document.querySelectorAll("button")].find((node) => node.textContent?.trim() === wanted);
      if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
      button.click();
      return true;
    }, label);
    assert(clicked, `Could not click ${label}`);
  };
  await clickButton("Skip — free reading only");
  await page.waitForSelector("select:not(#manual-primary-hexagram)", { timeout: 15_000 });
  await page.evaluate((values) => {
    const selects = [...document.querySelectorAll("select")].filter((node) => node.id !== "manual-primary-hexagram");
    values.forEach((value, index) => {
      const select = selects[index];
      if (!(select instanceof HTMLSelectElement)) return;
      select.value = String(value);
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }, FIXTURE_STEPS.map((step) => step.lineValue));
  await clickButton("Build reading");
  await page.waitForFunction((sentinels) => {
    const text = document.body?.innerText ?? "";
    return sentinels.every((sentinel) => text.includes(sentinel));
  }, { timeout: 15_000 }, [H13_CATALOG_SENTINEL, H57_CATALOG_SENTINEL]);
  const scripts = await loadedJavascript(page);
  assert(scripts.combined.includes(H13_CATALOG_SENTINEL), "Result did not load the primary H13 interpretation chunk");
  assert(scripts.combined.includes(H57_CATALOG_SENTINEL), "Result did not load the relating H57 interpretation chunk");
  assert(!scripts.combined.includes(H1_CATALOG_SENTINEL), "Result eagerly loaded an unrelated H1 interpretation chunk");
  assert(!scripts.combined.includes(H61_CATALOG_SENTINEL), "Result eagerly loaded an unrelated H61 interpretation chunk");
  log(`RESULT_JS resources=${scripts.urls.length} bytes=${scripts.bytes}; shared result loader selected H13/H57 chunks; unrelated H1/H61 chunks absent`);
}

const { executablePath, usingSystemChrome } = await resolveChromeExecutable(chromium);
const browser = await puppeteer.launch({
  args: usingSystemChrome ? ["--no-sandbox", "--disable-dev-shm-usage"] : [...chromium.args, "--disable-dev-shm-usage"],
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
