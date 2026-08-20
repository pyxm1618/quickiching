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
  assert(hrefs.has(entry.locale === "zh-Hans" ? "/zh/methods/mei-hua-yi-shu" : "/methods/manual-cast"), `${path}: locale reading CTA missing`);
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

const { executablePath, usingSystemChrome } = await resolveChromeExecutable(chromium);
const browser = await puppeteer.launch({
  args: usingSystemChrome ? ["--no-sandbox", "--disable-dev-shm-usage"] : [...chromium.args, "--disable-dev-shm-usage"],
  executablePath,
  headless: true,
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  for (const entry of HEXAGRAM_SEO_REGISTRY) {
    const response = await page.goto(`${BASE}${pathFor(entry)}`, { waitUntil: "networkidle0", timeout: 30_000 });
    assert.equal(response?.status(), 200, `${pathFor(entry)}: expected 200, got ${response?.status()}`);
    assertSnapshot(entry, await extractSnapshot(page));
  }
  log("128/128 production detail DOM, exact TDH, canonical, hreflang, JSON-LD, line anchors, internal links, and no-alias checks PASS");

  for (const number of [...sampleNumbers, ...randomNumbers]) {
    const en = entryFor(number, "en");
    const zh = entryFor(number, "zh-Hans");
    for (const [entry, targetPath] of [[en, `/zh/hexagrams/${en.slug}`], [zh, `/hexagrams/${zh.slug}`]]) {
      await page.goto(`${BASE}${pathFor(entry)}`, { waitUntil: "networkidle0", timeout: 30_000 });
      const target = await page.$eval("header [data-language-switch]", (node) => ({ href: node.getAttribute("href"), equivalent: node.getAttribute("data-equivalent") }));
      assert.equal(target.href, targetPath, `${pathFor(entry)}: language switch target mismatch`);
      assert.equal(target.equivalent, "true", `${pathFor(entry)}: language switch is not equivalent`);
      assert.equal(await page.$$eval("header [data-language-switch]", (nodes) => nodes.length), 1, `${pathFor(entry)}: language switcher count mismatch`);
    }
  }
  log("10 sampled paired language switches (including 1, 23, 52, 54, 61, 64) PASS");

  for (const [path, expectedPrefix] of [["/hexagrams", "/hexagrams/"], ["/zh/hexagrams", "/zh/hexagrams/"]]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0", timeout: 30_000 });
    const links = await page.$$eval(`a[href^="${expectedPrefix}"]`, (nodes) => nodes.map((node) => new URL(node.getAttribute("href") ?? "", location.href).pathname));
    assert.equal(new Set(links).size, 64, `${path}: Hub must link exactly 64 detail pages`);
    const hubH1 = await page.$eval("h1", (node) => node.textContent?.trim() ?? "");
    assert(hubH1.length > 0, `${path}: Hub H1 missing`);
  }
  const chineseHubStatus = await page.goto(`${BASE}/zh/hexagrams`, { waitUntil: "networkidle0", timeout: 30_000 });
  assert([200, 304].includes(chineseHubStatus?.status() ?? 0), `Chinese Hub must be reachable, received ${chineseHubStatus?.status()}`);
  assert.equal(await page.$eval("[data-tdh-status]", (node) => node.getAttribute("data-tdh-status")), "PENDING_RESEARCH", "Chinese Hub TDH status must remain PENDING_RESEARCH");
  log("English and Chinese Hub → 64 detail links, reachable Chinese Hub, and PENDING_RESEARCH marker PASS");

  for (const entry of HEXAGRAM_SEO_REGISTRY.filter((candidate) => sampleNumbers.includes(candidate.number))) {
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(`${BASE}${pathFor(entry)}`, { waitUntil: "networkidle0", timeout: 30_000 });
    await assertNoOverflow(page, `${pathFor(entry)} 390px`);
    const h1Fits = await page.$eval("h1", (node) => {
      const rect = node.getBoundingClientRect();
      return rect.left >= -1 && rect.right <= document.documentElement.clientWidth + 1;
    });
    assert(h1Fits, `${pathFor(entry)} 390px: H1 exceeds viewport`);
  }
  log("Sample mobile-width detail readability and overflow checks PASS");
} finally {
  await browser.close();
}
