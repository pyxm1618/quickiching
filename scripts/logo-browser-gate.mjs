import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { resolveChromeExecutable } from "./browser-runtime.mjs";

const BASE = process.env.PUBLIC_V1_TEST_BASE_URL || "http://127.0.0.1:3000";
const BRAND_ASSET = "quick-i-ching-logo-mark.png";

const DESKTOP_PATHS = [
  ["/", "Homepage"],
  ["/methods/three-coin", "Three-Coin"],
  ["/methods/yarrow-stalks", "Yarrow"],
  ["/methods/mei-hua-yi-shu", "Mei Hua"],
  ["/guides/how-to-ask-the-i-ching", "Guide"],
];

const IMMERSIVE_PATHS = [
  ["/hexagrams", "Hexagrams"],
];

function log(message) {
  console.log(`[Logo Browser Gate] ${message}`);
}

async function assertImageEndpoint(path, expectedType) {
  const response = await fetch(`${BASE}${path}`);
  assert.equal(response.status, 200, `${path}: expected 200, received ${response.status}`);
  const type = response.headers.get("content-type") || "";
  assert(type.includes(expectedType), `${path}: unexpected content type ${type}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert(bytes.length > 0, `${path}: empty image response`);
}

async function waitForDecodedBrandImage(page, selector) {
  await page.waitForFunction(
    (imageSelector) => {
      const image = document.querySelector(imageSelector);
      return image instanceof HTMLImageElement
        && image.complete
        && image.naturalWidth > 0
        && image.naturalHeight > 0;
    },
    { timeout: 15_000 },
    selector,
  );
}

async function inspectBrandChrome(page, label) {
  const scene = await page.$("body > header.scene-navigation") !== null;
  const selector = scene
    ? "body > header .scene-brand img"
    : 'body > header img[alt="Quick I Ching logo"], body > header img[alt="Quick I Ching 标志"]';
  await page.waitForSelector(selector, { timeout: 15_000 });
  await waitForDecodedBrandImage(page, selector);
  const state = await page.$eval(selector, (image) => {
    const rect = image.getBoundingClientRect();
    const style = getComputedStyle(image);
    return {
      source: image.currentSrc || image.src,
      width: rect.width, height: rect.height,
      background: style.backgroundColor, objectFit: style.objectFit, filter: style.filter, content: style.content,
      text: document.querySelector("body > header")?.textContent ?? "",
      imageAlt: image.alt,
      retiredFooter: document.querySelector("body > footer") !== null,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });
  assert(state.source.includes(scene ? "/navigation/logo.webp" : BRAND_ASSET), `${label}: approved brand image missing: ${state.source}`);
  assert(state.width > 0 && state.height > 0, `${label}: approved brand image must remain visible`);
  if (scene) {
    assert(state.content.includes("/navigation/logo-reference.webp"), `${label}: approved scene brand artwork changed`);
    assert.equal(state.imageAlt, "", `${label}: decorative scene mark must retain its adjacent accessible brand text`);
  } else {
    assert(Math.abs(state.width - 34) <= 0.5 && Math.abs(state.height - 34) <= 0.5, `${label}: approved Info brand size changed`);
    assert.equal(state.background, "rgba(0, 0, 0, 0)");
    assert.equal(state.objectFit, "contain");
    assert(state.filter.includes("invert(1)"));
  }
  assert(state.text.includes("Quick I Ching"), `${label}: visible brand text missing`);
  assert.equal(state.retiredFooter, false, `${label}: retired global Footer must stay absent`);
  assert.equal(state.overflow, false, `${label}: horizontal overflow`);
}

async function inspectHiddenGlobalChrome(page, label) {
  await page.waitForFunction(() => {
    const header = document.querySelector("body > header");
    return header instanceof HTMLElement && getComputedStyle(header).display === "none";
  }, { timeout: 15_000 });
  assert.equal(await page.$("body > footer"), null, `${label}: retired global Footer must stay absent`);
}

async function runRoute(browser, path, label, viewport, { immersive = false } = {}) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport(viewport);
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    const response = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0", timeout: 30_000 });
    assert(response, `${label}: navigation returned no response`);
    assert.equal(response.status(), 200, `${label}: expected 200, received ${response.status()}`);
    if (immersive) {
      await inspectHiddenGlobalChrome(page, label);
    } else {
      await inspectBrandChrome(page, label);
    }
    assert.deepEqual(consoleErrors, [], `${label}: console errors: ${consoleErrors.join(" | ")}`);
    assert.deepEqual(pageErrors, [], `${label}: page errors: ${pageErrors.join(" | ")}`);
    log(`${label} PASS`);
  } finally {
    await context.close();
  }
}

await assertImageEndpoint("/favicon.ico", "image/x-icon");
await assertImageEndpoint("/favicon-16x16.png", "image/png");
await assertImageEndpoint("/favicon-32x32.png", "image/png");
await assertImageEndpoint("/favicon-48x48.png", "image/png");
await assertImageEndpoint("/icon.png", "image/png");
log("Favicon/icon endpoints PASS");

const { executablePath, usingSystemChrome } = await resolveChromeExecutable(chromium);
const browser = await puppeteer.launch({
  args: usingSystemChrome ? ["--no-sandbox", "--disable-dev-shm-usage"] : [...chromium.args, "--disable-dev-shm-usage"],
  executablePath,
  headless: true,
});

try {
  const desktop = { width: 1440, height: 1000 };
  for (const [path, name] of DESKTOP_PATHS) {
    await runRoute(browser, path, `Desktop EN ${name} brand chrome`, desktop);
    await runRoute(browser, path === "/" ? "/zh" : `/zh${path}`, `Desktop ZH ${name} brand chrome`, desktop);
  }

  for (const [path, name] of IMMERSIVE_PATHS) {
    await runRoute(browser, path, "Desktop " + name + " immersive chrome", desktop, { immersive: true });
  }

  await runRoute(browser, "/", "375px Homepage formal brand/navigation", { width: 375, height: 812 });
} finally {
  await browser.close();
}

log("ALL LOGO / FAVICON BROWSER ACCEPTANCE GATES PASS");
