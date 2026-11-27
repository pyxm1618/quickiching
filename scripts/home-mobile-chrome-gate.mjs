import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
import { resolveChromeExecutable } from "./browser-runtime.mjs";

const BASE = process.env.PUBLIC_V1_TEST_BASE_URL || "http://127.0.0.1:3000";
const CONSENT_KEY = "quickiching:analytics-consent:v1";
const CASES = [
  { locale: "en", path: "/", width: 320, height: 740 },
  { locale: "en", path: "/", width: 360, height: 740 },
  { locale: "en", path: "/", width: 375, height: 667 },
  { locale: "en", path: "/", width: 390, height: 844 },
  { locale: "en", path: "/", width: 414, height: 740 },
  { locale: "zh-Hans", path: "/zh", width: 320, height: 740 },
  { locale: "zh-Hans", path: "/zh", width: 360, height: 740 },
  { locale: "zh-Hans", path: "/zh", width: 375, height: 667 },
  { locale: "zh-Hans", path: "/zh", width: 390, height: 844 },
];

function log(message) {
  console.log(`[Home Mobile Chrome Gate] ${message}`);
}

const TARGETS = [
  { label: "question textarea", selector: "textarea[data-private-question]" },
  { label: "primary action", selector: ".ritual-question-actions .ritual-gold-button" },
  { label: "skip link", selector: ".ritual-home-skip" },
];
const CHROME = [".scene-scrolls", ".scene-partnership", ".scene-navigation .scene-brand", ".scene-utility"];

async function measureLanding(page) {
  return page.evaluate(({ targets, chrome }) => {
    const rectOf = (node) => {
      const rect = node.getBoundingClientRect();
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        bottom: Math.round(rect.bottom),
      };
    };
    const visible = (node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const overlap = (a, b) => {
      const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
      const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
      return width * height;
    };

    const chromeRects = chrome.flatMap((selector) =>
      [...document.querySelectorAll(selector)].filter(visible).map((node) => ({
        selector,
        rect: rectOf(node),
      })),
    );
    const targetRects = targets.map(({ label, selector }) => {
      const node = document.querySelector(selector);
      return { label, selector, node, rect: node ? rectOf(node) : null };
    });

    const overlaps = [];
    for (const target of targetRects.filter((item) => item.node && visible(item.node))) {
      for (const item of chromeRects) {
        const area = overlap(target.rect, item.rect);
        if (area > 0) overlaps.push({ target: target.selector, chrome: item.selector, area });
      }
    }

    const hits = {};
    for (const { label, selector, node } of targetRects) {
      if (!node || !visible(node)) {
        hits[label] = { visible: false };
        continue;
      }
      const rect = node.getBoundingClientRect();
      const centerX = rect.x + rect.width / 2;
      const centerY = rect.y + rect.height / 2;
      const inViewport = centerX >= 0 && centerX <= innerWidth && centerY >= 0 && centerY <= innerHeight;
      const hit = inViewport ? document.elementFromPoint(centerX, centerY) : null;
      hits[label] = {
        visible: true,
        centerY: Math.round(centerY),
        inViewport,
        hitSelf: Boolean(hit?.closest?.(selector)),
        hitClass: hit ? (hit.className?.baseVal ?? hit.className ?? hit.tagName) : null,
      };
    }

    const nav = document.querySelector(".scene-navigation");
    const scrolls = document.querySelector(".scene-scrolls");
    return {
      navPosition: nav ? getComputedStyle(nav).position : null,
      scrollsPosition: scrolls ? getComputedStyle(scrolls).position : null,
      scrollsRect: scrolls ? rectOf(scrolls) : null,
      chrome: chromeRects,
      overlaps,
      hits,
      scrollHeight: document.documentElement.scrollHeight,
    };
  }, { targets: TARGETS, chrome: CHROME });
}

async function openHome(browser, testCase, { consent } = {}) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: testCase.width, height: testCase.height, deviceScaleFactor: 1 });
  if (consent) {
    await page.evaluateOnNewDocument(({ key, value }) => {
      try {
        localStorage.setItem(key, value);
      } catch {
        // Storage may be unavailable before the exact origin resolves; the reload below covers it.
      }
    }, { key: CONSENT_KEY, value: consent });
  }
  const response = await page.goto(`${BASE}${testCase.path}`, { waitUntil: "networkidle2", timeout: 45_000 });
  assert.equal(response?.status(), 200, `${testCase.path} must return HTTP 200`);
  await page.waitForSelector("[data-three-coin-ritual]", { timeout: 20_000 });
  await page.waitForSelector("textarea[data-private-question]", { timeout: 20_000 });
  return { context, page };
}

async function assertLandingClear(page, label) {
  const measured = await measureLanding(page);
  assert.equal(measured.navPosition, "static", `${label}: home shell must not overlay the form`);
  assert.equal(measured.scrollsPosition, "relative", `${label}: discovery nav must dock in document flow`);
  assert.deepEqual(measured.overlaps, [], `${label}: fixed chrome must not overlap the form`);

  for (const [target, hit] of Object.entries(measured.hits)) {
    if (!hit.visible || !hit.inViewport) continue;
    assert.equal(
      hit.hitSelf,
      true,
      `${label}: ${target} center must receive its own click, received ${hit.hitClass}`,
    );
  }
  log(`${label} landing chrome clearance PASS`);
  return measured;
}

async function assertScrolledTargetsClear(page, label, targets = TARGETS) {
  for (const { label: targetLabel, selector } of targets) {
    await page.$eval(selector, (node) => node.scrollIntoView({ block: "center", inline: "center", behavior: "instant" }));
    const hit = await page.evaluate((targetSelector) => {
      const node = document.querySelector(targetSelector);
      const rect = node.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return {
        hitSelf: Boolean(hit?.closest?.(targetSelector)),
        hitClass: hit ? (hit.className?.baseVal ?? hit.className ?? hit.tagName) : null,
        y: Math.round(rect.y),
      };
    }, selector);
    assert.equal(hit.hitSelf, true, `${label}: scrolled ${targetLabel} must stay clickable, received ${hit.hitClass}`);
  }
}

async function verifyCase(browser, testCase) {
  const { context, page } = await openHome(browser, testCase, { consent: "denied" });
  const label = `${testCase.locale} ${testCase.width}x${testCase.height}`;
  try {
    await assertLandingClear(page, label);
    await assertScrolledTargetsClear(page, label);

    // The discovery panel lives on the landing surface only; starting a reading
    // intentionally replaces it with the dense task shell. Exercise it while it
    // is reachable, then close it before typing the question.
    await page.$eval(".scene-scroll-methods", (node) => node.scrollIntoView({ block: "center", behavior: "instant" }));
    const tube = await page.$(".scene-scroll-methods");
    const tubeBox = await tube.boundingBox();
    assert(tubeBox, `${label}: Other Methods scroll must have a clickable box`);
    await page.mouse.click(tubeBox.x + tubeBox.width / 2, tubeBox.y + tubeBox.height / 2);
    await page.waitForSelector(".scene-methods-panel:not([hidden])", { timeout: 15_000 });
    const panelLink = await page.evaluate(() => {
      const link = document.querySelector(".scene-methods-panel:not([hidden]) a");
      if (!link) return { found: false };
      const rect = link.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return { found: true, hitSelf: Boolean(hit?.closest?.("a")) };
    });
    assert(panelLink.found && panelLink.hitSelf, `${label}: opened methods panel must remain clickable`);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.querySelector(".scene-methods-panel:not([hidden])") === null, { timeout: 5_000 });

    await page.$eval("textarea[data-private-question]", (node) => {
      node.scrollIntoView({ block: "center", behavior: "instant" });
      node.focus();
    });
    await page.type("textarea[data-private-question]", "Will this mobile layout stay usable ");
    await page.$eval(".ritual-question-actions .ritual-gold-button", (node) => node.scrollIntoView({ block: "center", behavior: "instant" }));
    const button = await page.$(".ritual-question-actions .ritual-gold-button");
    const box = await button.boundingBox();
    assert(box, `${label}: primary action must have a clickable box`);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForFunction(() =>
      document.querySelector("[data-three-coin-ritual]")?.getAttribute("data-experience-stage") === "question-confirm",
    { timeout: 15_000 });

    await assertScrolledTargetsClear(page, `${label} confirm`, TARGETS.filter(({ selector }) => selector !== ".ritual-home-skip"));
    log(`${label} real click, scroll nav and panel PASS`);
  } finally {
    await context.close();
  }
}

async function verifyFirstVisit(browser, testCase) {
  const label = `${testCase.locale} ${testCase.width}x${testCase.height} first visit`;
  const { context, page } = await openHome(browser, testCase);
  try {
    const bannerSelector = testCase.locale === "zh-Hans"
      ? '[aria-label="分析工具同意设置"]'
      : '[aria-label="Analytics Consent"]';
    await page.waitForSelector(bannerSelector, { timeout: 10_000 });
    const declineText = testCase.locale === "zh-Hans" ? "拒绝" : "Decline";
    const decline = await page.evaluateHandle((banner, text) => {
      return [...document.querySelectorAll(`${banner} button`)].find((node) => node.textContent?.trim() === text) ?? null;
    }, bannerSelector, declineText);
    const button = decline.asElement();
    assert(button, `${label}: decline control must exist`);
    const box = await button.boundingBox();
    assert(box, `${label}: decline control must have a clickable box`);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForFunction((selector) => document.querySelector(selector) === null, { timeout: 10_000 }, bannerSelector);
    await assertLandingClear(page, label);
    const stored = await page.evaluate((key) => localStorage.getItem(key), CONSENT_KEY);
    assert.equal(stored, "denied", `${label}: declining must persist the consent choice`);
    log(`${label} consent dismissal PASS`);
  } finally {
    await context.close();
  }
}

const serverlessChromium = {
  executablePath: async () => (await import("@sparticuz/chromium")).default.executablePath(),
};
const { executablePath, usingSystemChrome } = await resolveChromeExecutable(serverlessChromium);
const { default: sparticuz } = usingSystemChrome ? { default: null } : { default: (await import("@sparticuz/chromium")).default };
const browser = await puppeteer.launch({
  args: usingSystemChrome ? ["--no-sandbox", "--disable-dev-shm-usage"] : [...sparticuz.args, "--disable-dev-shm-usage"],
  executablePath,
  headless: true,
});

try {
  for (const testCase of CASES) {
    await verifyCase(browser, testCase);
  }
  for (const testCase of [
    { locale: "en", path: "/", width: 360, height: 740 },
    { locale: "zh-Hans", path: "/zh", width: 390, height: 844 },
  ]) {
    await verifyFirstVisit(browser, testCase);
  }
  log("ALL HOME MOBILE CHROME CLEARANCE GATES PASS");
} finally {
  await browser.close();
}
