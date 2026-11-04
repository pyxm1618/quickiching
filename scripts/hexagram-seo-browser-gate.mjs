import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { HEXAGRAM_SEO_REGISTRY } from "../src/content/hexagrams/seo.ts";
import { CLASSICAL_HEXAGRAMS } from "../src/domain/public-reading/classical.ts";
import { resolveChromeExecutable } from "./browser-runtime.mjs";

const BASE = process.env.HEXAGRAM_SEO_BROWSER_BASE_URL || process.env.PUBLIC_V1_TEST_BASE_URL || "http://127.0.0.1:3000";
const ORIGIN = "https://www.quickiching.com";
const sampleNumbers = [1, 23, 52, 54, 61, 64];
const randomNumbers = [7, 31, 48, 63];

function log(message) {
  console.log(`[Hexagram SEO Browser Gate] ${message}`);
}

async function gotoWithRetry(page, url, options = { waitUntil: "load", timeout: 60_000 }) {
  try {
    return await page.goto(url, options);
  } catch (error) {
    const navigationTimeout = error?.name === "TimeoutError" || String(error).includes("Navigation timeout");
    if (!navigationTimeout) throw error;
    log(`Navigation timeout for ${new URL(url).pathname}; retrying once without weakening assertions`);
    await page.evaluate(() => window.stop()).catch(() => {});
    return page.goto(url, options);
  }
}

function entryFor(number, locale) {
  const entry = HEXAGRAM_SEO_REGISTRY.find((candidate) => candidate.number === number && candidate.locale === locale);
  if (!entry) throw new Error(`Missing registry entry ${locale}:${number}`);
  return entry;
}

function pathFor(entry) {
  return new URL(entry.canonicalUrl).pathname;
}

function expectedAlternates(entry) {
  return {
    en: `${ORIGIN}/hexagrams/${entry.slug}`,
    "zh-Hans": `${ORIGIN}/zh/hexagrams/${entry.slug}`,
    "x-default": `${ORIGIN}/hexagrams/${entry.slug}`,
  };
}

function assertAlternateMap(actual, expected, label) {
  assert.deepEqual(Object.fromEntries(actual.map((value) => [value.hreflang, value.href])), expected, `${label}: reciprocal hreflang mismatch`);
}

async function extractSnapshot(page) {
  return page.evaluate(() => {
    const root = document.querySelector("main article[data-hexagram-detail]");
    const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')].map((node) => {
      try { return JSON.parse(node.textContent ?? "null"); } catch { return null; }
    });
    return {
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
      robots: document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? "",
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? "",
      ogUrl: document.querySelector('meta[property="og:url"]')?.getAttribute("content") ?? "",
      h1: [...document.querySelectorAll("h1")].map((node) => node.textContent?.trim() ?? ""),
      lineAnchors: Array.from({ length: 6 }, (_, index) => document.querySelector(`#line-${index + 1}`) !== null),
      detailInboundAnchorCount: root?.querySelectorAll("[data-seo-inbound-anchor]").length ?? 0,
      alternates: [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((node) => ({ hreflang: node.getAttribute("hreflang"), href: node.getAttribute("href") })),
      htmlLang: document.documentElement.lang,
      internalHrefs: [...(root?.querySelectorAll("a[href]") ?? [])].map((node) => new URL(node.getAttribute("href") ?? "", location.href).pathname),
      jsonLd,
      rootPresent: Boolean(root),
    };
  });
}

function assertSnapshot(entry, snapshot) {
  const path = pathFor(entry);
  assert(snapshot.rootPresent, `${path}: static detail root missing`);
  assert.equal(snapshot.title, entry.finalTitle, `${path}: exact title mismatch`);
  assert.equal(snapshot.description, entry.finalDescription, `${path}: exact description mismatch`);
  assert.match(snapshot.robots, /\bindex\b/iu, `${path}: missing index robots directive`);
  assert.match(snapshot.robots, /\bfollow\b/iu, `${path}: missing follow robots directive`);
  assert.doesNotMatch(snapshot.robots, /\bnoindex\b/iu, `${path}: detail page is noindex`);
  assert.equal(snapshot.canonical, entry.canonicalUrl, `${path}: canonical mismatch`);
  assert.equal(snapshot.ogUrl, entry.canonicalUrl, `${path}: og:url mismatch`);
  assert.deepEqual(snapshot.h1, [entry.finalH1], `${path}: H1 is not unique/exact`);
  assert(snapshot.lineAnchors.every(Boolean), `${path}: line anchors incomplete`);
  assert.equal(snapshot.detailInboundAnchorCount, 0, `${path}: detail page contains a fake inbound-anchor marker`);
  assert.equal(snapshot.htmlLang, entry.locale === "zh-Hans" ? "zh-Hans" : "en", `${path}: html lang mismatch`);
  assertAlternateMap(snapshot.alternates, expectedAlternates(entry), path);

  const graph = snapshot.jsonLd.flatMap((value) => Array.isArray(value?.["@graph"]) ? value["@graph"] : []);
  const webPage = graph.find((value) => value?.["@type"] === "WebPage");
  const breadcrumb = graph.find((value) => value?.["@type"] === "BreadcrumbList");
  assert(webPage, `${path}: WebPage JSON-LD missing`);
  assert.equal(webPage.url, entry.canonicalUrl, `${path}: WebPage JSON-LD URL mismatch`);
  assert.equal(webPage.inLanguage, entry.locale === "zh-Hans" ? "zh-Hans" : "en", `${path}: JSON-LD language mismatch`);
  assert(breadcrumb, `${path}: BreadcrumbList JSON-LD missing`);
  assert.equal(breadcrumb.itemListElement?.[1]?.item, entry.canonicalUrl, `${path}: BreadcrumbList URL mismatch`);

  const hrefs = new Set(snapshot.internalHrefs);
  const previous = CLASSICAL_HEXAGRAMS.find((candidate) => candidate.slug === entry.slug)?.number;
  assert(hrefs.has(entry.locale === "zh-Hans" ? "/zh/hexagrams" : "/hexagrams"), `${path}: locale hub link missing`);
  assert(!hrefs.has("/methods/manual-cast"), `${path}: knowledge detail must not contain a reading CTA`);
  assert(!hrefs.has("/zh/methods/mei-hua-yi-shu"), `${path}: retired Chinese detail CTA still present`);
  assert(![...hrefs].some((href) => /\/hexagrams\/\d+(?:$|\/)/u.test(href)), `${path}: numeric hexagram alias link found`);
  assert(![...hrefs].some((href) => /\/line-[1-6](?:$|\/)/u.test(href)), `${path}: separate line URL found`);
  if (previous > 1) {
    const classicalIndex = CLASSICAL_HEXAGRAMS.findIndex((candidate) => candidate.slug === entry.slug);
    const expectedPrevious = CLASSICAL_HEXAGRAMS[classicalIndex - 1];
    assert(hrefs.has((entry.locale === "zh-Hans" ? "/zh" : "") + "/hexagrams/" + expectedPrevious.slug), `${path}: previous entity link missing`);
  }
  if (previous < 64) {
    const classicalIndex = CLASSICAL_HEXAGRAMS.findIndex((candidate) => candidate.slug === entry.slug);
    const expectedNext = CLASSICAL_HEXAGRAMS[classicalIndex + 1];
    assert(hrefs.has((entry.locale === "zh-Hans" ? "/zh" : "") + "/hexagrams/" + expectedNext.slug), `${path}: next entity link missing`);
  }
}

async function assertNoOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  assert(dimensions.scrollWidth <= dimensions.clientWidth + 1, `${label}: horizontal overflow ${dimensions.scrollWidth} > ${dimensions.clientWidth}`);
}

async function assertNoTextClipping(page, label) {
  const clipped = await page.evaluate(() => {
    const root = document.querySelector("[data-hexagram-detail]");
    if (!root) return ["detail-root-missing"];
    return [...root.querySelectorAll("h1, h2, h3, h4, p, blockquote, dt, dd, a")]
      .filter((node) => {
        if (!(node instanceof HTMLElement)) return false;
        const style = getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden" || node.clientWidth === 0 || node.clientHeight === 0) return false;
        const clipsX = style.overflowX === "hidden" || style.overflowX === "clip";
        const clipsY = style.overflowY === "hidden" || style.overflowY === "clip";
        return (clipsX && node.scrollWidth > node.clientWidth + 1) || (clipsY && node.scrollHeight > node.clientHeight + 1);
      })
      .map((node) => (node.textContent ?? "").replace(/\s+/gu, " ").trim().slice(0, 100));
  });
  assert.deepEqual(clipped, [], label + ': clipped visible text detected');
}
async function assertKeyboardFocus(page, label) {
  await page.evaluate(() => {
    document.body.tabIndex = -1;
    document.body.focus();
  });
  await page.keyboard.press("Tab");
  const focus = await page.evaluate(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return null;
    const rect = active.getBoundingClientRect();
    const style = window.getComputedStyle(active);
    return {
      visible: rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none",
      focusStyle: style.outlineStyle !== "none" || style.boxShadow !== "none",
    };
  });
  assert(focus?.visible, `${label}: Tab did not move focus to a visible control`);
  assert(focus?.focusStyle, `${label}: focused control has no visible focus treatment`);
}

const { executablePath, usingSystemChrome } = await resolveChromeExecutable(chromium);
const browser = await puppeteer.launch({
  args: usingSystemChrome ? ["--no-sandbox", "--disable-dev-shm-usage"] : [...chromium.args, "--disable-dev-shm-usage"],
  executablePath,
  headless: true,
});

try {
  const page = await browser.newPage();
  const detailPageErrors = [];
  page.on("pageerror", (error) => detailPageErrors.push(String(error)));
  await page.setViewport({ width: 1440, height: 1000 });
  for (const entry of HEXAGRAM_SEO_REGISTRY) {
    const desktopErrorStart = detailPageErrors.length;
    const response = await gotoWithRetry(page, `${BASE}${pathFor(entry)}`, { waitUntil: "load", timeout: 30_000 });
    assert([200, 304].includes(response?.status()), `${pathFor(entry)}: expected 200 or 304, got ${response?.status()}`);
    assertSnapshot(entry, await extractSnapshot(page));
    await assertNoOverflow(page, `${pathFor(entry)} 1440px`);
    await assertNoTextClipping(page, `${pathFor(entry)} 1440px`);
    const desktopH1Fits = await page.$eval("h1", (node) => {
      const rect = node.getBoundingClientRect();
      return rect.left >= -1 && rect.right <= document.documentElement.clientWidth + 1;
    });
    assert(desktopH1Fits, `${pathFor(entry)} 1440px: H1 exceeds viewport`);
    assert.deepEqual(detailPageErrors.slice(desktopErrorStart), [], `${pathFor(entry)} 1440px: runtime page errors`);
  }
  log("128/128 production detail DOM, exact metadata and locale-specific H1, canonical, hreflang, JSON-LD, line anchors, internal links, and no-alias checks PASS");

  for (const number of [...sampleNumbers, ...randomNumbers]) {
    const en = entryFor(number, "en");
    const zh = entryFor(number, "zh-Hans");
    for (const entry of [en, zh]) {
      await gotoWithRetry(page, `${BASE}${pathFor(entry)}`, { waitUntil: "load", timeout: 30_000 });
      // The approved shared detail scroll supplies local section/sequence navigation and hides the site header in both locales.
      assert.equal(await page.$eval("body > header", (node) => node.getBoundingClientRect().height), 0, `${pathFor(entry)}: site header must remain hidden on the shared detail scroll`);
      await assertKeyboardFocus(page, pathFor(entry));
    }
  }
  log("20 sampled EN/ZH shared detail scroll header-isolation and keyboard-focus checks PASS");

  for (const [path, expectedPrefix] of [["/hexagrams", "/hexagrams/"], ["/zh/hexagrams", "/zh/hexagrams/"]]) {
    await gotoWithRetry(page, `${BASE}${path}`, { waitUntil: "load", timeout: 30_000 });
    const links = await page.$$eval(`a[href^="${expectedPrefix}"]`, (nodes) => nodes.map((node) => new URL(node.getAttribute("href") ?? "", location.href).pathname));
    assert.equal(new Set(links).size, 64, `${path}: Hub must link exactly 64 detail pages`);
    const hubH1 = await page.$eval("h1", (node) => node.textContent?.trim() ?? "");
    assert(hubH1.length > 0, `${path}: Hub H1 missing`);
    const hubEntries = HEXAGRAM_SEO_REGISTRY.filter((entry) => (path === "/zh/hexagrams" ? entry.locale === "zh-Hans" : entry.locale === "en"));
    const inbound = await page.$$eval("a[data-seo-inbound-anchor][href]", (nodes) => nodes.map((node) => ({
      href: new URL(node.getAttribute("href") ?? "", location.href).pathname,
      primary: node.getAttribute("data-seo-inbound-anchor") ?? "",
      text: node.textContent?.replace(/\s+/gu, " ").trim() ?? "",
    })));
    assert.equal(inbound.length, 64, `${path}: expected 64 marked Hub-to-detail anchors`);
    for (const entry of hubEntries) {
      const target = pathFor(entry);
      const anchor = inbound.find((candidate) => candidate.href === target);
      assert(anchor, `${path}: missing Hub-to-detail anchor for ${target}`);
      assert.equal(anchor.primary, entry.primaryKeyword, `${path}: inbound data marker mismatch for ${target}`);
      assert(anchor.text.toLocaleLowerCase().includes(entry.primaryKeyword.toLocaleLowerCase()), `${path}: visible inbound anchor omits ${entry.primaryKeyword}`);
    }
  }
  const chineseHubStatus = await gotoWithRetry(page, `${BASE}/zh/hexagrams`, { waitUntil: "load", timeout: 30_000 });
  assert([200, 304].includes(chineseHubStatus?.status() ?? 0), `Chinese Hub must be reachable, received ${chineseHubStatus?.status()}`);
  const hasPendingResearch = await page.evaluate(() => document.body.innerHTML.includes("PENDING_RESEARCH"));
  assert(!hasPendingResearch, "Chinese Hub must not contain legacy PENDING_RESEARCH marker");
  log("English and Chinese Hub → 64 detail links, reachable Chinese Hub, and no PENDING_RESEARCH marker PASS");

  {
    // The exhaustive detail pass performs hundreds of navigations. Run the
    // interactive Hub acceptance in a fresh page so browser state accumulated
    // by detail auditing cannot turn a correct Hub into a CI navigation timeout.
    const page = await browser.newPage();
    try {
      for (const [path, locale, expectedPrefix] of [
        ["/hexagrams", "en", "/hexagrams/"],
        ["/zh/hexagrams", "zh-Hans", "/zh/hexagrams/"],
      ]) {
    const runtimeErrors = [];
    const onConsole = (message) => {
      if (message.type() === "error") runtimeErrors.push("console: " + message.text());
    };
    const onPageError = (error) => runtimeErrors.push("pageerror: " + error.message);
    page.on("console", onConsole);
    page.on("pageerror", onPageError);
    try {
      await page.setViewport({ width: 1669, height: 942 });
      await gotoWithRetry(page, `${BASE}${path}`, { waitUntil: "load", timeout: 30_000 });
      await page.waitForSelector("[data-hexagrams-immersive-page]");
      const desktop = await page.evaluate(() => ({
        locale: document.querySelector("[data-hexagrams-immersive-page]")?.getAttribute("data-hexagrams-locale") ?? "",
        scrollCount: document.querySelectorAll("[data-scroll-hexagram]").length,
        wheelCount: document.querySelectorAll("[data-wheel-index]").length,
        selected: document.querySelector("[data-wheel-index][aria-current='true']")?.getAttribute("data-wheel-index") ?? "",
      }));
      assert.equal(desktop.locale, locale, `${path}: shared Hub locale marker mismatch`);
      assert.equal(desktop.scrollCount, 64, `${path}: 8×8 selector must expose 64 items`);
      assert.equal(desktop.wheelCount, 64, `${path}: wheel must expose 64 items`);
      assert.equal(desktop.selected, "0", `${path}: Hexagram 1 must be initially selected`);
      await assertNoOverflow(page, `${path} Hub 1669px`);

      await page.$eval('[data-scroll-hexagram="64"]', (node) => node.click());
      await page.waitForFunction(() => document.querySelector('[data-wheel-index="63"]')?.getAttribute("aria-current") === "true");
      await page.focus("[data-hexagram-wheel]");
      await page.keyboard.press("ArrowRight");
      await page.waitForFunction(() => document.querySelector('[data-wheel-index="0"]')?.getAttribute("aria-current") === "true");
      await page.keyboard.press("ArrowLeft");
      await page.waitForFunction(() => document.querySelector('[data-wheel-index="63"]')?.getAttribute("aria-current") === "true");
      await page.keyboard.press("ArrowRight");
      await page.waitForFunction(() => document.querySelector('[data-wheel-index="0"]')?.getAttribute("aria-current") === "true");

      await new Promise((resolve) => setTimeout(resolve, 300));
      const wheelBox = await page.$eval("[data-hexagram-wheel]", (node) => {
        const rect = node.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      });
      await page.mouse.move(wheelBox.x + wheelBox.width * 0.55, wheelBox.y + wheelBox.height * 0.55);
      await page.mouse.wheel({ deltaY: 120 });
      await page.waitForFunction(() => document.querySelector('[data-wheel-index="1"]')?.getAttribute("aria-current") === "true");

      await page.$eval('[data-scroll-hexagram="1"]', (node) => node.click());
      await page.waitForFunction(() => document.querySelector('[data-wheel-index="0"]')?.getAttribute("aria-current") === "true");
      await page.mouse.move(wheelBox.x + wheelBox.width * 0.82, wheelBox.y + wheelBox.height * 0.72);
      await page.mouse.down();
      await page.mouse.move(wheelBox.x + wheelBox.width * 0.82 - 150, wheelBox.y + wheelBox.height * 0.72, { steps: 6 });
      await page.mouse.up();
      await page.waitForFunction(() => document.querySelector('[data-wheel-index][aria-current="true"]')?.getAttribute("data-wheel-index") !== "0");

      await page.setViewport({ width: 390, height: 844 });
      await gotoWithRetry(page, `${BASE}${path}`, { waitUntil: "load", timeout: 30_000 });
      await page.waitForSelector("[data-hexagram-wheel]");
      await assertNoOverflow(page, `${path} Hub 390px`);
      await page.focus("[data-hexagram-wheel]");
      await page.keyboard.press("ArrowLeft");
      await page.waitForFunction(() => document.querySelector('[data-wheel-index="63"]')?.getAttribute("aria-current") === "true");
    } finally {
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
    }
    assert.deepEqual(runtimeErrors, [], `${path}: Hub console/page errors detected`);

    await page.setViewport({ width: 1669, height: 942 });
    await gotoWithRetry(page, `${BASE}${path}`, { waitUntil: "load", timeout: 30_000 });
    const beforePath = new URL(page.url()).pathname;
    await page.$eval('[data-wheel-index="1"]', (node) => node.click());
    await page.waitForFunction(() => document.querySelector('[data-wheel-index="1"]')?.getAttribute("aria-current") === "true");
    assert.equal(new URL(page.url()).pathname, beforePath, `${path}: adjacent wheel card click must select without navigating`);
    await Promise.all([
      page.waitForNavigation({ waitUntil: "load", timeout: 30_000 }),
      page.$eval('[data-wheel-index="1"]', (node) => node.click()),
    ]);
    assert.equal(new URL(page.url()).pathname, expectedPrefix + CLASSICAL_HEXAGRAMS[1].slug, `${path}: current card must navigate to locale detail route`);
      }
      log("English and Chinese immersive Hub data, sync, full-cycle keyboard, wheel, drag, mobile, navigation and zero-error checks PASS");
    } finally {
      await page.close();
    }
  }

  for (const entry of HEXAGRAM_SEO_REGISTRY) {
    const mobileErrorStart = detailPageErrors.length;
    await page.setViewport({ width: 390, height: 844 });
    await gotoWithRetry(page, `${BASE}${pathFor(entry)}`, { waitUntil: "load", timeout: 30_000 });
    await assertNoOverflow(page, `${pathFor(entry)} 390px`);
    await assertNoTextClipping(page, `${pathFor(entry)} 390px`);
    const h1Fits = await page.$eval("h1", (node) => {
      const rect = node.getBoundingClientRect();
      return rect.left >= -1 && rect.right <= document.documentElement.clientWidth + 1;
    });
    assert(h1Fits, `${pathFor(entry)} 390px: H1 exceeds viewport`);
    assert.deepEqual(detailPageErrors.slice(mobileErrorStart), [], `${pathFor(entry)} 390px: runtime page errors`);
  }
  log("128/128 mobile-width detail readability, overflow and runtime-error checks PASS");
} finally {
  await browser.close();
}
