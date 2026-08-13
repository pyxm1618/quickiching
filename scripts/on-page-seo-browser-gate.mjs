import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

const BASE = process.env.PUBLIC_V1_TEST_BASE_URL || "http://127.0.0.1:3000";
const INDEXABLE_PATHS = [
  "/",
  "/methods/three-coin",
  "/methods/yarrow-stalks",
  "/methods/mei-hua-yi-shu",
  "/guides/how-to-ask-the-i-ching",
  "/guides/changing-lines",
  "/guides/primary-relating-hexagrams",
  "/hexagrams",
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
    "/guides/how-to-ask-the-i-ching",
    "/guides/changing-lines",
    "/guides/primary-relating-hexagrams",
    "/hexagrams",
  ],
  "/methods/three-coin": ["/guides/how-to-ask-the-i-ching", "/guides/changing-lines", "/guides/primary-relating-hexagrams"],
  "/methods/yarrow-stalks": ["/", "/methods/three-coin", "/guides/changing-lines", "/guides/primary-relating-hexagrams"],
  "/methods/mei-hua-yi-shu": ["/", "/hexagrams", "/guides/changing-lines"],
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
    h1: [...document.querySelectorAll("h1")].map((node) => node.textContent?.trim() ?? ""),
    anchors: [...document.querySelectorAll("a[href]")].map((node) => ({
      text: node.textContent?.replace(/\s+/g, " ").trim() ?? "",
      href: new URL(node.getAttribute("href") ?? "", location.href).pathname,
    })),
  }));
}

const executablePath = process.env.CHROME_PATH || await chromium.executablePath();
const usingSystemChrome = Boolean(process.env.CHROME_PATH);
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
    for (const required of REQUIRED_INTERNAL_EDGES[path]) {
      assert(hrefs.has(required), `${path}: required thematic internal link missing → ${required}`);
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

  log("TDH / internal-link / desktop + 320/375/390 guide visual gates PASS");
} finally {
  await browser.close();
}
