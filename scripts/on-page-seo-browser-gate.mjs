import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { resolveChromeExecutable } from "./browser-runtime.mjs";

const BASE = process.env.PUBLIC_V1_TEST_BASE_URL || "http://127.0.0.1:3000";
const HEXAGRAM_PATHS = [
  "/hexagrams/1-the-creative", "/hexagrams/2-the-receptive", "/hexagrams/3-difficulty-at-the-beginning", "/hexagrams/4-youthful-folly",
  "/hexagrams/5-waiting", "/hexagrams/6-conflict", "/hexagrams/7-the-army", "/hexagrams/8-holding-together",
  "/hexagrams/9-small-taming", "/hexagrams/10-treading", "/hexagrams/11-peace", "/hexagrams/12-standstill",
  "/hexagrams/13-fellowship", "/hexagrams/14-great-possession", "/hexagrams/15-modesty", "/hexagrams/16-enthusiasm",
  "/hexagrams/17-following", "/hexagrams/18-work-on-the-decayed", "/hexagrams/19-approach", "/hexagrams/20-contemplation",
  "/hexagrams/21-biting-through", "/hexagrams/22-grace", "/hexagrams/23-splitting-apart", "/hexagrams/24-return",
  "/hexagrams/25-innocence", "/hexagrams/26-great-taming", "/hexagrams/27-nourishment", "/hexagrams/28-great-exceeding",
  "/hexagrams/29-the-abysmal-water", "/hexagrams/30-the-clinging-fire", "/hexagrams/31-influence", "/hexagrams/32-duration",
  "/hexagrams/33-retreat", "/hexagrams/34-great-power", "/hexagrams/35-progress", "/hexagrams/36-darkening-of-the-light",
  "/hexagrams/37-the-family", "/hexagrams/38-opposition", "/hexagrams/39-obstruction", "/hexagrams/40-deliverance",
  "/hexagrams/41-decrease", "/hexagrams/42-increase", "/hexagrams/43-breakthrough", "/hexagrams/44-coming-to-meet",
  "/hexagrams/45-gathering-together", "/hexagrams/46-pushing-upward", "/hexagrams/47-oppression", "/hexagrams/48-the-well",
  "/hexagrams/49-revolution", "/hexagrams/50-the-cauldron", "/hexagrams/51-the-arousing-thunder", "/hexagrams/52-keeping-still-mountain",
  "/hexagrams/53-development", "/hexagrams/54-the-marrying-maiden", "/hexagrams/55-abundance", "/hexagrams/56-the-wanderer",
  "/hexagrams/57-the-gentle-wind", "/hexagrams/58-the-joyous-lake", "/hexagrams/59-dispersion", "/hexagrams/60-limitation",
  "/hexagrams/61-inner-truth", "/hexagrams/62-small-exceeding", "/hexagrams/63-after-completion", "/hexagrams/64-before-completion",
];
const INDEXABLE_PATHS = [
  "/",
  "/methods/three-coin",
  "/methods/yarrow-stalks",
  "/methods/mei-hua-yi-shu",
  "/methods/manual-cast",
  "/guides/how-to-ask-the-i-ching",
  "/guides/changing-lines",
  "/guides/primary-relating-hexagrams",
  "/hexagrams",
  ...HEXAGRAM_PATHS,
];
const GUIDE_PATHS = [
  "/guides/how-to-ask-the-i-ching",
  "/guides/changing-lines",
  "/guides/primary-relating-hexagrams",
];
const REQUIRED_INTERNAL_EDGES = {
  "/": [
    "/methods/three-coin",
    "/methods/yarrow-stalks",
    "/methods/mei-hua-yi-shu",
    "/methods/manual-cast",
    "/guides/how-to-ask-the-i-ching",
    "/guides/changing-lines",
    "/guides/primary-relating-hexagrams",
    "/hexagrams",
  ],
  "/methods/three-coin": ["/guides/how-to-ask-the-i-ching", "/guides/changing-lines", "/guides/primary-relating-hexagrams"],
  "/methods/yarrow-stalks": ["/", "/methods/three-coin", "/guides/changing-lines", "/guides/primary-relating-hexagrams"],
  "/methods/mei-hua-yi-shu": ["/", "/hexagrams", "/guides/changing-lines"],
  "/methods/manual-cast": ["/", "/hexagrams", "/guides/changing-lines"],
  "/guides/how-to-ask-the-i-ching": ["/", "/methods/three-coin", "/guides/changing-lines"],
  "/guides/changing-lines": ["/", "/methods/three-coin", "/methods/yarrow-stalks", "/guides/primary-relating-hexagrams"],
  "/guides/primary-relating-hexagrams": ["/", "/methods/three-coin", "/guides/changing-lines", "/hexagrams"],
  "/hexagrams": ["/", "/methods/yarrow-stalks", "/methods/mei-hua-yi-shu"],
};
const VAGUE_ANCHORS = new Set(["click here", "go", "learn more", "read more"]);

function log(message) {
  console.log(`[On-Page SEO Browser Gate] ${message}`);
}

async function assertNoOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  assert(dimensions.scrollWidth <= dimensions.clientWidth + 1, `${label}: horizontal overflow ${dimensions.scrollWidth} > ${dimensions.clientWidth}`);
}

async function collectPageSnapshot(page, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0", timeout: 30_000 });
  return page.evaluate(() => ({
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? "",
    h1: [...document.querySelectorAll("h1")].map((node) => node.textContent?.trim() ?? ""),
    lineAnchors: Array.from({ length: 6 }, (_, index) => document.querySelector(`#line-${index + 1}`) !== null),
    jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].map((node) => {
      try { return JSON.parse(node.textContent ?? "null"); } catch { return null; }
    }).filter(Boolean),
    anchors: [...document.querySelectorAll("a[href]")].map((node) => ({
      text: node.textContent?.replace(/\s+/g, " ").trim() ?? "",
      href: new URL(node.getAttribute("href") ?? "", location.href).pathname,
    })),
  }));
}

const { executablePath, usingSystemChrome } = await resolveChromeExecutable(chromium);
const browser = await puppeteer.launch({
  args: usingSystemChrome ? ["--no-sandbox", "--disable-dev-shm-usage"] : [...chromium.args, "--disable-dev-shm-usage"],
  executablePath,
  headless: true,
});

try {
  const desktop = await browser.newPage();
  await desktop.setViewport({ width: 1440, height: 1000 });

  for (const path of INDEXABLE_PATHS) {
    const snapshot = await collectPageSnapshot(desktop, path);
    assert(snapshot.title.trim(), `${path}: title missing`);
    assert(snapshot.description.trim(), `${path}: description missing`);
    assert.equal(snapshot.h1.length, 1, `${path}: expected exactly one H1`);
    assert(snapshot.h1[0], `${path}: H1 is empty`);

    const internalAnchors = snapshot.anchors.filter((anchor) => anchor.href.startsWith("/"));
    for (const anchor of internalAnchors) {
      assert(!VAGUE_ANCHORS.has(anchor.text.toLowerCase()), `${path}: vague internal anchor "${anchor.text}" → ${anchor.href}`);
    }
    const hrefs = new Set(internalAnchors.map((anchor) => anchor.href));
    for (const required of REQUIRED_INTERNAL_EDGES[path] ?? []) {
      assert(hrefs.has(required), `${path}: required thematic internal link missing → ${required}`);
    }

    const hexagramIndex = HEXAGRAM_PATHS.indexOf(path);
    if (hexagramIndex >= 0) {
      const expectedCanonical = `https://www.quickiching.com${path}`;
      assert.equal(snapshot.canonical, expectedCanonical, `${path}: canonical mismatch`);
      assert(snapshot.lineAnchors.every(Boolean), `${path}: six changing-line anchors are incomplete`);
      for (const required of [
        "/", "/hexagrams", "/methods/manual-cast", "/guides/how-to-ask-the-i-ching",
        "/guides/changing-lines", "/guides/primary-relating-hexagrams",
      ]) assert(hrefs.has(required), `${path}: entity graph link missing → ${required}`);
      if (hexagramIndex > 0) assert(hrefs.has(HEXAGRAM_PATHS[hexagramIndex - 1]), `${path}: previous hexagram link missing`);
      if (hexagramIndex < HEXAGRAM_PATHS.length - 1) assert(hrefs.has(HEXAGRAM_PATHS[hexagramIndex + 1]), `${path}: next hexagram link missing`);

      const graph = snapshot.jsonLd.flatMap((entry) => Array.isArray(entry?.["@graph"]) ? entry["@graph"] : []);
      const webPage = graph.find((entry) => entry?.["@type"] === "WebPage");
      const breadcrumbs = graph.find((entry) => entry?.["@type"] === "BreadcrumbList");
      assert.equal(webPage?.url, expectedCanonical, `${path}: WebPage JSON-LD URL mismatch`);
      assert.equal(breadcrumbs?.itemListElement?.[1]?.item, expectedCanonical, `${path}: breadcrumb JSON-LD URL mismatch`);
    }

    await assertNoOverflow(desktop, `${path} desktop`);
    log(`TDH ${path} title=${JSON.stringify(snapshot.title)} description=${JSON.stringify(snapshot.description)} h1=${JSON.stringify(snapshot.h1[0])}`);
  }
  await desktop.close();

  for (const width of [320, 375, 390]) {
    for (const path of GUIDE_PATHS) {
      const page = await browser.newPage();
      await page.setViewport({ width, height: width === 320 ? 800 : 844 });
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0", timeout: 30_000 });
      await assertNoOverflow(page, `${path} ${width}px`);
      const h1Fits = await page.$eval("h1", (node) => {
        const rect = node.getBoundingClientRect();
        return rect.left >= -1 && rect.right <= document.documentElement.clientWidth + 1;
      });
      assert(h1Fits, `${path} ${width}px: H1 exceeds viewport`);
      log(`${path} ${width}px PASS`);
      await page.close();
    }
  }

  log("TDH / 64-entity canonical + JSON-LD + line anchors + internal graph / desktop + 320/375/390 guide visual gates PASS");
} finally {
  await browser.close();
}
