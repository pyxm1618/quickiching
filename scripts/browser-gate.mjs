import assert from "node:assert/strict";
import http from "node:http";
import https from "node:https";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { resolveChromeExecutable } from "./browser-runtime.mjs";

const BASE = process.env.PUBLIC_V1_TEST_BASE_URL || "http://127.0.0.1:3000";
const HOME_TITLE = "I Ching Online — Free Hexagram Reading | Quick I Ching";
const HOME_DESCRIPTION = "Use the I Ching online with Three-Coin, Yarrow Stalk, Mei Hua Yi Shu, or Manual Cast. See changing lines and get a free grounded interpretation.";
const HOME_H1 = "I Ching Online — Cast Your Hexagram";
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
const ENGLISH_INDEXABLE_PATHS = [
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
const CHINESE_INDEXABLE_PATHS = [
  "/zh",
  "/zh/methods/mei-hua-yi-shu",
  "/zh/hexagrams",
  ...HEXAGRAM_PATHS.map((path) => "/zh" + path),
];
const INDEXABLE_PATHS = [...ENGLISH_INDEXABLE_PATHS, ...CHINESE_INDEXABLE_PATHS];
const SITEMAP_PATHS = INDEXABLE_PATHS;

function log(message) {
  console.log(`[Browser Gate] ${message}`);
}

async function fetchManual(path, init = {}) {
  return fetch(`${BASE}${path}`, { redirect: "manual", ...init });
}

function rawHttp(path, host) {
  const base = new URL(BASE);
  const secure = base.protocol === "https:";
  const requestClient = secure ? https : http;
  return new Promise((resolve, reject) => {
    const request = requestClient.request(
      {
        hostname: secure ? host : base.hostname,
        port: Number(base.port || (secure ? 443 : 80)),
        path,
        method: "GET",
        headers: { Host: host },
        ...(secure ? { servername: host } : {}),
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
  assert(homeHtml.includes('href="/methods/manual-cast"'), "Manual Cast crawlable link missing from initial HTML");
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

  const noindexPaths = ["/pricing", "/help", "/privacy", "/terms", "/acceptable-use", "/readings/three-coin/result"];
  for (const path of noindexPaths) {
    const response = await expectStatus(path, 200);
    const html = await response.text();
    assert(/name="robots" content="[^"]*noindex/i.test(html), `${path}: expected noindex metadata`);
  }

  const resultHtml = await (await expectStatus("/readings/three-coin/result", 200)).text();
  assert(/name="robots" content="[^"]*noindex[^\"]*follow/i.test(resultHtml), "Result route must emit noindex, follow");
  assert(!resultHtml.includes(HOME_TITLE), "Result route must not inherit homepage title");
  assert(!resultHtml.includes(HOME_DESCRIPTION), "Result route must not inherit homepage description");

  const sitemap = await expectStatus("/sitemap.xml", 200);
  const sitemapXml = await sitemap.text();
  const locs = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]).sort();
  const expectedLocs = SITEMAP_PATHS.map((path) => new URL(path, "https://www.quickiching.com").toString()).sort();
  assert.deepEqual(locs, expectedLocs, "Sitemap must contain exactly the 73 English and 67 Chinese canonical Public V1 pages");
  for (const forbidden of ["/pricing", "/signin", "/three-coin-method", "/checkout", "/readings/three-coin/result", "/en", "vercel.app"]) {
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

  const crawlPages = [...SITEMAP_PATHS, ...noindexPaths];
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
  await page.waitForFunction((value) => document.body?.innerText.toLocaleLowerCase().includes(value.toLocaleLowerCase()), { timeout }, text);
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

async function clickLink(page, label) {
  const clicked = await page.evaluate((wanted) => {
    const link = [...document.querySelectorAll("a")].find((node) => node.textContent?.trim() === wanted);
    if (!(link instanceof HTMLAnchorElement)) return false;
    link.click();
    return true;
  }, label);
  assert(clicked, `Unable to click link: ${label}`);
}

async function dispatchThreeCoinPointer(page, type, pointerId = 41) {
  const dispatched = await page.evaluate(({ eventType, id }) => {
    const button = [...document.querySelectorAll("button")].find((node) => node.textContent?.trim() === "Toss three coins");
    if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
    if (eventType === "pointerdown") {
      button.setPointerCapture = () => {};
    }
    button.dispatchEvent(new PointerEvent(eventType, {
      bubbles: true,
      cancelable: true,
      pointerId: id,
      pointerType: "touch",
      isPrimary: true,
      button: 0,
      buttons: eventType === "pointerdown" ? 1 : 0,
    }));
    return true;
  }, { eventType: type, id: pointerId });
  assert(dispatched, `Unable to dispatch Three-Coin ${type}`);
}

function attachFailureCollectors(page) {
  const consoleErrors = [];
  const pageErrors = [];
  const badResponses = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    // Same rule badResponses below already applies: this gate answers for OUR
    // site, not for third parties. The page under test is served over plain
    // HTTP on loopback, so it cannot itself produce a TLS error — anything like
    // ERR_CERT_DATE_INVALID necessarily comes from the analytics and challenge
    // scripts the CSP allows (Tag Manager, Clarity, Turnstile, Bing), which the
    // build container reaches unreliably. A third party failing to load is not
    // grounds to block a release; a first-party console error still is.
    const source = message.location()?.url ?? "";
    if (source) {
      try {
        if (new URL(source).origin !== new URL(BASE).origin) return;
      } catch {
        // Unparseable source: keep it rather than silently dropping a real error.
      }
    }
    consoleErrors.push(message.text());
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

async function assertBasicResult(page) {
  await waitForText(page, "Your I Ching reading");
  const resultText = await page.$eval("[data-public-reading-result]", (node) => node.textContent || "");
  for (const expected of ["Primary Hexagram", "Changing Lines", "Core meaning", "Reflect", "Save reading"]) {
    assert(resultText.includes(expected), `Reading result missing: ${expected}`);
  }
}

async function skipOptionalQuestion(page) {
  const skipped = await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((node) => node.textContent?.trim() === "Skip for now");
    if (!(button instanceof HTMLButtonElement)) return false;
    button.click();
    return true;
  });
  if (skipped) await waitForText(page, "Ask · editable before the result");
}

async function verifyThreeCoinTransactionSemantics(page) {
  const storageKey = "quickiching:public-v1:three-coin";
  await waitForText(page, "0 / 6 lines");

  await dispatchThreeCoinPointer(page, "pointerdown", 41);
  await dispatchThreeCoinPointer(page, "pointercancel", 41);
  const cancelled = await page.evaluate((key) => ({
    motion: document.querySelector(".coin-motion-stage")?.getAttribute("data-motion"),
    storedSteps: (() => {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : Array.isArray(parsed?.data?.steps) ? parsed.data.steps : null;
    })(),
    body: document.body?.innerText ?? "",
  }), storageKey);
  assert.equal(cancelled.motion, "idle", "pointercancel must return the Three-Coin chamber to idle");
  assert.equal(cancelled.storedSteps, null, "pointercancel must not persist a Three-Coin line");
  assert(cancelled.body.includes("0 / 6 lines"), "pointercancel must not advance Three-Coin progress");

  await dispatchThreeCoinPointer(page, "pointerdown", 42);
  await dispatchThreeCoinPointer(page, "pointerup", 42);
  await new Promise((resolve) => setTimeout(resolve, 100));
  const duringReveal = await page.evaluate((key) => {
    const raw = sessionStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      stored: Array.isArray(parsed) ? parsed : parsed?.data?.steps ?? null,
      body: document.body?.innerText ?? "",
      motion: document.querySelector(".coin-motion-stage")?.getAttribute("data-motion"),
    };
  }, storageKey);
  assert.equal(duringReveal.stored?.length, 1, "release must immediately persist the authoritative Three-Coin line before reveal completes");
  assert.equal(duringReveal.motion, "casting", "release should still be visually revealing the committed line during Motion F");
  assert(duringReveal.body.includes("0 / 6 lines"), "authoritative commit must not visually reveal the new line before Motion F settles");

  await page.reload({ waitUntil: "networkidle0" });
  await waitForText(page, "1 / 6 lines");
  const restored = await page.evaluate((key) => {
    const raw = sessionStorage.getItem(key);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return (Array.isArray(parsed) ? parsed : parsed?.data?.steps ?? []).length;
  }, storageKey);
  assert.equal(restored, 1, "reload during Motion F must restore the already-committed Three-Coin line");
  await clickButton(page, "Restart casting");
  await waitForText(page, "0 / 6 lines");
}

async function finishThreeCoin(page) {
  const storageKey = "quickiching:public-v1:three-coin";
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

  await waitForText(page, "Your hexagram is formed");
  await waitForText(page, "Reveal Your Reading");
  const sealedBeforeReveal = await page.evaluate((key) => sessionStorage.getItem(key), storageKey);
  assert(sealedBeforeReveal, "Completed Three-Coin reading must remain sealed before reveal navigation");

  await clickLink(page, "Reveal Your Reading");
  await page.waitForFunction(() => location.pathname === "/readings/three-coin/result", { timeout: 15_000 });
  const locationAfterReveal = await page.evaluate(() => ({ pathname: location.pathname, search: location.search }));
  assert.equal(locationAfterReveal.pathname, "/readings/three-coin/result");
  assert.equal(locationAfterReveal.search, "", "Three-Coin result URL must carry no cast state in query parameters");
  await waitForText(page, "Your Three-Coin Reading");
  for (const expected of [
    "The Primary Hexagram",
    "Understanding the Structure",
    "Changing Lines",
    "Bringing the Reading Together",
    "Bottom Line",
    "Questions to Sit With",
    "What to Watch",
  ]) await waitForText(page, expected);

  const readingBeforeRefresh = await page.$eval("main", (node) => node.textContent ?? "");
  await page.reload({ waitUntil: "networkidle0" });
  await waitForText(page, "Bottom Line");
  assert.equal(await page.$eval("main", (node) => node.textContent ?? ""), readingBeforeRefresh, "Three-Coin refresh must preserve the exact visible reading");
  const sealedAfterRefresh = await page.evaluate((key) => sessionStorage.getItem(key), storageKey);
  assert.equal(sealedAfterRefresh, sealedBeforeReveal, "Result refresh must not alter the sealed six-line cast");

  await clickButton(page, "Start a New Reading");
  await page.waitForFunction(() => location.pathname === "/" && location.hash === "#three-coin-reading", { timeout: 15_000 });
  await skipOptionalQuestion(page);
  await waitForText(page, "0 / 6 lines");
  const resetSteps = await page.evaluate((key) => {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : parsed?.data?.steps ?? null;
  }, storageKey);
  assert.equal(resetSteps, null, "Explicit Start a New Reading must clear sealed Three-Coin line data");
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
  await assertBasicResult(page);
  await clickButton(page, "New reading");
  await skipOptionalQuestion(page);
  await waitForText(page, "0 / 18 changes");
}

async function finishMeiHua(page) {
  await page.waitForSelector("#mei-hua-timezone");
  const labelExists = await page.evaluate(() => Boolean(document.querySelector('label[for="mei-hua-timezone"]')));
  assert(labelExists, "Mei Hua timezone input is missing its label");
  await page.locator("#mei-hua-timezone").fill("Asia/Singapore");
  await clickButton(page, "Cast current time");
  await waitForText(page, "Recorded calculation");
  await waitForText(page, "quickiching-gregorian-current-time-v2");
  await assertBasicResult(page);
  await clickButton(page, "New reading");
  await skipOptionalQuestion(page);
  await waitForText(page, "Cast current time");
}

async function runPage(browser, { path, viewport, flow, label }) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport(viewport);
  const failures = attachFailureCollectors(page);
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0", timeout: 30_000 });
    await skipOptionalQuestion(page);
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
  const { executablePath, usingSystemChrome } = await resolveChromeExecutable(chromium);
  log(`Launching Chromium at ${executablePath}${usingSystemChrome ? " (system runner)" : " (serverless fallback)"}`);
  const browser = await puppeteer.launch({
    args: usingSystemChrome ? ["--no-sandbox", "--disable-dev-shm-usage"] : [...chromium.args, "--disable-dev-shm-usage"],
    executablePath,
    headless: true,
  });
  try {
    const desktop = { width: 1440, height: 1000 };
    const mobile = { width: 375, height: 812 };
    await runPage(browser, { path: "/", viewport: desktop, flow: verifyThreeCoinTransactionSemantics, label: "Desktop Three Coin → commit/reveal/cancel semantics" });
    await runPage(browser, { path: "/", viewport: desktop, flow: finishThreeCoin, label: "Desktop homepage → Three Coin → Reveal → V2 result/refresh/reset" });
    await runPage(browser, { path: "/methods/yarrow-stalks", viewport: desktop, flow: (page) => finishYarrow(page, true), label: "Desktop Yarrow → resume → V1 result/reset" });
    await runPage(browser, { path: "/methods/mei-hua-yi-shu", viewport: desktop, flow: finishMeiHua, label: "Desktop Mei Hua → V1 result/reset" });

    await runPage(browser, { path: "/", viewport: mobile, flow: finishThreeCoin, label: "375px homepage → Three Coin → V2 result" });
    await runPage(browser, { path: "/methods/yarrow-stalks", viewport: mobile, flow: (page) => finishYarrow(page, false), label: "375px Yarrow → V1 result" });
    await runPage(browser, { path: "/methods/mei-hua-yi-shu", viewport: mobile, flow: finishMeiHua, label: "375px Mei Hua → V1 result" });

    for (const viewport of [{ width: 320, height: 800 }, { width: 390, height: 844 }]) {
      await runPage(browser, {
        path: "/",
        viewport,
        label: `${viewport.width}px navigation/FAQ/footer`,
        flow: async (page) => {
          await waitForText(page, HOME_H1);
          await waitForText(page, "Common Questions About I Ching Online");
          const mobileTrigger = await page.$('header button[aria-controls^="nav-drawer-"]');
          assert(mobileTrigger, "Mobile navigation trigger missing");
          const triggerVisible = await page.$eval(
            'header button[aria-controls^="nav-drawer-"]',
            (node) => Boolean(node.getClientRects().length && getComputedStyle(node).display !== "none"),
          );
          assert(triggerVisible, "Mobile navigation trigger not visible");
          await mobileTrigger.click();
          await page.waitForSelector('[role="dialog"][aria-modal="true"]', { timeout: 5000 });
          const drawerNavigation = await page.$eval(
            '[role="dialog"][aria-modal="true"] nav',
            (node) => ({
              visible: Boolean(node.getClientRects().length),
              links: [...node.querySelectorAll("a[href]")].filter((link) => link.getClientRects().length).length,
            }),
          );
          assert(drawerNavigation.visible, "Mobile drawer navigation not visible");
          assert(drawerNavigation.links > 0, "Mobile drawer navigation links missing");
          await page.keyboard.press("Escape");
          await page.waitForFunction(() => !document.querySelector('[role="dialog"][aria-modal="true"]'), { timeout: 5000 });
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
