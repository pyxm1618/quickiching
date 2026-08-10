import assert from "node:assert/strict";
import http from "node:http";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

const BASE = process.env.PUBLIC_V1_TEST_BASE_URL || "http://127.0.0.1:3000";
const HOME_TITLE = "I Ching Online — Free Hexagram Reading | Quick I Ching";
const HOME_DESCRIPTION = "Use the I Ching online with three coins, yarrow stalks, or Mei Hua Yi Shu. Cast your hexagram, see changing lines, and get a free basic interpretation.";
const HOME_H1 = "I Ching Online — Cast Your Hexagram";
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

function log(message) {
  console.log(`[Browser Gate] ${message}`);
}

async function fetchManual(path, init = {}) {
  return fetch(`${BASE}${path}`, { redirect: "manual", ...init });
}

function rawHttp(path, host) {
  const base = new URL(BASE);
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: base.hostname,
        port: Number(base.port || 80),
        path,
        method: "GET",
        headers: { Host: host },
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => { body += chunk; });
        response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body }));
      },
    );
    request.on("error", reject);
    request.end();
  });
}

async function expectStatus(path, expected) {
  const response = await fetchManual(path);
  assert.equal(response.status, expected, `${path}: expected ${expected}, received ${response.status}`);
  return response;
}

function extractHrefs(html) {
  const hrefs = new Set();
  const regex = /href=["']([^"']+)["']/g;
  let match;
  while ((match = regex.exec(html))) hrefs.add(match[1]);
  return [...hrefs];
}

function extractCanonicalHref(html) {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = /\brel=["']([^"']*)["']/i.exec(tag)?.[1] ?? "";
    if (!rel.split(/\s+/).some((value) => value.toLowerCase() === "canonical")) continue;
    return /\bhref=["']([^"']+)["']/i.exec(tag)?.[1] ?? null;
  }
  return null;
}

async function verifyHttpAndSeo() {
  log("Checking initial HTML, canonical URLs, sitemap, robots, redirects, 404/410 and internal links");

  const home = await expectStatus("/", 200);
  const homeHtml = await home.text();
  assert(homeHtml.includes(`<title>${HOME_TITLE}</title>`), "Exact homepage title is missing from initial HTML");
  assert(homeHtml.includes(`content="${HOME_DESCRIPTION}"`), "Exact homepage description is missing from initial HTML");
  assert(homeHtml.includes(HOME_H1), "Exact homepage H1 is missing from initial HTML");
  assert(homeHtml.includes('href="/methods/yarrow-stalks"'), "Yarrow crawlable link missing from initial HTML");
  assert(homeHtml.includes('href="/methods/mei-hua-yi-shu"'), "Mei Hua crawlable link missing from initial HTML");
  assert(homeHtml.includes('href="/guides/changing-lines"'), "Changing-lines crawlable link missing from initial HTML");
  assert(homeHtml.includes('href="/hexagrams"'), "Hexagrams crawlable link missing from initial HTML");

  for (const path of INDEXABLE_PATHS) {
    const response = await expectStatus(path, 200);
    const html = await response.text();
    const expectedCanonical = new URL(path, "https://www.quickiching.com").toString();
    const actualCanonical = extractCanonicalHref(html);
    assert(actualCanonical, `${path}: self-canonical missing`);
    assert.equal(
      new URL(actualCanonical, "https://www.quickiching.com").toString(),
      expectedCanonical,
      `${path}: self-canonical wrong: ${actualCanonical}`,
    );
    assert(!/name="robots" content="[^"]*noindex/i.test(html), `${path}: indexable page unexpectedly noindex`);
  }

  const noindexPaths = ["/pricing", "/help", "/privacy", "/terms", "/acceptable-use"];
  for (const path of noindexPaths) {
    const response = await expectStatus(path, 200);
    const html = await response.text();
    assert(/name="robots" content="[^"]*noindex/i.test(html), `${path}: expected noindex metadata`);
  }

  const sitemap = await expectStatus("/sitemap.xml", 200);
  const sitemapXml = await sitemap.text();
  const locs = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]).sort();
  const expectedLocs = INDEXABLE_PATHS.map((path) => new URL(path, "https://www.quickiching.com").toString()).sort();
  assert.deepEqual(locs, expectedLocs, "Sitemap must contain exactly the eight canonical Public V1 pages");
  for (const forbidden of ["/pricing", "/signin", "/three-coin-method", "/checkout", "vercel.app"]) {
    assert(!sitemapXml.includes(forbidden), `Sitemap contains forbidden entry: ${forbidden}`);
  }

  const robots = await expectStatus("/robots.txt", 200);
  const robotsText = await robots.text();
  assert(robotsText.includes("Sitemap: https://www.quickiching.com/sitemap.xml"), "robots.txt canonical sitemap missing");
  assert(robotsText.includes("Disallow: /api/"), "robots.txt API crawl control missing");
  assert(!robotsText.includes("Disallow: /signin"), "robots.txt must let crawlers observe gone semantics");

  const key = await expectStatus("/0458fb9ef2ef723618b52f6861b3b2f7.txt", 200);
  assert.equal((await key.text()).trim(), "0458fb9ef2ef723618b52f6861b3b2f7", "IndexNow key hosting mismatch");

  const redirects = [
    ["/i-ching-coin", "/methods/three-coin"],
    ["/three-coin-method", "/methods/three-coin"],
    ["/yarrow-stalk-method", "/methods/yarrow-stalks"],
    ["/mei-hua-yi-shu", "/methods/mei-hua-yi-shu"],
    ["/how-to-ask-the-i-ching", "/guides/how-to-ask-the-i-ching"],
    ["/changing-lines", "/guides/changing-lines"],
    ["/primary-and-relating-hexagrams", "/guides/primary-relating-hexagrams"],
    ["/cast/three_coin", "/"],
    ["/cast/yarrow_stalk", "/methods/yarrow-stalks"],
    ["/cast/mei_hua_current_time", "/methods/mei-hua-yi-shu"],
  ];
  for (const [path, destination] of redirects) {
    const response = await expectStatus(path, 308);
    const location = new URL(response.headers.get("location"), BASE);
    assert.equal(location.pathname, destination, `${path}: wrong redirect destination`);
  }

  const castingMethods = await expectStatus("/casting-methods", 308);
  const castingLocation = new URL(castingMethods.headers.get("location"), BASE);
  assert.equal(`${castingLocation.pathname}${castingLocation.hash}`, "/#other-casting-methods");

  for (const path of ["/signin", "/account", "/checkout/example"]) {
    const response = await expectStatus(path, 410);
    assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow", `${path}: missing noindex response header`);
  }
  for (const path of ["/result/not-a-reading", "/cast/not-a-method", "/api/not-a-route", "/definitely-missing"]) {
    const response = await expectStatus(path, 404);
    if (path !== "/definitely-missing") {
      assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow", `${path}: missing noindex response header`);
    }
  }

  const bare = await rawHttp("/guides/changing-lines?source=gate", "quickiching.com");
  assert.equal(bare.status, 308, "bare domain must permanently redirect");
  assert.equal(bare.headers.location, "https://www.quickiching.com/guides/changing-lines?source=gate", "bare-domain redirect must preserve path/query");
  const alias = await rawHttp("/hexagrams?source=gate", "ichingcoin.vercel.app");
  assert.equal(alias.status, 308, "Vercel alias must permanently redirect");
  assert.equal(alias.headers.location, "https://www.quickiching.com/hexagrams?source=gate", "Vercel-alias redirect must preserve path/query");

  const crawlPages = [...INDEXABLE_PATHS, ...noindexPaths];
  const discovered = new Set();
  for (const path of crawlPages) {
    const response = await expectStatus(path, 200);
    const html = await response.text();
    for (const href of extractHrefs(html)) {
      if (!href.startsWith("/") || href.startsWith("//")) continue;
      const url = new URL(href, BASE);
      discovered.add(`${url.pathname}${url.search}`);
    }
  }
  for (const path of discovered) {
    const response = await fetchManual(path);
    assert([200, 308].includes(response.status), `Dead internal link ${path}: status ${response.status}`);
  }
  log(`HTTP/SEO gate PASS; ${discovered.size} internal links checked`);
}

async function waitForText(page, text, timeout = 15_000) {
  await page.waitForFunction((value) => document.body?.innerText.includes(value), { timeout }, text);
}

async function clickButton(page, label) {
  const clicked = await page.evaluate((wanted) => {
    const button = [...document.querySelectorAll("button")].find((node) => node.textContent?.trim() === wanted || node.textContent?.trim().startsWith(wanted));
    if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
    button.click();
    return true;
  }, label);
  assert(clicked, `Unable to click enabled button: ${label}`);
}

function attachFailureCollectors(page) {
  const consoleErrors = [];
  const pageErrors = [];
  const badResponses = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin === new URL(BASE).origin && response.status() >= 400) {
      badResponses.push(`${response.status()} ${url.pathname}`);
    }
  });
  return { consoleErrors, pageErrors, badResponses };
}

async function assertNoOverflow(page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  assert(overflow.scrollWidth <= overflow.clientWidth + 1, `Horizontal overflow: ${overflow.scrollWidth} > ${overflow.clientWidth}`);
}

async function assertResult(page) {
  await waitForText(page, "Your I Ching reading");
  const resultText = await page.$eval('[aria-labelledby="reading-result-title"]', (node) => node.textContent || "");
  for (const expected of ["Free basic interpretation", "Primary Hexagram", "Changing Lines", "Relating Hexagram", "general interpretive framework for reflection"]) {
    assert(resultText.includes(expected), `Reading result missing: ${expected}`);
  }
}

async function finishThreeCoin(page) {
  await waitForText(page, "0 / 6 lines");
  const focused = await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((node) => node.textContent?.trim() === "Toss three coins");
    if (!(button instanceof HTMLButtonElement)) return false;
    button.focus();
    return document.activeElement === button;
  });
  assert(focused, "Three-Coin button cannot receive keyboard focus");
  await page.keyboard.press("Enter");
  await waitForText(page, "1 / 6 lines");
  for (let line = 2; line <= 6; line += 1) {
    await clickButton(page, "Toss three coins");
    await waitForText(page, `${line} / 6 lines`);
  }
  await assertResult(page);
  await clickButton(page, "New reading");
  await waitForText(page, "0 / 6 lines");
}

async function finishYarrow(page, verifyResume) {
  await waitForText(page, "0 / 18 changes");
  let completed = 0;
  if (verifyResume) {
    for (completed = 1; completed <= 4; completed += 1) {
      await clickButton(page, "Perform change");
      await waitForText(page, `${completed} / 18 changes`);
    }
    await page.reload({ waitUntil: "networkidle0" });
    await waitForText(page, "4 / 18 changes");
    completed = 4;
  }
  for (let change = completed + 1; change <= 18; change += 1) {
    await clickButton(page, "Perform change");
    await waitForText(page, `${change} / 18 changes`);
  }
  await assertResult(page);
  await clickButton(page, "New reading");
  await waitForText(page, "0 / 18 changes");
}

async function finishMeiHua(page) {
  await page.waitForSelector("#mei-hua-timezone");
  const labelExists = await page.evaluate(() => Boolean(document.querySelector('label[for="mei-hua-timezone"]')));
  assert(labelExists, "Mei Hua timezone input is missing its label");
  await page.click("#mei-hua-timezone");
  await page.keyboard.down("Control");
  await page.keyboard.press("A");
  await page.keyboard.up("Control");
  await page.keyboard.type("Asia/Singapore");
  await clickButton(page, "Cast current time");
  await waitForText(page, "Recorded calculation");
  await waitForText(page, "quickiching-gregorian-current-time-v2");
  await assertResult(page);
  await clickButton(page, "New reading");
  await waitForText(page, "Cast current time");
}

async function runPage(browser, { path, viewport, flow, label }) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport(viewport);
  const failures = attachFailureCollectors(page);
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0", timeout: 30_000 });
    await flow(page);
    await assertNoOverflow(page);
    assert.deepEqual(failures.consoleErrors, [], `${label}: console errors: ${failures.consoleErrors.join(" | ")}`);
    assert.deepEqual(failures.pageErrors, [], `${label}: page errors: ${failures.pageErrors.join(" | ")}`);
    assert.deepEqual(failures.badResponses, [], `${label}: same-origin 4xx/5xx: ${failures.badResponses.join(" | ")}`);
    log(`${label} PASS`);
  } finally {
    await context.close();
  }
}

async function verifyBrowserFlows() {
  const executablePath = process.env.CHROME_PATH || await chromium.executablePath();
  const usingSystemChrome = Boolean(process.env.CHROME_PATH);
  log(`Launching Chromium at ${executablePath}${usingSystemChrome ? " (system runner)" : " (serverless fallback)"}`);
  const browser = await puppeteer.launch({
    args: usingSystemChrome ? ["--no-sandbox", "--disable-dev-shm-usage"] : [...chromium.args, "--disable-dev-shm-usage"],
    executablePath,
    headless: true,
  });
  try {
    const desktop = { width: 1440, height: 1000 };
    const mobile = { width: 375, height: 812 };
    await runPage(browser, { path: "/", viewport: desktop, flow: finishThreeCoin, label: "Desktop homepage → Three Coin → result/reset" });
    await runPage(browser, { path: "/methods/yarrow-stalks", viewport: desktop, flow: (page) => finishYarrow(page, true), label: "Desktop Yarrow → resume → result/reset" });
    await runPage(browser, { path: "/methods/mei-hua-yi-shu", viewport: desktop, flow: finishMeiHua, label: "Desktop Mei Hua → result/reset" });

    await runPage(browser, { path: "/", viewport: mobile, flow: finishThreeCoin, label: "375px homepage → Three Coin → result" });
    await runPage(browser, { path: "/methods/yarrow-stalks", viewport: mobile, flow: (page) => finishYarrow(page, false), label: "375px Yarrow → result" });
    await runPage(browser, { path: "/methods/mei-hua-yi-shu", viewport: mobile, flow: finishMeiHua, label: "375px Mei Hua → result" });

    for (const viewport of [{ width: 320, height: 800 }, { width: 390, height: 844 }]) {
      await runPage(browser, {
        path: "/",
        viewport,
        label: `${viewport.width}px navigation/FAQ/footer`,
        flow: async (page) => {
          await waitForText(page, HOME_H1);
          await waitForText(page, "Common Questions About I Ching Online");
          const navVisible = await page.$eval('nav[aria-label="Primary navigation"]', (node) => Boolean(node.getClientRects().length));
          assert(navVisible, "Primary navigation not visible");
          const opened = await page.evaluate(() => {
            const summary = [...document.querySelectorAll("summary")].find((node) => node.textContent?.trim() === "What is an I Ching reading?");
            if (!(summary instanceof HTMLElement)) return false;
            summary.click();
            return true;
          });
          assert(opened, "FAQ summary could not be opened");
          await waitForText(page, "structured framework for reflection");
          const footerVisible = await page.$eval("footer", (node) => Boolean(node.getClientRects().length));
          assert(footerVisible, "Footer not visible");
        },
      });
    }
  } finally {
    await browser.close();
  }
}

await verifyHttpAndSeo();
await verifyBrowserFlows();
log("ALL BROWSER/HTTP GATES PASS");
