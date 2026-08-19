import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { resolveChromeExecutable } from "./browser-runtime.mjs";

const BASE = process.env.MULTILINGUAL_TEST_BASE_URL || "http://127.0.0.1:3000";
const CANONICAL_ORIGIN = "https://www.quickiching.com";
const CHINESE_QUESTION = "这次变化中，我应该先守住什么？";

function log(message) {
  console.log(`[Multilingual Browser Gate] ${message}`);
}

async function fetchManual(path, init = {}) {
  return fetch(`${BASE}${path}`, { redirect: "manual", ...init });
}

async function expectStatus(path, expected, init = {}) {
  const response = await fetchManual(path, init);
  assert.equal(response.status, expected, `${path}: expected ${expected}, received ${response.status}`);
  return response;
}

function extractTagAttributes(html, tagName) {
  return [...html.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, "gi"))].map((match) => match[0]);
}

function attribute(tag, name) {
  return new RegExp(`\\b${name}=["']([^"']+)["']`, "i").exec(tag)?.[1] ?? null;
}

function normalizeAbsoluteUrl(value) {
  return new URL(value).toString();
}

function normalizeAlternateMap(values) {
  return Object.fromEntries(Object.entries(values).map(([language, url]) => [language, normalizeAbsoluteUrl(url)]));
}

function extractCanonical(html) {
  return extractTagAttributes(html, "link").find((tag) =>
    (attribute(tag, "rel") ?? "").split(/\s+/).some((value) => value.toLowerCase() === "canonical"),
  );
}

function extractAlternates(html) {
  return extractTagAttributes(html, "link")
    .filter((tag) => (attribute(tag, "rel") ?? "").split(/\s+/).includes("alternate"))
    .map((tag) => ({ hreflang: attribute(tag, "hreflang"), href: attribute(tag, "href") }))
    .filter((entry) => entry.hreflang && entry.href);
}

async function verifyHttpBoundaries() {
  const redirects = [
    ["/en", "/"],
    ["/en/methods/mei-hua-yi-shu", "/methods/mei-hua-yi-shu"],
    ["/en/hexagrams/1-the-creative", "/hexagrams/1-the-creative"],
  ];
  for (const [path, destination] of redirects) {
    const response = await expectStatus(path, 308);
    const location = new URL(response.headers.get("location") ?? "", BASE);
    assert.equal(location.pathname, destination, `${path}: wrong redirect destination`);
  }

  for (const path of [
    "/fr",
    "/ja",
    "/zh-Hans",
    "/zh/methods/three-coin",
    "/zh/methods/yarrow-stalks",
    "/zh/methods/manual-cast",
    "/zh/hexagrams",
    "/zh/hexagrams/1-the-creative",
  ]) {
    await expectStatus(path, 404);
  }

  const acceptLanguage = await expectStatus("/", 200, { headers: { "accept-language": "zh-CN,zh;q=0.9" } });
  const acceptLanguageHtml = await acceptLanguage.text();
  assert.match(acceptLanguageHtml, /<html[^>]+lang="en"/i, "Accept-Language must not redirect the English homepage");

  const sitemap = await expectStatus("/sitemap.xml", 200);
  const locs = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.equal(new Set(locs).size, 75, `Sitemap must contain 75 unique URLs, received ${locs.length}`);
  assert.equal(locs.filter((url) => new URL(url).pathname.startsWith("/zh")).length, 2, "Sitemap must contain exactly two Chinese URLs");
  assert.equal(locs.filter((url) => !new URL(url).pathname.startsWith("/zh")).length, 73, "Sitemap must retain the 73 English URLs");
  assert(locs.every((url) => url.startsWith(`${CANONICAL_ORIGIN}/`)), "Sitemap contains a non-canonical origin");
  assert(!locs.some((url) => new URL(url).pathname.startsWith("/en")), "Sitemap must not contain /en URLs");

  const metadataChecks = [
    ["/", "en", `${CANONICAL_ORIGIN}/`, "I Ching Online — Cast Your Hexagram"],
    ["/methods/mei-hua-yi-shu", "en", `${CANONICAL_ORIGIN}/methods/mei-hua-yi-shu`, "Mei Hua Yi Shu"],
    ["/zh", "zh-Hans", `${CANONICAL_ORIGIN}/zh`, "用易经整理问题，回到现实行动"],
    ["/zh/methods/mei-hua-yi-shu", "zh-Hans", `${CANONICAL_ORIGIN}/zh/methods/mei-hua-yi-shu`, "梅花易数时间起卦"],
  ];
  for (const [path, htmlLang, canonical, requiredText] of metadataChecks) {
    const html = await (await expectStatus(path, 200)).text();
    assert.match(html, new RegExp(`<html[^>]+lang="${htmlLang}"`, "i"), `${path}: wrong html lang`);
    assert.equal(normalizeAbsoluteUrl(attribute(extractCanonical(html) ?? "", "href") ?? ""), normalizeAbsoluteUrl(canonical), "wrong canonical: " + path);
    const alternates = Object.fromEntries(extractAlternates(html).map((entry) => [entry.hreflang, entry.href]));
    assert.deepEqual(normalizeAlternateMap(alternates), normalizeAlternateMap({
      en: `${CANONICAL_ORIGIN}${path.startsWith("/zh") ? path.slice(3) || "/" : path}`,
      "zh-Hans": path.startsWith("/zh") ? `${CANONICAL_ORIGIN}${path}` : `${CANONICAL_ORIGIN}/zh${path === "/" ? "" : path}`,
      "x-default": `${CANONICAL_ORIGIN}${path.startsWith("/zh") ? path.slice(3) || "/" : path}`,
    }), "alternate-language links are not the equivalent route set: " + path);
    assert(html.includes(requiredText), `${path}: required page text is missing from initial HTML`);
  }

  const zhHomeHtml = await (await expectStatus("/zh", 200)).text();
  for (const forbidden of ["/zh/methods/three-coin", "/zh/methods/yarrow-stalks", "/zh/methods/manual-cast", "/zh/hexagrams"]) {
    assert(!zhHomeHtml.includes(`href="${forbidden}"`), `Chinese home exposes an unpublished localized path: ${forbidden}`);
  }

  log("HTTP redirects, locale 404s, Accept-Language stability, 75-URL sitemap, metadata, and Chinese scope PASS");
}

function attachFailureCollectors(page) {
  const failures = { consoleErrors: [], pageErrors: [], badResponses: [] };
  page.on("console", (message) => {
    if (message.type() === "error") failures.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => failures.pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.url().startsWith(BASE) && response.status() >= 400) {
      failures.badResponses.push(`${response.status()} ${response.url()}`);
    }
  });
  return failures;
}

async function waitForText(page, text, timeout = 20_000) {
  await page.waitForFunction((value) => document.body?.innerText.includes(value), { timeout }, text);
}

async function clickButton(page, text) {
  const clicked = await page.evaluate((wanted) => {
    const button = [...document.querySelectorAll("button")].find((node) => node.textContent?.trim() === wanted);
    if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
    button.click();
    return true;
  }, text);
  assert(clicked, `Could not click enabled button: ${text}`);
}

async function assertNoOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert(dimensions.scrollWidth <= dimensions.clientWidth + 1, `${label}: horizontal overflow ${dimensions.scrollWidth} > ${dimensions.clientWidth}`);
}

async function fillInput(page, selector, value) {
  await page.$eval(selector, (node, nextValue) => {
    if (!(node instanceof HTMLInputElement)) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(node, nextValue);
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function verifyChineseReading(page, viewport) {
  const label = `${viewport.width}px Chinese Mei Hua`;
  await page.setViewport(viewport);
  await page.goto(`${BASE}/zh`, { waitUntil: "networkidle0", timeout: 30_000 });
  await waitForText(page, "用易经整理问题，回到现实行动");
  await assertNoOverflow(page, `${viewport.width}px Chinese home`);

  await page.goto(`${BASE}/zh/methods/mei-hua-yi-shu`, { waitUntil: "networkidle0", timeout: 30_000 });
  await page.waitForSelector("textarea[data-private-question]");
  await page.type("textarea[data-private-question]", CHINESE_QUESTION);
  await clickButton(page, "继续起卦");
  await page.waitForSelector("#mei-hua-timezone");
  await fillInput(page, "#mei-hua-timezone", "Asia/Shanghai");
  await clickButton(page, "按当前时间起卦");
  await page.waitForSelector("[data-public-reading-result]", { timeout: 20_000 });
  await waitForText(page, "本卦");
  await waitForText(page, "动爻");
  await waitForText(page, "之卦");

  const chineseResult = await page.$eval("[data-public-reading-result]", (node) => ({
    fingerprint: node.getAttribute("data-reading-fingerprint"),
    text: node.textContent ?? "",
  }));
  assert(chineseResult.fingerprint, `${label}: reading fingerprint missing`);
  assert(chineseResult.text.includes("核心主题"), `${label}: Chinese core interpretation missing`);
  assert(chineseResult.text.includes("回到现实"), `${label}: Chinese grounded reflection missing`);
  assert(chineseResult.text.includes("继续反思"), `${label}: Chinese reflection section missing`);
  assert(chineseResult.text.includes(CHINESE_QUESTION), `${label}: Chinese question missing from result`);
  for (const forbidden of ["Your I Ching reading", "Save reading", "Changing Lines", "Personalized Interpretation", "Reveal Your Reading"]) {
    assert(!chineseResult.text.includes(forbidden), `${label}: English-only result text leaked into Chinese result: ${forbidden}`);
  }
  await assertNoOverflow(page, `${label} result`);

  const englishTarget = await page.$eval("[data-language-switch]", (node) => node.getAttribute("href"));
  assert.equal(englishTarget, "/methods/mei-hua-yi-shu", `${label}: language switch must target the equivalent English route`);
  await page.click("[data-language-switch]");
  await page.waitForFunction((path) => location.pathname === path, { timeout: 20_000 }, "/methods/mei-hua-yi-shu");
  await page.waitForSelector("[data-public-reading-result]", { timeout: 20_000 });
  await waitForText(page, "Your I Ching reading");

  const englishResult = await page.$eval("[data-public-reading-result]", (node) => ({
    fingerprint: node.getAttribute("data-reading-fingerprint"),
    text: node.textContent ?? "",
  }));
  assert.equal(englishResult.fingerprint, chineseResult.fingerprint, `${label}: language switch changed reading facts`);
  assert(englishResult.text.includes("Primary"), `${label}: English result did not restore its original UI`);
  assert.equal(await page.$eval("input[data-private-question]", (node) => node.value), CHINESE_QUESTION, `${label}: question changed during language switch`);
  await assertNoOverflow(page, `${label} English result`);

  await page.click("[data-language-switch]");
  await page.waitForFunction((path) => location.pathname === path, { timeout: 20_000 }, "/zh/methods/mei-hua-yi-shu");
  await page.waitForSelector("[data-public-reading-result]", { timeout: 20_000 });
  const returnedChineseFingerprint = await page.$eval("[data-public-reading-result]", (node) => node.getAttribute("data-reading-fingerprint"));
  assert.equal(returnedChineseFingerprint, chineseResult.fingerprint, `${label}: returning to Chinese changed reading facts`);

  log(`${label} PASS`);
}

async function verifyBrowserFlows() {
  const { executablePath, usingSystemChrome } = await resolveChromeExecutable(chromium);
  log(`Launching Chromium at ${executablePath}${usingSystemChrome ? " (system runner)" : " (serverless fallback)"}`);
  const browser = await puppeteer.launch({
    args: usingSystemChrome ? ["--no-sandbox", "--disable-dev-shm-usage"] : [...chromium.args, "--disable-dev-shm-usage"],
    executablePath,
    headless: true,
  });
  try {
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 390, height: 844 },
      { width: 412, height: 915 },
    ]) {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      const failures = attachFailureCollectors(page);
      try {
        await verifyChineseReading(page, viewport);
        assert.deepEqual(failures.consoleErrors, [], `${viewport.width}px console errors: ${failures.consoleErrors.join(" | ")}`);
        assert.deepEqual(failures.pageErrors, [], `${viewport.width}px page errors: ${failures.pageErrors.join(" | ")}`);
        assert.deepEqual(failures.badResponses, [], `${viewport.width}px same-origin 4xx/5xx: ${failures.badResponses.join(" | ")}`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  log("Desktop, iPhone-width, Android-width Chinese flow and cross-language fact-preservation PASS");
}

await verifyHttpBoundaries();
await verifyBrowserFlows();
log("ALL MULTILINGUAL BROWSER/HTTP GATES PASS");
