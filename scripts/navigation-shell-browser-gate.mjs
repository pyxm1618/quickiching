// Real-browser proof for the S04 Global Navigation Shell and for reactive
// navigation context (same-path query/hash changes and back/forward).
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { resolveChromeExecutable } from "./browser-runtime.mjs";

const BASE = process.env.PUBLIC_V1_TEST_BASE_URL || "http://127.0.0.1:3036";
const VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "390x844", width: 390, height: 844 },
];
const HEX = "24-return";
const CHECKOUT_RETURN_CONTEXT_KEY = "quickiching:commercial:checkout-return:v1";
const CASES = [
  { locale: "en", pathname: `/hexagrams/${HEX}`, expectedLocalePath: `/zh/hexagrams/${HEX}`, hub: "/hexagrams", home: "/", sectionLabel: "On this page" },
  { locale: "zh-Hans", pathname: `/zh/hexagrams/${HEX}`, expectedLocalePath: `/hexagrams/${HEX}`, hub: "/zh/hexagrams", home: "/zh", sectionLabel: "本页目录" },
];

function log(message) {
  console.log(`[Navigation Shell Browser Gate] ${message}`);
}

const { executablePath, usingSystemChrome } = await resolveChromeExecutable(chromium);
const browser = await puppeteer.launch({
  args: usingSystemChrome ? ["--no-sandbox", "--disable-dev-shm-usage"] : [...chromium.args, "--disable-dev-shm-usage"],
  executablePath,
  headless: true,
});

async function newPage(viewport) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  // Dismiss the transient consent panel so it cannot intercept any interaction.
  await page.goto(`${BASE}/robots.txt`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("quickiching:analytics-consent:v1", "denied"));
  return { context, page, errors };
}

async function open(page, pathname) {
  const response = await page.goto(`${BASE}${pathname}`, { waitUntil: "networkidle0", timeout: 30_000 });
  assert([200, 304].includes(response?.status() ?? 0), `${pathname}: expected HTTP 200/304`);
}

function visible(rect, style) {
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0";
}

async function inspect(page, selector) {
  return page.$eval(selector, (node) => {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return {
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom, top: rect.top, right: rect.right, left: rect.left },
      position: style.position,
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      href: node.getAttribute("href"),
      text: node.textContent?.trim() ?? "",
    };
  });
}

async function clickableAtCenter(page, selector) {
  return page.$eval(selector, async (node) => {
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    node.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const moved = node.getBoundingClientRect();
    const hit = document.elementFromPoint(moved.x + moved.width / 2, moved.y + moved.height / 2);
    return hit === node || node.contains(hit);
  });
}

async function verifyS04(page, viewport, testCase, authClosed) {
  const tag = `${viewport.name} ${testCase.pathname}`;
  await open(page, testCase.pathname);

  // 1. Shell capability is visible, real and in normal document flow.
  const header = await inspect(page, 'body > header[data-navigation-surface="S04"]');
  assert(visible(header.rect, header), `${tag}: S04 Global Navigation Shell is not visible`);
  assert.equal(header.position, "relative", `${tag}: S04 shell must reserve its own band, not overlay the page`);
  assert.equal(await page.$('body > header[data-navigation-mode="content"]') !== null, true, `${tag}: Content mode missing`);
  assert.equal(await page.$('body > header[data-primary-navigation="yes"]') !== null, true, `${tag}: contract must declare Primary Nav YES`);

  const article = await inspect(page, "main article[data-hexagram-detail]");
  assert(article.rect.top >= header.rect.bottom - 1, `${tag}: shell overlaps the knowledge article`);

  // 2. Home — visible, clickable, and the only shell-owned home target.
  const home = await inspect(page, "body > header [data-shell-home]");
  assert(visible(home.rect, home), `${tag}: Home control not visible`);
  assert.equal(home.href, testCase.home, `${tag}: Home target must be the localized root`);
  assert(await clickableAtCenter(page, "body > header [data-shell-home]"), `${tag}: Home control is not clickable`);
  assert.equal(await page.$$eval("body > header [data-shell-home]", (nodes) => nodes.length), 1, `${tag}: duplicate Home owner`);

  // 3. Locale — visible and semantically equivalent (same hexagram).
  const localeNav = await inspect(page, "body > header [data-language-switcher]");
  assert(visible(localeNav.rect, localeNav), `${tag}: Locale control not visible`);
  const localeLink = await inspect(page, "body > header [data-locale-target]");
  assert(visible(localeLink.rect, localeLink), `${tag}: Language target not visible`);
  assert.equal(localeLink.href, testCase.expectedLocalePath, `${tag}: locale must switch to the same hexagram`);
  assert(await clickableAtCenter(page, "body > header [data-locale-target]"), `${tag}: Locale control is not clickable`);

  // 4. Account capability obeys the auth gate.
  const accountControl = await page.$("body > header [data-shell-account]");
  if (authClosed) {
    assert.equal(accountControl, null, `${tag}: auth disabled must not render Account`);
    assert.equal(await page.$("body > header a[href$='/signin']"), null, `${tag}: auth disabled must not render Sign In`);
  } else {
    assert(accountControl, `${tag}: auth enabled must render Account`);
    const account = await inspect(page, "body > header [data-shell-account]");
    assert(visible(account.rect, account), `${tag}: Account control not visible`);
  }

  // 5. Primary navigation is visible and its destinations are reachable.
  const primary = await inspect(page, "body > header [data-primary-navigation]");
  assert(visible(primary.rect, primary), `${tag}: Primary Navigation not visible`);
  assert(await clickableAtCenter(page, "body > header [data-primary-hexagrams]"), `${tag}: Hexagrams discovery link not clickable`);
  for (const group of ["methods", "info"]) {
    const selector = `body > header summary[data-primary-group="${group}"]`;
    const summary = await inspect(page, selector);
    assert(visible(summary.rect, summary), `${tag}: ${group} group is not visible`);
    assert(await clickableAtCenter(page, selector), `${tag}: ${group} group is not clickable`);
    await page.click(selector);
    const links = await page.$$eval(`body > header [data-primary-group="${group}"] ~ div a`, (nodes) => nodes.map((node) => node.getAttribute("href")));
    assert(links.length > 0, `${tag}: ${group} group exposes no destinations`);
    for (const href of links) assert(href && href.startsWith("/"), `${tag}: invalid ${group} destination ${href}`);
    if (group === "methods") {
      const normalized = links.map((href) => href?.replace(/^\/zh/, "")).sort();
      assert.deepEqual(normalized, [
        "/methods/manual-cast",
        "/methods/mei-hua-yi-shu",
        "/methods/yarrow-stalks",
      ], `${tag}: Other Methods must be exactly Yarrow / Mei Hua / Manual`);
    }
    await page.click(selector);
  }

  // 6. Neither the body copy nor the section navigation is covered.
  const sectionNavSelector = `main article[data-hexagram-detail] nav[aria-label="${testCase.sectionLabel}"]`;
  const sectionNav = await inspect(page, sectionNavSelector);
  assert(visible(sectionNav.rect, sectionNav), `${tag}: section navigation not visible`);
  assert(sectionNav.rect.top >= header.rect.bottom - 1, `${tag}: shell covers section navigation`);
  assert(await clickableAtCenter(page, `${sectionNavSelector} a`), `${tag}: section navigation link is not clickable`);
  const h1Hit = await page.$eval("main article[data-hexagram-detail] h1", (node) => {
    const rect = node.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return hit ? Boolean(hit.closest("article[data-hexagram-detail]")) && !hit.closest("body > header") : false;
  });
  assert(h1Hit, `${tag}: shell covers the detail headline`);

  // 7. Previous / Back to 64 / Next remain valid local navigation.
  const auxiliary = "main article[data-hexagram-detail] [data-auxiliary-navigation]";
  const localHrefs = await page.$$eval(`${auxiliary} a`, (nodes) => nodes.map((node) => node.getAttribute("href")));
  assert(localHrefs.length >= 3, `${tag}: Previous / Back to 64 / Next must all exist`);
  assert(localHrefs.includes(testCase.hub), `${tag}: Back to 64 target missing`);
  assert(localHrefs.some((href) => href?.startsWith(testCase.hub + "/")), `${tag}: Previous / Next targets missing`);
  for (const selector of [`${auxiliary} a`, `${auxiliary} [data-seo-hub-link]`]) {
    assert(await clickableAtCenter(page, selector), `${tag}: local navigation ${selector} is not clickable`);
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${tag}: horizontal overflow`);

  // Real click: Back to 64 Hexagrams.
  await page.click(`${auxiliary} [data-seo-hub-link]`);
  await page.waitForFunction((expected) => location.pathname === expected, { timeout: 15_000 }, testCase.hub);
  log(`${tag}: shell capabilities, layout, section nav and local navigation PASS`);

  // 8. Locale switching really lands on the same hexagram (with a semantic hash).
  await open(page, `${testCase.pathname}#line-3`);
  const withHash = await inspect(page, "body > header [data-locale-target]");
  assert.equal(withHash.href, `${testCase.expectedLocalePath}#line-3`, `${tag}: semantic fragment must survive`);
  await page.click("body > header [data-locale-target]");
  await page.waitForFunction((expected) => location.pathname === expected, { timeout: 15_000 }, testCase.expectedLocalePath);
  const landedHash = await page.evaluate(() => location.hash);
  assert.equal(landedHash, "#line-3", `${tag}: locale switch lost the semantic fragment`);
  const mirrored = await inspect(page, 'body > header[data-navigation-surface="S04"]');
  assert(visible(mirrored.rect, mirrored), `${tag}: localized detail must also own the shell`);
  log(`${tag}: locale semantic equivalence PASS`);
}

async function verifyReactiveContext(page, viewport) {
  const tag = `${viewport.name} reactive context`;
  await open(page, "/readings/result?session=A");
  const readLocale = () => page.$eval("body > header [data-locale-target], body > header .scene-languages a[lang], body > header [data-language-switcher] a", (node) => node.getAttribute("href"));
  const initial = await readLocale();
  assert(initial?.includes("session=A"), `${tag}: initial locale target lost the session (${initial})`);

  // Same pathname, changed query — the shared context must refresh the target.
  await page.evaluate(() => {
    window.history.pushState({}, "", "/readings/result?session=B");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await page.waitForFunction(() => {
    const link = document.querySelector("body > header [data-locale-target], body > header .scene-languages a[lang], body > header [data-language-switcher] a");
    return link?.getAttribute("href")?.includes("session=B") ?? false;
  }, { timeout: 10_000 });

  // Back/forward returns to the earlier query and must refresh again.
  await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForFunction(() => {
    const link = document.querySelector("body > header [data-locale-target], body > header .scene-languages a[lang], body > header [data-language-switcher] a");
    return link?.getAttribute("href")?.includes("session=A") ?? false;
  }, { timeout: 10_000 });
  log(`${tag}: same-path query + back/forward PASS`);

  // Same pathname, changed hash (S04 keeps a semantic fragment).
  await open(page, `/hexagrams/${HEX}#line-2`);
  await page.evaluate(() => { window.location.hash = "#line-4"; });
  await page.waitForFunction(() => {
    const link = document.querySelector("body > header [data-locale-target]");
    return link?.getAttribute("href")?.includes("#line-4") ?? false;
  }, { timeout: 10_000 });
  log(`${tag}: same-path hash PASS`);
}

async function verifyPaymentReturnSurface(page, viewport) {
  const tag = `${viewport.name} payment return`;
  for (const pathname of ["/pricing?orderId=ord_nav_A", "/zh/pricing?orderId=ord_nav_A"]) {
    const response = await fetch(`${BASE}${pathname}`);
    assert.equal(response.status, 200, `${tag}: server render failed for ${pathname}`);
    const html = await response.text();
    assert(html.includes('data-navigation-surface="S16"'), `${tag}: initial server render must classify ${pathname} as S16`);
    assert(html.includes('data-navigation-mode="flow"'), `${tag}: initial server render must be Flow mode`);
    assert(!html.includes('data-navigation-surface="S15"'), `${tag}: initial server render must never expose S15 first`);
  }

  const returnUrl = "/readings/deep?session=B";
  await page.evaluate(({ key, orderId, returnUrl }) => {
    const now = Date.now();
    sessionStorage.setItem(key, JSON.stringify({
      orderId,
      returnUrl,
      creditsBeforeCheckout: 0,
      createdAt: now,
      expiresAt: now + 10 * 60_000,
    }));
  }, { key: CHECKOUT_RETURN_CONTEXT_KEY, orderId: "ord_nav_A", returnUrl });

  await open(page, `/pricing?orderId=ord_nav_A&returnUrl=${encodeURIComponent(returnUrl)}`);
  assert(await page.$('body > header[data-navigation-surface="S16"][data-navigation-mode="flow"]'), `${tag}: EN payment return must stay S16`);
  assert.equal(await page.$("body > header .scene-scrolls"), null, `${tag}: S16 must not expose Primary Navigation`);

  let target = await page.$eval("body > header [data-locale-target]", (node) => node.getAttribute("href"));
  let parsed = new URL(target ?? "", "https://quickiching.test");
  assert.equal(parsed.pathname, "/zh/pricing", `${tag}: locale target must preserve Pricing surface`);
  assert.equal(parsed.searchParams.get("orderId"), "ord_nav_A", `${tag}: locale target lost orderId`);
  assert.equal(parsed.searchParams.get("returnUrl"), "/zh/readings/deep?session=B", `${tag}: nested returnUrl was not localized`);

  await page.click("body > header [data-locale-target]");
  await page.waitForFunction(() => location.pathname === "/zh/pricing", { timeout: 15_000 });
  assert.equal(await page.evaluate(() => new URLSearchParams(location.search).get("orderId")), "ord_nav_A", `${tag}: EN→ZH lost orderId`);
  assert.equal(await page.evaluate(() => new URLSearchParams(location.search).get("returnUrl")), "/zh/readings/deep?session=B", `${tag}: EN→ZH lost semantic returnUrl`);
  assert(await page.$('body > header[data-navigation-surface="S16"]'), `${tag}: localized payment return must remain S16`);

  target = await page.$eval("body > header [data-locale-target]", (node) => node.getAttribute("href"));
  parsed = new URL(target ?? "", "https://quickiching.test");
  assert.equal(parsed.pathname, "/pricing", `${tag}: reverse locale target must preserve Pricing surface`);
  assert.equal(parsed.searchParams.get("orderId"), "ord_nav_A", `${tag}: reverse locale target lost orderId`);
  assert.equal(parsed.searchParams.get("returnUrl"), "/readings/deep?session=B", `${tag}: reverse nested returnUrl was not localized`);

  await page.click("body > header [data-locale-target]");
  await page.waitForFunction(() => location.pathname === "/pricing", { timeout: 15_000 });
  assert.equal(await page.evaluate(() => new URLSearchParams(location.search).get("orderId")), "ord_nav_A", `${tag}: ZH→EN lost orderId`);
  log(`${tag}: S16 initial authority + payment locale identity PASS`);
}

try {
  const authClosed = (await fetch(`${BASE}/account`, { redirect: "manual" })).status === 410;
  log(`Auth capability gate: ${authClosed ? "closed" : "enabled"}`);

  for (const viewport of VIEWPORTS) {
    const { context, page, errors } = await newPage(viewport);
    try {
      for (const testCase of CASES) await verifyS04(page, viewport, testCase, authClosed);
      await verifyReactiveContext(page, viewport);
      await verifyPaymentReturnSurface(page, viewport);
      assert.deepEqual(errors, [], `${viewport.name}: page errors`);
    } finally {
      await context.close();
    }
  }
  log("ALL S04 SHELL + REACTIVE CONTEXT BROWSER CHECKS PASS");
} finally {
  await browser.close();
}
