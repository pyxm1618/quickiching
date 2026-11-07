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
  "/zh/methods/three-coin",
  "/zh/methods/yarrow-stalks",
  "/zh/methods/mei-hua-yi-shu",
  "/zh/methods/manual-cast",
  "/zh/guides/how-to-ask-the-i-ching",
  "/zh/guides/changing-lines",
  "/zh/guides/primary-relating-hexagrams",
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
  const initialHeadings = [...homeHtml.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gu)].map((match) => match[1].replace(/<[^>]+>/gu, ""));
  assert.deepEqual(initialHeadings, [HOME_H1], "Exact homepage H1 is missing from initial HTML");
  assert(homeHtml.includes("data-three-coin-ritual"), "Homepage Three-Coin single-stage scaffold is missing from initial HTML");
  assert(!homeHtml.includes('"@type":"FAQPage"'), "Homepage must not keep FAQ structured data after the visible FAQ was removed");

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

  const noindexPaths = [
    "/pricing",
    "/help",
    "/privacy",
    "/terms",
    "/acceptable-use",
    "/zh/help",
    "/zh/privacy",
    "/zh/terms",
    "/zh/acceptable-use",
    "/readings/result",
    "/zh/readings/result",
  ];
  for (const path of noindexPaths) {
    const response = await expectStatus(path, 200);
    const html = await response.text();
    assert(/name="robots" content="[^"]*noindex/i.test(html), `${path}: expected noindex metadata`);
  }

  const resultHtml = await (await expectStatus("/readings/result", 200)).text();
  assert(/name="robots" content="[^"]*noindex[^\"]*follow/i.test(resultHtml), "Result route must emit noindex, follow");
  assert(!resultHtml.includes(HOME_TITLE), "Result route must not inherit homepage title");
  assert(!resultHtml.includes(HOME_DESCRIPTION), "Result route must not inherit homepage description");

  const sitemap = await expectStatus("/sitemap.xml", 200);
  const sitemapXml = await sitemap.text();
  const locs = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]).sort();
  const expectedLocs = SITEMAP_PATHS.map((path) => new URL(path, "https://www.quickiching.com").toString()).sort();
  assert.deepEqual(locs, expectedLocs, "Sitemap must contain exactly the 73 English and 73 Chinese canonical Public V1 pages");
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
  ];
  for (const [path, destination] of redirects) {
    const response = await expectStatus(path, 308);
    const location = new URL(response.headers.get("location"), BASE);
    assert.equal(location.pathname, destination, `${path}: wrong redirect destination`);
  }

  for (const [path, destination] of [
    ["/readings/three-coin/result", "/readings/result"],
    ["/zh/readings/three-coin/result", "/zh/readings/result"],
  ]) {
    const response = await expectStatus(path, 307);
    const location = new URL(response.headers.get("location"), BASE);
    assert.equal(location.pathname, destination, `${path}: wrong canonical result redirect`);
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
  if (["Cast the Coins", "Record This Cast"].includes(label)) {
    await page.waitForFunction(
      wanted => [...document.querySelectorAll("button")].some(node => {
        const text=node.textContent?.trim() ?? "";
        return (text===wanted || text.startsWith(wanted)) && !node.disabled;
      }),
      {timeout:8000},
      label,
    );
  }
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

async function assertCompletedMethodHandoff(page, expectedMethod) {
  await page.waitForFunction(() => location.pathname === "/readings/result", { timeout: 15_000 });
  await page.waitForSelector("[data-completed-cast-gate='auth-required']", { timeout: 10_000 });
  assert.equal(await page.$("[data-public-reading-result]"), null, `${expectedMethod}: unsigned completed cast must remain behind the save/auth gate`);

  const completed = await page.evaluate((storageKey) => {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const reading = JSON.parse(raw);
    return {
      raw,
      id: reading?.id ?? null,
      method: reading?.method ?? null,
      methodVersion: reading?.methodVersion ?? null,
      lineValuesBottomUp: reading?.lineValuesBottomUp ?? null,
      evidenceKind: reading?.evidence?.kind ?? null,
      yarrowLineCount: Array.isArray(reading?.evidence?.lines) ? reading.evidence.lines.length : null,
      yarrowChangesPerLine: Array.isArray(reading?.evidence?.lines)
        ? reading.evidence.lines.map((line) => Array.isArray(line?.changes) ? line.changes.length : null)
        : null,
      meiHuaConventionId: reading?.evidence?.calculation?.methodCalculation?.conventionId ?? null,
      meiHuaNumber: reading?.evidence?.calculation?.methodCalculation?.number ?? null,
      meiHuaUtcMillis: reading?.evidence?.calculation?.methodCalculation?.utcMillis ?? null,
      meiHuaTimeZone: reading?.evidence?.calculation?.methodCalculation?.ianaTimeZone ?? null,
    };
  }, "quickiching:public-v1:completed-reading");

  assert(completed, `${expectedMethod}: completed-reading handoff was not persisted`);
  assert.equal(completed.method, expectedMethod, `${expectedMethod}: completed-reading method mismatch`);
  assert.equal(completed.evidenceKind, expectedMethod, `${expectedMethod}: completed-reading evidence mismatch`);
  assert.equal(completed.lineValuesBottomUp?.length, 6, `${expectedMethod}: completed-reading must preserve all six lines`);
  assert(completed.lineValuesBottomUp.every((value) => [6, 7, 8, 9].includes(value)), `${expectedMethod}: completed-reading contains an invalid line value`);

  const currentUrl = new URL(page.url());
  assert.equal(currentUrl.searchParams.get("session"), completed.id, `${expectedMethod}: result URL must preserve the exact completed-reading id`);

  if (expectedMethod === "yarrow-stalks") {
    assert.equal(completed.yarrowLineCount, 6, "Yarrow completed-reading must preserve six evidence lines");
    assert.deepEqual(completed.yarrowChangesPerLine, [3, 3, 3, 3, 3, 3], "Yarrow completed-reading must preserve all 18 changes");
  } else if (expectedMethod === "mei-hua-yi-shu") {
    assert.equal(completed.methodVersion, "mei-hua-number-moment-classical-v1", "Mei Hua completed-reading algorithm version mismatch");
    assert.equal(completed.meiHuaConventionId, "mei-hua-classical-object-number-hour-v1", "Mei Hua completed-reading public convention mismatch");
    assert.equal(completed.meiHuaNumber, 29, "Mei Hua completed-reading must preserve the confirmed user number");
    assert(Number.isFinite(completed.meiHuaUtcMillis), "Mei Hua completed-reading must preserve the exact UTC casting moment");
    assert.equal(typeof completed.meiHuaTimeZone, "string", "Mei Hua completed-reading must preserve an IANA timezone");
    assert(completed.meiHuaTimeZone.length > 0, "Mei Hua completed-reading timezone must not be empty");
  }

  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector("[data-completed-cast-gate='auth-required']", { timeout: 10_000 });
  const preservedRaw = await page.evaluate((storageKey) => sessionStorage.getItem(storageKey), "quickiching:public-v1:completed-reading");
  assert.equal(preservedRaw, completed.raw, `${expectedMethod}: refresh must preserve the exact completed cast before authentication`);
  assert.equal(await page.$("[data-public-reading-result]"), null, `${expectedMethod}: refresh must not reveal before authentication`);
}

async function waitForRecordedLines(page,count) {
  await page.waitForFunction(expected=>document.querySelectorAll('.ritual-six-lines li[data-state="done"]').length===expected,{timeout:15000},count);
}

async function skipOptionalQuestion(page) {
  const formalRitual = await page.$("[data-three-coin-ritual]") !== null;
  const skipped = await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((node) => node.textContent?.trim() === "Skip — free reading only");
    if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
    button.click();
    return true;
  });
  assert(skipped, "Question skip must clearly leave this cast free-only");
  if (formalRitual) {
    await page.waitForSelector("[data-question-confirm]", { timeout: 5000 });
    await clickButton(page, "Cast the Coins");
    await page.waitForSelector(".hold-button:not(:disabled)");
    await waitForRecordedLines(page,0);
    return;
  }
  await page.waitForFunction(() => document.querySelector("textarea[data-private-question]") === null, { timeout: 5000 });
}

async function verifyThreeCoinTransactionSemantics(page) {
  const storageKey = "quickiching:public-v1:three-coin";

  await dispatchThreeCoinPointer(page, "pointerdown", 41);
  await dispatchThreeCoinPointer(page, "pointercancel", 41);
  const cancelled = await page.evaluate((key) => ({
    motion: document.querySelector("[data-ritual-view]")?.getAttribute("data-ritual-view"),
    storedSteps: (() => {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : Array.isArray(parsed?.data?.steps) ? parsed.data.steps : null;
    })(),
    recordedLines: document.querySelectorAll('.ritual-six-lines li[data-state="done"]').length,
  }), storageKey);
  assert.equal(cancelled.motion, "ready", "pointercancel must return the Three-Coin chamber to idle");
  assert.equal(cancelled.storedSteps, null, "pointercancel must not persist a Three-Coin line");
  assert.equal(cancelled.recordedLines,0,"pointercancel must not advance Three-Coin progress");

  await dispatchThreeCoinPointer(page, "pointerdown", 42);
  await dispatchThreeCoinPointer(page, "pointerup", 42);
  await new Promise((resolve) => setTimeout(resolve, 100));
  const duringReveal = await page.evaluate((key) => {
    const raw = sessionStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      stored: Array.isArray(parsed) ? parsed : parsed?.data?.steps ?? null,
      recordedLines: document.querySelectorAll('.ritual-six-lines li[data-state="done"]').length,
      labelsVisible: document.querySelector(".ritual-face-labels")!==null,
      motion: document.querySelector("[data-ritual-view]")?.getAttribute("data-ritual-view"),
    };
  }, storageKey);
  assert.equal(duringReveal.stored?.length, 1, "release must immediately persist the authoritative Three-Coin line before reveal completes");
  assert.equal(duringReveal.motion, "casting", "release should still be visually revealing the committed line during Motion F");
  assert.equal(duringReveal.recordedLines,0,"authoritative commit must not advance recorded progress before settling");
  assert.equal(duringReveal.labelsVisible,false,"Faces must not be labelled during the initial airborne phase");

  await page.reload({ waitUntil: "networkidle0" });
  await waitForRecordedLines(page,1);
  const restored = await page.evaluate((key) => {
    const raw = sessionStorage.getItem(key);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return (Array.isArray(parsed) ? parsed : parsed?.data?.steps ?? []).length;
  }, storageKey);
  assert.equal(restored, 1, "reload during Motion F must restore the already-committed Three-Coin line");
  await page.locator(".ritual-back").click();
  await page.waitForSelector('[data-experience-stage="landing"]');
  const resetSteps=await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)||"null")?.data?.steps??[],storageKey);
  assert.equal(resetSteps.length,0,"Explicit Back/restart clears the prior cast");
}

async function finishThreeCoin(page) {
  const storageKey = "quickiching:public-v1:three-coin";

  const focused = await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((node) => node.textContent?.trim() === "Toss three coins");
    if (!(button instanceof HTMLButtonElement)) return false;
    button.focus();
    return document.activeElement === button;
  });
  assert(focused, "Three-Coin button cannot receive keyboard focus");

  await page.keyboard.press("Enter");
  await waitForText(page, "Record This Cast");
  await clickButton(page, "Record This Cast");
  await waitForRecordedLines(page,1);

  for (let line = 2; line <= 6; line += 1) {
    await page.waitForSelector(".hold-button:not(:disabled)", { timeout: 5000 });
    await clickButton(page, "Toss three coins");
    await waitForText(page, "Record This Cast");
    await clickButton(page, "Record This Cast");
    if (line < 6) await waitForRecordedLines(page,line);
  }

  await page.waitForFunction(() => location.pathname === "/readings/result", { timeout: 15_000 });
  const sealedBeforeGate = await page.evaluate((key) => sessionStorage.getItem(key), storageKey);
  assert(sealedBeforeGate, "Completed Three-Coin reading must remain sealed after result navigation");
  const castLineValues = await page.evaluate((key) => {
    const parsed = JSON.parse(sessionStorage.getItem(key) || "null");
    const steps = Array.isArray(parsed) ? parsed : parsed?.data?.steps;
    return Array.isArray(steps) ? steps.map((step) => step?.lineValue) : null;
  }, storageKey);
  assert.equal(castLineValues?.length, 6, "Completed Three-Coin reading must preserve all six cast lines");
  assert(castLineValues.every((value) => [6, 7, 8, 9].includes(value)), "Completed Three-Coin reading must preserve valid line values");

  await waitForText(page, "Your six lines are complete");
  await waitForText(page, "Sign In to Save & Reveal");
  assert(await page.$("[data-auth-required-before-reveal]"), "Anonymous completed cast must enter auth-before-reveal gate");
  assert.equal(await page.$("[data-primary-card]"), null, "Primary hexagram must not reveal before authentication and account persistence");
  assert.equal(await page.$("[data-deep-reading-entry]"), null, "Deep Reading must remain downstream of the result reveal gate");

  const gateBeforeRefresh = await page.$eval("main", (node) => node.textContent ?? "");
  await page.reload({ waitUntil: "networkidle0" });
  await waitForText(page, "Your six lines are complete");
  assert.equal(await page.$eval("main", (node) => node.textContent ?? ""), gateBeforeRefresh, "Anonymous auth gate must restore the same completed cast after refresh");
  const sealedAfterRefresh = await page.evaluate((key) => sessionStorage.getItem(key), storageKey);
  assert.equal(sealedAfterRefresh, sealedBeforeGate, "Auth gate refresh must not alter the completed six-line cast");
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
  await assertCompletedMethodHandoff(page, "yarrow-stalks");
}

async function finishMeiHua(page) {
  await page.waitForSelector("#mei-hua-question");
  await page.locator("#mei-hua-question").fill("Should I change to a new job this year?");
  await page.click(".mei-ask button");
  await page.waitForSelector("#mei-hua-number");
  await page.locator("#mei-hua-number").fill("29");
  await page.click(".mei-choose button");
  await page.waitForSelector(".mei-moment");
  await page.click(".mei-confirm-actions .mei-button:not(.mei-button-outline)");
  await assertCompletedMethodHandoff(page, "mei-hua-yi-shu");
}

async function runPage(browser, { path, viewport, flow, label, skipQuestion = true }) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport(viewport);
  const failures = attachFailureCollectors(page);
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0", timeout: 30_000 });
    for (const button of await page.$$('[aria-label="Analytics Consent"] button')) {
      if (await button.evaluate(node => node.textContent?.trim() === "Decline")) await button.click();
    }
    if (skipQuestion) await skipOptionalQuestion(page);
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


async function verifyNotFoundPages(browser) {
  const cases = [
    {
      path: "/__404-test-page",
      locale: "EN",
      title: "Page Not Found | Quick I Ching",
      heading: "This Path Has No Hexagram",
      firstLine: "The page you’re looking for does not exist or may have moved.",
      secondLine: "Return to Quick I Ching and begin a new reading.",
      homeLabel: "Return Home",
      homePath: "/",
      hexagramsLabel: "Explore the 64 Hexagrams",
      hexagramsPath: "/hexagrams",
    },
    {
      path: "/zh/__404-test-page",
      locale: "ZH",
      title: "页面不存在 | Quick I Ching",
      heading: "此处无卦",
      firstLine: "你访问的页面不存在，或已经移动。",
      secondLine: "返回 Quick I Ching，重新开始一次起卦。",
      homeLabel: "返回首页",
      homePath: "/zh",
      hexagramsLabel: "浏览六十四卦",
      hexagramsPath: "/zh/hexagrams",
    },
  ];
  const viewports = [
    { label: "DESKTOP", width: 1440, height: 811 },
    { label: "MOBILE", width: 390, height: 844 },
  ];

  for (const viewport of viewports) {
    for (const testCase of cases) {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      await page.setViewport({ width: viewport.width, height: viewport.height });
      try {
        const response = await page.goto(`${BASE}${testCase.path}`, { waitUntil: "networkidle0", timeout: 30_000 });
        assert.equal(response?.status(), 404, `${testCase.path}: expected browser status 404`);
        await page.waitForSelector("h1", { timeout: 10_000 });
        await page.waitForFunction(
          expectedTitle => document.title === expectedTitle,
          { timeout: 10_000 },
          testCase.title,
        );

        const snapshot = await page.evaluate((expected) => {
          const links = [...document.querySelectorAll("a")];
          const findLink = (label) => links.find((node) => node.textContent?.trim() === label);
          const home = findLink(expected.homeLabel);
          const hexagrams = findLink(expected.hexagramsLabel);
          const heading = document.querySelector("h1");
          const code = [...document.querySelectorAll("p")].find((node) => node.textContent?.trim() === "404");
          const header = document.querySelector("body > header");
          const rect = (node) => {
            if (!node) return null;
            const value = node.getBoundingClientRect();
            return {
              top: Math.round(value.top),
              width: Math.round(value.width),
              centerX: Math.round(value.left + value.width / 2),
            };
          };
          const visibleHeaderFocusables = header
            ? [...header.querySelectorAll("a[href],button,input,select,textarea,[tabindex]")].filter((node) => {
                const style = getComputedStyle(node);
                return style.display !== "none" && style.visibility !== "hidden" && node.getClientRects().length > 0;
              }).length
            : 0;
          return {
            title: document.title,
            robots: document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? "",
            bodyText: document.body.innerText,
            homePath: home ? new URL(home.href).pathname : null,
            hexagramsPath: hexagrams ? new URL(hexagrams.href).pathname : null,
            headerDisplay: header ? getComputedStyle(header).display : null,
            visibleHeaderFocusables,
            overflow: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
            codeRect: rect(code),
            headingRect: rect(heading),
            homeRect: rect(home),
            hexagramsRect: rect(hexagrams),
          };
        }, testCase);

        assert.equal(snapshot.title, testCase.title, `${testCase.path}: title mismatch`);
        assert.match(snapshot.robots, /noindex/i, `${testCase.path}: robots missing noindex`);
        for (const text of ["404", testCase.heading, testCase.firstLine, testCase.secondLine, testCase.homeLabel, testCase.hexagramsLabel]) {
          assert(snapshot.bodyText.includes(text), `${testCase.path}: missing visible text: ${text}`);
        }
        assert.equal(snapshot.homePath, testCase.homePath, `${testCase.path}: primary CTA href mismatch`);
        assert.equal(snapshot.hexagramsPath, testCase.hexagramsPath, `${testCase.path}: secondary CTA href mismatch`);
        assert(snapshot.headerDisplay === null || snapshot.headerDisplay === "none", `${testCase.path}: shared Header must not remain visible`);
        assert.equal(snapshot.visibleHeaderFocusables, 0, `${testCase.path}: hidden Header remains keyboard-focusable`);
        assert(snapshot.overflow[0] <= snapshot.overflow[1] + 1, `${testCase.path}: horizontal overflow`);

        if (viewport.label === "DESKTOP") {
          assert(Math.abs(snapshot.codeRect.centerX - 720) <= 8, `${testCase.path}: desktop 404 center drift`);
          assert(snapshot.codeRect.top >= 45 && snapshot.codeRect.top <= 95, `${testCase.path}: desktop 404 vertical drift`);
          assert(snapshot.headingRect.top >= 205 && snapshot.headingRect.top <= 255, `${testCase.path}: desktop H1 vertical drift`);
          assert(snapshot.homeRect.top >= 395 && snapshot.homeRect.top <= 435, `${testCase.path}: desktop CTA vertical drift`);
          assert(Math.abs(snapshot.homeRect.top - snapshot.hexagramsRect.top) <= 2, `${testCase.path}: desktop CTA baseline mismatch`);
        } else {
          assert(snapshot.codeRect.top >= 40 && snapshot.codeRect.top <= 110, `${testCase.path}: mobile 404 vertical drift`);
          assert(snapshot.homeRect.width >= 300 && snapshot.hexagramsRect.width >= 300, `${testCase.path}: mobile CTA width mismatch`);
          assert(snapshot.homeRect.top < snapshot.hexagramsRect.top, `${testCase.path}: mobile CTAs must stack`);
        }

        for (const label of [testCase.homeLabel, testCase.hexagramsLabel]) {
          const focused = await page.evaluate((wanted) => {
            const link = [...document.querySelectorAll("a")].find((node) => node.textContent?.trim() === wanted);
            if (!link) return false;
            link.focus();
            return document.activeElement === link;
          }, label);
          assert(focused, `${testCase.path}: keyboard focus failed for ${label}`);
        }

        const screenshot = await page.screenshot({
          type: "jpeg",
          quality: viewport.label === "DESKTOP" ? 52 : 58,
          fullPage: false,
          encoding: "base64",
        });
        const chunkSize = 48_000;
        const chunks = Math.ceil(screenshot.length / chunkSize);
        for (let index = 0; index < chunks; index += 1) {
          log(`404_VISUAL_${viewport.label}_${testCase.locale}_CHUNK_${index + 1}_OF_${chunks}=${screenshot.slice(index * chunkSize, (index + 1) * chunkSize)}`);
        }
        log(`${viewport.width}px ${testCase.locale} 404 route/metadata/layout/focus/overflow PASS`);
      } finally {
        await context.close();
      }
    }
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
    await verifyNotFoundPages(browser);
    const desktop = { width: 1440, height: 1000 };
    const mobile = { width: 375, height: 812 };
    const infoRoutePairs = [
      ["/guides/how-to-ask-the-i-ching", "/zh/guides/how-to-ask-the-i-ching"],
      ["/guides/changing-lines", "/zh/guides/changing-lines"],
      ["/guides/primary-relating-hexagrams", "/zh/guides/primary-relating-hexagrams"],
      ["/help", "/zh/help"],
      ["/privacy", "/zh/privacy"],
      ["/terms", "/zh/terms"],
      ["/acceptable-use", "/zh/acceptable-use"],
    ];

    for (const viewport of [desktop, { width: 320, height: 800 }]) {
      for (const [enPath, zhPath] of infoRoutePairs) {
        for (const [path, targetPath, targetLang] of [
          [enPath, zhPath, "zh-Hans"],
          [zhPath, enPath, "en"],
        ]) {
          await runPage(browser, {
            path,
            viewport,
            label: `${viewport.width}px Info ${path}`,
            skipQuestion: false,
            flow: async (page) => {
              await page.waitForSelector('[data-info-page="true"]', { timeout: 5000 });
              const headerVisible = await page.$eval("body > header", (node) => Boolean(node.getClientRects().length));
              assert(headerVisible, `${path}: formal Info header is not visible`);
              assert.equal(await page.$(".scene-navigation"), null, `${path}: SceneNavigation must not replace the approved Info page header`);
              const languageTarget = await page.$eval(
                `header [data-language-switcher] a[lang="${targetLang}"]`,
                (node) => node.getAttribute("href"),
              );
              assert.equal(languageTarget, targetPath, `${path}: equivalent language target mismatch`);
              assert.equal(await page.$("body > footer"), null, `${path}: retired global footer is still mounted`);
            },
          });
        }
      }
    }
    log("14 bilingual Info routes × desktop/320px formal shell, locale switch, no-footer and overflow checks PASS");
    await runPage(browser, { path: "/", viewport: desktop, flow: verifyThreeCoinTransactionSemantics, label: "Desktop Three Coin → commit/reveal/cancel semantics" });
    await runPage(browser, { path: "/", viewport: desktop, flow: finishThreeCoin, label: "Desktop homepage → Three Coin → completed cast → auth-before-reveal" });
    await runPage(browser, { path: "/methods/yarrow-stalks", viewport: desktop, flow: (page) => finishYarrow(page, true), label: "Desktop Yarrow → resume → unified result auth handoff" });
    await runPage(browser, { path: "/methods/mei-hua-yi-shu", viewport: desktop, flow: finishMeiHua, label: "Desktop Mei Hua → unified result auth handoff", skipQuestion: false });

    await runPage(browser, { path: "/", viewport: mobile, flow: finishThreeCoin, label: "375px homepage → Three Coin → auth-before-reveal" });
    await runPage(browser, { path: "/methods/yarrow-stalks", viewport: mobile, flow: (page) => finishYarrow(page, false), label: "375px Yarrow → unified result auth handoff" });
    await runPage(browser, { path: "/methods/mei-hua-yi-shu", viewport: mobile, flow: finishMeiHua, label: "375px Mei Hua → unified result auth handoff", skipQuestion: false });

    for (const viewport of [{ width: 320, height: 800 }, { width: 390, height: 844 }]) {
      await runPage(browser, {
        path: "/",
        viewport,
        label: `${viewport.width}px scene-navigation/single-stage`,
        skipQuestion: false,
        flow: async (page) => {
          await page.waitForFunction((wanted) => document.querySelector("h1")?.textContent === wanted, { timeout: 15_000 }, HOME_H1);
          assert(await page.$("[data-three-coin-ritual][data-experience-stage='landing']"), "Single-stage homepage landing is missing");
          const navigation = await page.$(".scene-navigation");
          assert(navigation, "SceneNavigation missing");
          assert.equal(await page.$('[role="dialog"][aria-modal="true"]'), null, "Retired mobile drawer is still mounted");
          const methodsTrigger = await page.$(".scene-scroll-methods");
          assert(methodsTrigger, "Other Methods trigger missing");
          await methodsTrigger.click();
          await page.waitForFunction(() => document.querySelector(".scene-navigation")?.getAttribute("data-scene-panel") === "methods", { timeout: 5000 });
          assert(await page.$(".scene-methods-panel:not([hidden])"), "Other Methods scene panel did not open");
          await page.keyboard.press("Escape");
          await page.waitForFunction(() => document.querySelector(".scene-navigation")?.getAttribute("data-scene-panel") === "closed", { timeout: 5000 });
          assert.equal(await page.$("summary"), null, "Single-stage homepage must not retain the old FAQ accordion");
          assert.equal(await page.$("body > footer"), null, "Retired global footer is still mounted");
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
