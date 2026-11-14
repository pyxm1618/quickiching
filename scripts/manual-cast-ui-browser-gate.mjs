import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { resolveChromeExecutable } from "./browser-runtime.mjs";

const BASE = process.env.PUBLIC_V1_TEST_BASE_URL || "http://127.0.0.1:3000";
const OUT = path.resolve(".artifacts/manual-cast-ui");
const SESSION_KEY = "quickiching:public-v1:manual-cast";
const DRAFT_KEY = "quickiching:public-v1:manual-cast:draft:v1";
const PENDING_PREFIX = "quickiching:public-v1:pending-completed-reading:";
const CONSENT_KEY = "quickiching:analytics-consent:v1";

function log(message) { console.log("[Manual Cast UI] " + message); }
function fixtureId(prefix, width) { return "550e8400-e29b-41d4-a716-" + prefix + String(width).padStart(4, "0"); }

async function seedQuestion(page, route, id, question) {
  // The tool resumes a saved cast on mount, so a completed cast left by an earlier handoff in this
  // tab would redirect the route before the seed could clear it. Reset on a neutral page first.
  await page.goto(BASE + "/robots.txt", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.evaluate((input) => {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(input.pendingPrefix)) localStorage.removeItem(key);
    }
    sessionStorage.removeItem(input.draftKey);
    sessionStorage.removeItem(input.sessionKey);
    localStorage.setItem(input.consentKey, "denied");
    sessionStorage.setItem(input.sessionKey, JSON.stringify({
      schemaVersion: 1, id: input.id, createdAt: new Date().toISOString(), started: true,
      question: input.question, coreQuestionFrozenAtCast: false,
    }));
  }, { sessionKey: SESSION_KEY, pendingPrefix: PENDING_PREFIX, draftKey: DRAFT_KEY, consentKey: CONSENT_KEY, id, question });
  await page.goto(BASE + route, { waitUntil: "networkidle0", timeout: 30000 });
  await page.waitForSelector("[data-manual-cast-tool]", { timeout: 10000 });
}

async function assertNoOverflow(page, label) {
  const metrics = await page.evaluate(() => ({ width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  assert(metrics.scrollWidth <= metrics.width + 1, label + ": horizontal overflow " + metrics.scrollWidth + "px > " + metrics.width + "px");
}

async function assertTouchTargets(page, label) {
  const sizes = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll("[data-manual-mode]"), ...document.querySelectorAll("[data-line-value]"), ...document.querySelectorAll("[data-moving-line-position]"), document.querySelector("[data-hexagram-picker-trigger]"), document.querySelector("[data-manual-continue]")].filter(Boolean);
    return nodes.map((node) => { const rect = node.getBoundingClientRect(); return { width: rect.width, height: rect.height, text: node.textContent?.trim() || node.getAttribute("aria-label") || "" }; });
  });
  for (const size of sizes) {
    assert(size.height >= 44, label + ": touch target " + size.text + " height " + size.height + "px < 44px");
    assert(size.width >= 44, label + ": touch target " + size.text + " width " + size.width + "px < 44px");
  }
}

async function capture(page, name) { await page.screenshot({ path: path.join(OUT, name), fullPage: true }); }

async function assertMovingLineCenterHitTest(page, position, label) {
  const selector = `[data-moving-line-position="${position}"]`;
  await page.$eval(selector, (node) => node.scrollIntoView({ block: "center", inline: "center", behavior: "instant" }));
  await page.waitForFunction((targetSelector) => {
    const target = document.querySelector(targetSelector);
    if (!(target instanceof HTMLElement)) return false;
    const rect = target.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    return hit === target || Boolean(hit && target.contains(hit));
  }, {}, selector);
  if (label) log(label + ": Line " + position + " center hit-test PASS");
}

async function clickMovingLine(page, position, expectedPressed = "true") {
  const selector = `[data-moving-line-position="${position}"]`;
  await assertMovingLineCenterHitTest(page, position);
  await page.click(selector);
  await page.waitForFunction(
    (targetSelector, expected) => document.querySelector(targetSelector)?.getAttribute("aria-pressed") === expected,
    {},
    selector,
    expectedPressed,
  );
}

async function exerciseModeA(page, config) {
  const route = config.locale === "zh" ? "/zh/methods/manual-cast" : "/methods/manual-cast";
  const question = config.locale === "zh" ? "我是否应该换一份新的工作？" : "Should I change to a new job?";
  const prefix = config.locale === "zh" ? "44665545" : "44665544";
  await page.setViewport({ width: config.width, height: config.height });
  await seedQuestion(page, route, fixtureId(prefix, config.width), question);
  const order = await page.$$eval("[data-line-row-position]", nodes => nodes.map(node => Number(node.getAttribute("data-line-row-position"))));
  assert.deepEqual(order, [6,5,4,3,2,1], config.locale + "/" + config.width + ": line order");
  assert.equal(await page.$("select"), null, config.locale + "/" + config.width + ": native select must not be used");
  assert.equal(await page.$('input[type="checkbox"]'), null, config.locale + "/" + config.width + ": checkbox moving-line UI must not be used");
  const questionText = await page.$eval("[data-manual-question]", el => el.textContent || "");
  assert(questionText.includes(question), config.locale + "/" + config.width + ": question must be preserved");
  await page.focus('[data-manual-mode="line-values"]');
  await page.keyboard.press("ArrowRight");
  await page.waitForSelector("[data-manual-primary-changing-panel]");
  assert.equal(await page.$eval('[data-manual-mode="primary-changing"]', el => el.getAttribute("aria-selected")), "true", "ArrowRight must activate second mode");
  const focusOutline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  assert.notEqual(focusOutline, "none", "keyboard focus must remain visible");
  await page.keyboard.press("ArrowLeft");
  await page.waitForSelector("[data-manual-line-values-panel]");
  assert.equal(await page.$eval('[data-manual-mode="line-values"]', el => el.getAttribute("aria-selected")), "true", "ArrowLeft must reactivate first mode");
  await page.click('[data-line-position="4"][data-line-value="9"]');
  await page.waitForFunction(() => document.querySelector('[data-line-position="4"][data-line-value="9"]')?.getAttribute("aria-pressed") === "true");
  await page.click('[data-line-position="2"][data-line-value="6"]');
  await page.waitForFunction(() => document.querySelector('[data-line-position="2"][data-line-value="6"]')?.getAttribute("aria-pressed") === "true");
  await assertNoOverflow(page, config.locale + "/" + config.width + "/mode-a");
  if (config.width <= 390) await assertTouchTargets(page, config.locale + "/" + config.width + "/mode-a");
  if (config.captureName) await capture(page, config.captureName);
}

async function exerciseModeBAndRestore(page, config) {
  const route = config.locale === "zh" ? "/zh/methods/manual-cast" : "/methods/manual-cast";
  const question = config.locale === "zh" ? "我是否应该换一份新的工作？" : "Should I change to a new job?";
  const prefix = config.locale === "zh" ? "44665547" : "44665546";
  await page.setViewport({ width: config.width, height: config.height });
  await seedQuestion(page, route, fixtureId(prefix, config.width), question);
  await page.click('[data-manual-mode="primary-changing"]');
  await page.waitForSelector("[data-manual-primary-changing-panel]");
  assert.equal(await page.$eval("[data-relating-hexagram-number]", el => el.getAttribute("data-relating-hexagram-number")), "none", config.locale + "/" + config.width + ": zero moving lines must be legal");
  await page.focus("[data-hexagram-picker-trigger]");
  await page.keyboard.press("Enter");
  await page.waitForSelector('[role="option"]');
  assert.equal((await page.$$('[role="option"]')).length, 64, config.locale + "/" + config.width + ": picker count");
  if (config.width <= 390) {
    const optionHeights = await page.$$eval('[role="option"]', nodes => nodes.slice(0, 6).map(node => node.getBoundingClientRect().height));
    assert(optionHeights.every(height => height >= 44), config.locale + "/" + config.width + ": picker options must be touchable");
  }
  await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "option");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.querySelector('[role="option"]'));
  assert((await page.$eval("[data-hexagram-picker-trigger]", el => el.textContent || "")).includes("2"), config.locale + "/" + config.width + ": keyboard picker must select Hexagram 2");
  if (config.width <= 390) {
    const label = config.locale + "/" + config.width + "/mode-b";
    for (const position of [1,2,3,4,5,6]) {
      await assertMovingLineCenterHitTest(page, position, label);
    }
  }
  await clickMovingLine(page, 3);
  await clickMovingLine(page, 5);
  const relating = await page.$eval("[data-relating-hexagram-number]", el => el.getAttribute("data-relating-hexagram-number"));
  assert(relating && relating !== "none", config.locale + "/" + config.width + ": relating preview");
  await page.reload({ waitUntil: "networkidle0", timeout: 30000 });
  await page.waitForSelector("[data-reading-resume-action]", { timeout: 10000 });
  await page.click("[data-reading-resume-action]");
  await page.waitForSelector("[data-manual-primary-changing-panel]", { timeout: 10000 });
  assert.equal(await page.$eval('[data-manual-mode="primary-changing"]', el => el.getAttribute("aria-selected")), "true", "mode restore");
  assert.equal(await page.$eval('[data-moving-line-position="3"]', el => el.getAttribute("aria-pressed")), "true", "line 3 restore");
  assert.equal(await page.$eval('[data-moving-line-position="5"]', el => el.getAttribute("aria-pressed")), "true", "line 5 restore");
  assert.equal(await page.$eval("[data-relating-hexagram-number]", el => el.getAttribute("data-relating-hexagram-number")), relating, "preview restore");
  await assertNoOverflow(page, config.locale + "/" + config.width + "/mode-b");
  if (config.width <= 390) await assertTouchTargets(page, config.locale + "/" + config.width + "/mode-b");
  if (config.captureName) await capture(page, config.captureName);
}

async function verifyContinueHandoff(page, locale) {
  const route = locale === "zh" ? "/zh/methods/manual-cast" : "/methods/manual-cast";
  const resultPath = locale === "zh" ? "/zh/readings/choice" : "/readings/choice";
  const question = locale === "zh" ? "我现在是否适合换一份工作？" : "Should I change to a new job?";
  const id = locale === "zh" ? "750e8400-e29b-41d4-a716-446655440001" : "750e8400-e29b-41d4-a716-446655440002";
  await page.setViewport({ width: 1024, height: 900 });
  await seedQuestion(page, route, id, question);
  await page.click('[data-line-position="4"][data-line-value="9"]');
  await page.click('[data-line-position="2"][data-line-value="6"]');
  await Promise.all([
    page.waitForFunction((expected) => location.pathname === expected, { timeout: 15000 }, resultPath),
    page.click("[data-manual-continue]"),
  ]);
  await page.waitForSelector("[data-result-choice]", { timeout: 10000 });
  const state = await page.evaluate((input) => ({
    completed: JSON.parse(localStorage.getItem(input.pendingPrefix + (new URLSearchParams(location.search).get("session") || "")) || "null"),
    current: JSON.parse(sessionStorage.getItem(input.sessionKey) || "null"),
    draft: sessionStorage.getItem(input.draftKey),
  }), { pendingPrefix: PENDING_PREFIX, sessionKey: SESSION_KEY, draftKey: DRAFT_KEY });
  assert(state.completed, locale + ": exact pending reading missing");
  assert.equal(state.completed.readingId, id);
  assert.equal(state.completed.method, "manual");
  assert.equal(state.completed.evidence.mode, "line-values");
  assert.equal(state.completed.question, question);
  assert.deepEqual(state.completed.lineValuesBottomUp, [7,6,7,9,7,7]);
  assert.equal(state.current, null, "Manual method session must be retired after handoff");
  assert.equal(state.draft, null);
}

async function verifyPrimaryChangingHandoff(page) {
  const id = "850e8400-e29b-41d4-a716-446655440001";
  await page.setViewport({ width: 1024, height: 900 });
  await seedQuestion(page, "/methods/manual-cast", id, "Should I continue with this plan?");
  await page.click('[data-manual-mode="primary-changing"]');
  await page.click("[data-hexagram-picker-trigger]");
  await page.click('[data-hexagram-number="2"]');
  await clickMovingLine(page, 3);
  await clickMovingLine(page, 5);
  await Promise.all([
    page.waitForFunction(() => location.pathname === "/readings/choice", { timeout: 15000 }),
    page.click("[data-manual-continue]"),
  ]);
  await page.waitForSelector("[data-result-choice]", { timeout: 10000 });
  const completed = await page.evaluate((prefix) => JSON.parse(localStorage.getItem(prefix + (new URLSearchParams(location.search).get("session") || "")) || "null"), PENDING_PREFIX);
  assert.equal(completed.evidence.mode, "primary-changing");
  assert.equal(completed.evidence.primaryHexagramNumber, 2);
  assert.deepEqual(completed.evidence.changingLines, [3,5]);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const runtime = await resolveChromeExecutable(chromium);
  const browser = await puppeteer.launch({
    args: runtime.usingSystemChrome ? ["--no-sandbox","--disable-dev-shm-usage"] : [...chromium.args,"--disable-dev-shm-usage"],
    executablePath: runtime.executablePath, headless: true,
  });
  try {
    const page = await browser.newPage();
    for (const config of [
      { locale:"en", width:1440, height:900, captureName:"desktop-en-enter-six-lines.png" },
      { locale:"zh", width:1440, height:900, captureName:"desktop-zh-enter-six-lines.png" },
      { locale:"en", width:390, height:844, captureName:"mobile-en-enter-six-lines.png" },
      { locale:"zh", width:390, height:844, captureName:"mobile-zh-enter-six-lines.png" },
    ]) await exerciseModeA(page, config);
    for (const config of [
      { locale:"en", width:1440, height:900, captureName:"desktop-en-choose-hexagram.png" },
      { locale:"zh", width:1440, height:900, captureName:"desktop-zh-choose-hexagram.png" },
      { locale:"en", width:390, height:844, captureName:"mobile-en-choose-hexagram.png" },
      { locale:"zh", width:390, height:844, captureName:"mobile-zh-choose-hexagram.png" },
    ]) await exerciseModeBAndRestore(page, config);
    for (const width of [1024,375,320]) {
      await exerciseModeA(page, { locale:"en", width, height: width === 1024 ? 900 : 780 });
      await exerciseModeBAndRestore(page, { locale:"en", width, height: width === 1024 ? 900 : 780 });
    }
    await verifyContinueHandoff(page, "en");
    await verifyContinueHandoff(page, "zh");
    await verifyPrimaryChangingHandoff(page);
    log("PASS: EN/ZH desktop + mobile, 1440/1024/390/375/320, both modes, restore, deterministic preview, and shared result handoff.");
  } finally { await browser.close(); }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
