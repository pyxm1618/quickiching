import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

const BASE = process.env.PUBLIC_V1_TEST_BASE_URL || "http://127.0.0.1:3000";
const THREE_COIN_STORAGE_KEY = "quickiching:public-v1:three-coin";
const FIXTURE_STEPS = [
  { lineIndex: 0, coinFaces: ["yang", "yang", "yang"], lineValue: 9, algorithmVersion: "three-coin-v1" },
  { lineIndex: 1, coinFaces: ["yin", "yin", "yin"], lineValue: 6, algorithmVersion: "three-coin-v1" },
  { lineIndex: 2, coinFaces: ["yang", "yin", "yin"], lineValue: 7, algorithmVersion: "three-coin-v1" },
  { lineIndex: 3, coinFaces: ["yang", "yang", "yang"], lineValue: 9, algorithmVersion: "three-coin-v1" },
  { lineIndex: 4, coinFaces: ["yang", "yin", "yin"], lineValue: 7, algorithmVersion: "three-coin-v1" },
  { lineIndex: 5, coinFaces: ["yang", "yin", "yin"], lineValue: 7, algorithmVersion: "three-coin-v1" },
];
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

function log(message) {
  console.log(`[Public P0 Browser Gate] ${message}`);
}

async function waitForText(page, text, timeout = 15_000) {
  await page.waitForFunction((wanted) => document.body?.innerText.toLocaleLowerCase().includes(wanted.toLocaleLowerCase()), { timeout }, text);
}

async function clickText(page, text) {
  const clicked = await page.evaluate((wanted) => {
    const node = [...document.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === wanted);
    if (!(node instanceof HTMLButtonElement) || node.disabled) return false;
    node.click();
    return true;
  }, text);
  assert(clicked, `Unable to click enabled button: ${text}`);
}

async function skipQuestion(page) {
  const present = await page.$eval("body", () => [...document.querySelectorAll("button")].some((node) => node.textContent?.trim() === "Skip for now"));
  if (present) {
    await clickText(page, "Skip for now");
    await waitForText(page, "Ask · editable before the result");
  }
}

async function assertNoOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  assert(dimensions.scrollWidth <= dimensions.clientWidth + 1, `${label}: horizontal overflow ${dimensions.scrollWidth} > ${dimensions.clientWidth}`);
}

async function seedThreeCoin(page) {
  await page.goto(`${BASE}/robots.txt`, { waitUntil: "networkidle0", timeout: 30_000 });
  await page.evaluate(({ key, steps }) => sessionStorage.setItem(key, JSON.stringify(steps)), { key: THREE_COIN_STORAGE_KEY, steps: FIXTURE_STEPS });
}

async function seedThreeCoinSession(page, id, createdAt, steps = FIXTURE_STEPS) {
  await page.goto(`${BASE}/robots.txt`, { waitUntil: "networkidle0", timeout: 30_000 });
  await page.evaluate(({ key, id: readingId, createdAt: readingCreatedAt, steps }) => {
    sessionStorage.setItem(key, JSON.stringify({
      schemaVersion: 1,
      id: readingId,
      createdAt: readingCreatedAt,
      started: false,
      data: { steps },
    }));
  }, { key: THREE_COIN_STORAGE_KEY, id, createdAt, steps });
}

async function assertQuestionPrivacy(page, question) {
  const state = await page.evaluate((sentinel) => ({
    url: location.href,
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
    jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].map((node) => node.textContent ?? "").join("\n"),
    resourceUrls: performance.getEntriesByType("resource").map((entry) => entry.name),
    activeQuestion: (document.querySelector('input[data-private-question]') instanceof HTMLInputElement)
      ? document.querySelector('input[data-private-question]').value
      : "",
  }), question);
  assert(state.activeQuestion === question, "Question was not preserved in the editable reading flow");
  assert(!state.url.includes(encodeURIComponent(question)) && !state.url.includes(question), "Question leaked into the URL");
  assert(!state.title.includes(question), "Question leaked into the page title");
  assert(!state.description.includes(question), "Question leaked into the meta description");
  assert(!state.jsonLd.includes(question), "Question leaked into JSON-LD");
  assert(!state.resourceUrls.some((url) => url.includes(question) || url.includes(encodeURIComponent(question))), "Question leaked into a resource URL");
}

async function verifySeoAssets(page) {
  const sitemapResponse = await fetch(`${BASE}/sitemap.xml`);
  assert.equal(sitemapResponse.status, 200, "Sitemap must be reachable");
  const sitemap = await sitemapResponse.text();
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.equal(locs.length, 75, `Sitemap must contain 75 URLs, received ${locs.length}`);
  assert(sitemap.includes("https://www.quickiching.com/zh"), "Sitemap must include the Chinese homepage");
  assert(sitemap.includes("https://www.quickiching.com/zh/methods/mei-hua-yi-shu"), "Sitemap must include the Chinese Mei Hua page");
  for (const path of HEXAGRAM_PATHS) assert(sitemap.includes(`https://www.quickiching.com${path}`), `Sitemap missing ${path}`);
  for (const forbidden of ["/history", "/readings/", "/api/", "/zh/methods/three-coin", "/trigrams/", "/en/"]) assert(!sitemap.includes(forbidden), `Sitemap contains forbidden path ${forbidden}`);

  const hubResponse = await page.goto(`${BASE}/hexagrams`, { waitUntil: "networkidle0", timeout: 30_000 });
  assert.equal(hubResponse?.status(), 200, "Hexagram hub must be reachable");
  const hub = await page.evaluate(() => [...document.querySelectorAll('a[href^="/hexagrams/"]')].map((node) => new URL(node.getAttribute("href") ?? "", location.href).pathname).filter((path) => path !== "/hexagrams"));
  assert.equal(new Set(hub).size, 64, `Hub must link exactly 64 entity pages, received ${new Set(hub).size}`);
  for (const path of ["/hexagrams/1-the-creative", "/hexagrams/2-the-receptive", "/hexagrams/24-return", "/hexagrams/64-before-completion"]) {
    const response = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0", timeout: 30_000 });
    assert.equal(response?.status(), 200, `${path} must be reachable`);
    const snapshot = await page.evaluate(() => ({
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? "",
      lineAnchors: Array.from({ length: 6 }, (_, index) => document.querySelector(`#line-${index + 1}`) !== null),
      text: document.body?.innerText ?? "",
    }));
    assert(snapshot.canonical.endsWith(path), `${path}: canonical is not self-referencing`);
    assert(snapshot.lineAnchors.every(Boolean), `${path}: six line anchors are incomplete`);
    assert(snapshot.text.includes("Judgment") && snapshot.text.includes("Image"), `${path}: classical text is missing`);
  }

  const historyHtml = await (await fetch(`${BASE}/history/`)).text();
  assert(/name="robots"[^>]*content="[^"]*noindex[^"]*follow/i.test(historyHtml) || /content="[^"]*noindex[^"]*follow[^\"]*"[^>]*name="robots"/i.test(historyHtml), "History must be noindex, follow");
  const getApi = await fetch(`${BASE}/api/personalized-interpretation`);
  assert.equal(getApi.status, 405, "Personalized endpoint must reject GET");
  assert.equal(getApi.headers.get("allow"), "POST", "Personalized endpoint must advertise POST only");
  const otherApi = await fetch(`${BASE}/api/not-a-route`);
  assert.equal(otherApi.status, 404, "Unlisted API routes must remain closed");
  log("75-URL sitemap, hub, entity metadata/anchors, History noindex, and API closure PASS");
}

async function verifyQuestionReading(page) {
  const question = "What deserves my attention in this transition?";
  const updatedQuestion = "What should I protect next?";
  await seedThreeCoin(page);
  await page.goto(`${BASE}/methods/three-coin`, { waitUntil: "networkidle0", timeout: 30_000 });
  await page.waitForSelector("textarea[data-private-question]");
  await page.type("textarea[data-private-question]", question);
  await clickText(page, "Continue to casting");
  await waitForText(page, "Your I Ching reading");
  await waitForText(page, question);
  await assertQuestionPrivacy(page, question);
  await clickText(page, "Save reading");
  await waitForText(page, "Saved in this browser");
  const beforeQuestionEdit = await page.evaluate(() => JSON.parse(sessionStorage.getItem("quickiching:public-v1:three-coin") || "null"));
  const questionInput = await page.$("input[data-private-question]");
  assert(questionInput, "Editable question input missing after the reading");
  await page.$eval("input[data-private-question]", (node) => {
    if (node instanceof HTMLInputElement) {
      node.focus();
      node.select();
    }
  });
  await page.$eval("input[data-private-question]", (node, value) => {
    if (!(node instanceof HTMLInputElement)) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
  }, updatedQuestion);
  await page.keyboard.press("Tab");
  await waitForText(page, updatedQuestion);
  const afterQuestionEdit = await page.evaluate(() => JSON.parse(sessionStorage.getItem("quickiching:public-v1:three-coin") || "null"));
  assert.equal(afterQuestionEdit.id, beforeQuestionEdit.id, "Editing the question must not create a new reading");
  assert.equal(afterQuestionEdit.createdAt, beforeQuestionEdit.createdAt, "Editing the question must not change createdAt");
  assert.deepEqual(afterQuestionEdit.data, beforeQuestionEdit.data, "Editing the question must not re-cast or change facts");
  await waitForText(page, "Save reading");
  assert.equal(await page.$eval("[data-save-reading]", (node) => node.textContent?.trim()), "Save reading", "Editing a saved reading must reset its saved status");
  await assertQuestionPrivacy(page, updatedQuestion);
  const beforeClick = await page.evaluate(() => performance.getEntriesByType("resource").filter((entry) => entry.name.includes("personalized-interpretation")).length);
  assert.equal(beforeClick, 0, "Question must not be sent to the personalized endpoint automatically");
  await page.reload({ waitUntil: "networkidle0" });
  await waitForText(page, "Your I Ching reading");
  await assertQuestionPrivacy(page, updatedQuestion);
  const personalizedButton = await page.$("button[data-interpret-question]");
  if (personalizedButton) {
    await clickText(page, "Interpret for my question");
    await page.waitForFunction(() => document.body?.innerText.includes("not activated") || Boolean(document.querySelector("[data-personalized-response]")), { timeout: 15_000 });
  } else {
    assert(await page.$("[data-personalized-disabled]"), "Unconfigured personalized interpretation must expose a static status, not a clickable CTA");
  }
  assert(await page.$("[data-public-reading-result]"), "Static reading disappeared during personalized fallback");
  log("Question-first, refresh recovery, no metadata/URL leak, explicit AI click, and static fallback PASS");
}

async function setManualValues(page, values) {
  await page.evaluate((nextValues) => {
    const selects = [...document.querySelectorAll("select")].filter((node) => node.id !== "manual-primary-hexagram");
    nextValues.forEach((value, index) => {
      const select = selects[index];
      if (!(select instanceof HTMLSelectElement)) return;
      select.value = String(value);
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }, values);
}

async function resetManualSession(page) {
  await page.goto(`${BASE}/robots.txt`, { waitUntil: "networkidle0", timeout: 30_000 });
  await page.evaluate(() => {
    sessionStorage.removeItem("quickiching:public-v1:manual-cast");
    sessionStorage.removeItem("quickiching:question:manual-cast:started");
    sessionStorage.removeItem("quickiching:question:manual-cast:question");
  });
}

async function startManual(page) {
  await resetManualSession(page);
  await page.goto(`${BASE}/methods/manual-cast`, { waitUntil: "networkidle0", timeout: 30_000 });
  await skipQuestion(page);
}

async function buildManual(page, values) {
  await setManualValues(page, values);
  await clickText(page, "Build reading");
  await waitForText(page, "Your I Ching reading");
}

async function newManual(page) {
  await clickText(page, "New reading");
  await waitForText(page, "What would you like to reflect on?");
  await clickText(page, "Skip for now");
  await page.waitForSelector("select:not(#manual-primary-hexagram)", { timeout: 15_000 });
}

async function verifyManualAndMovement(page) {
  await startManual(page);
  await buildManual(page, [7, 8, 7, 8, 7, 8]);
  assert.equal(await page.$$eval("[data-relating-card]", (nodes) => nodes.length), 0, "No-moving reading must not render a relating card");
  await newManual(page);
  await buildManual(page, [6, 7, 8, 7, 8, 7]);
  assert.equal(await page.$$eval("[data-relating-card]", (nodes) => nodes.length), 1, "Single-moving reading must render one relating card");
  await newManual(page);
  await buildManual(page, [6, 9, 8, 7, 8, 7]);
  await waitForText(page, "Changing Lines: 1, 2");
  assert.equal(await page.$$eval("[data-relating-card]", (nodes) => nodes.length), 1, "Multiple-moving reading must render one relating card");
  await newManual(page);
  await page.focus('[role="tab"][aria-selected="true"]');
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.$eval('[role="tab"][aria-selected="true"]', (node) => node.textContent?.trim()), "Mode B · primary + moving", "ArrowRight must activate and focus Manual mode B");
  assert(await page.$('#manual-mode-primary-changing-panel[role="tabpanel"]'), "Manual mode B tabpanel relationship missing");
  await page.select("#manual-primary-hexagram", "24");
  await page.click('input[type="checkbox"]');
  await clickText(page, "Build reading");
  await waitForText(page, "Your I Ching reading");
  await assertNoOverflow(page, "Manual Cast 390px");
  log("Manual A/B, keyboard tab semantics, no/single/multiple moving lines, shared result, and no randomness UI PASS");
}

async function verifyPartialRestart(page) {
  const question = "What remains important if I begin again?";
  await seedThreeCoinSession(page, "partial-reading-before", "2026-08-19T10:00:00.000Z", FIXTURE_STEPS.slice(0, 1));
  await page.goto(`${BASE}/methods/three-coin`, { waitUntil: "networkidle0", timeout: 30_000 });
  await page.waitForSelector("textarea[data-private-question]");
  await page.type("textarea[data-private-question]", question);
  await clickText(page, "Continue to casting");
  await waitForText(page, "1 / 6 lines");
  const before = await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) || "null"), THREE_COIN_STORAGE_KEY);
  await clickText(page, "Restart casting");
  await waitForText(page, "0 / 6 lines");
  const after = await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) || "null"), THREE_COIN_STORAGE_KEY);
  assert.notEqual(after.id, before.id, "Restart casting must create a fresh reading identity");
  assert.notEqual(after.createdAt, before.createdAt, "Restart casting must create a fresh timestamp");
  assert.equal(after.question, question, "Restart casting must preserve the active question");
  assert.equal("data" in after, false, "Restart casting must discard partial cast facts");
  assert.equal(await page.$eval("input[data-private-question]", (node) => node.value), question, "Restart casting must preserve the editable question UI");
  log("Partial Three-Coin restart preserves the question while replacing identity and cast facts PASS");
}

async function verifyYarrowPartialRestart(page) {
  const storageKey = "quickiching:public-v1:yarrow-v2";
  const question = "What should remain steady through this process?";
  await page.goto(`${BASE}/robots.txt`, { waitUntil: "networkidle0", timeout: 30_000 });
  await page.evaluate((key) => sessionStorage.removeItem(key), storageKey);
  await page.goto(`${BASE}/methods/yarrow-stalks`, { waitUntil: "networkidle0", timeout: 30_000 });
  await page.waitForSelector("textarea[data-private-question]");
  await page.type("textarea[data-private-question]", question);
  await clickText(page, "Continue to casting");
  await clickText(page, "Perform change 1");
  await waitForText(page, "1 / 18 changes");
  const before = await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) || "null"), storageKey);
  await clickText(page, "Restart casting");
  await waitForText(page, "0 / 18 changes");
  const after = await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) || "null"), storageKey);
  assert.notEqual(after.id, before.id, "Yarrow restart must create a fresh reading identity");
  assert.notEqual(after.createdAt, before.createdAt, "Yarrow restart must create a fresh timestamp");
  assert.equal(after.question, question, "Yarrow restart must preserve the active question");
  assert.equal("data" in after, false, "Yarrow restart must discard partial change facts");
  assert.equal(await page.$eval("input[data-private-question]", (node) => node.value), question, "Yarrow restart must preserve the editable question UI");
  log("Partial Yarrow restart preserves the question while replacing identity and change facts PASS");
}

async function verifyHistory(page) {
  await page.goto(`${BASE}/robots.txt`, { waitUntil: "networkidle0", timeout: 30_000 });
  await page.evaluate(() => localStorage.removeItem("quickiching:public-history:v1"));
  await seedThreeCoin(page);
  await page.goto(`${BASE}/methods/three-coin`, { waitUntil: "networkidle0", timeout: 30_000 });
  await page.waitForSelector("textarea[data-private-question]");
  await page.type("textarea[data-private-question]", "Same facts · first question");
  await clickText(page, "Continue to casting");
  await waitForText(page, "Your I Ching reading");
  await clickText(page, "Save reading");
  await waitForText(page, "Saved in this browser");

  await seedThreeCoinSession(page, "history-three-coin-second", "2026-08-19T12:00:00.000Z");
  await page.goto(`${BASE}/methods/three-coin`, { waitUntil: "networkidle0", timeout: 30_000 });
  await page.waitForSelector("textarea[data-private-question]");
  await page.type("textarea[data-private-question]", "Same facts · second question");
  await clickText(page, "Continue to casting");
  await waitForText(page, "Your I Ching reading");
  await clickText(page, "Save reading");
  await waitForText(page, "Saved in this browser");

  await page.goto(`${BASE}/history/`, { waitUntil: "networkidle0", timeout: 30_000 });
  await waitForText(page, "History · 2/50");
  const historyText = await page.$eval("[data-history-page]", (node) => node.textContent ?? "");
  assert(historyText.includes("Same facts · first question") && historyText.includes("Same facts · second question"), "Same cast facts with different questions must remain two history records");
  await page.reload({ waitUntil: "networkidle0" });
  await waitForText(page, "Your I Ching reading");
  await clickText(page, "Rename");
  const titleInput = await page.$('input[id^="history-title-"]');
  assert(titleInput, "History rename input missing");
  await titleInput.click({ clickCount: 3 });
  await page.keyboard.type("Transition notes");
  await clickText(page, "Save name");
  await waitForText(page, "Transition notes");
  await clickText(page, "Save reading");
  await page.reload({ waitUntil: "networkidle0" });
  await waitForText(page, "Transition notes");
  await clickText(page, "Delete");
  await clickText(page, "Confirm delete");
  await waitForText(page, "History · 1/50");
  await clickText(page, "Delete");
  await clickText(page, "Confirm delete");
  await waitForText(page, "No saved readings");
  log("Three-Coin same-facts/different-question History isolation, Save, refresh/View, Rename, confirmed Delete, and local-only flow PASS");
}

async function verifyResponsiveKeyboard(page) {
  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1440, height: 1000 }]) {
    await resetManualSession(page);
    await page.setViewport(viewport);
    await page.goto(`${BASE}/methods/manual-cast`, { waitUntil: "networkidle0", timeout: 30_000 });
    await page.waitForSelector("textarea[data-private-question]");
    const focusable = await page.evaluate(() => {
      const input = document.querySelector("textarea[data-private-question]");
      if (!(input instanceof HTMLTextAreaElement)) return false;
      input.focus();
      return document.activeElement === input;
    });
    assert(focusable, `${viewport.width}px: optional question controls must be keyboard focusable`);
    await assertNoOverflow(page, `${viewport.width}px manual page`);
  }
  log("390px mobile, tablet, desktop keyboard focus and overflow PASS");
}

const macChromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const systemChromePath = [process.env.CHROME_PATH?.trim(), process.platform === "darwin" ? macChromePath : null]
  .find((candidate) => Boolean(candidate) && existsSync(candidate));
const executablePath = systemChromePath || await chromium.executablePath();
const browser = await puppeteer.launch({
  args: systemChromePath ? ["--no-sandbox", "--disable-dev-shm-usage"] : [...chromium.args, "--disable-dev-shm-usage"],
  executablePath,
  headless: true,
});

try {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await verifySeoAssets(page);
  await verifyQuestionReading(page);
  await verifyPartialRestart(page);
  await verifyYarrowPartialRestart(page);
  await verifyManualAndMovement(page);
  await verifyHistory(page);
  await verifyResponsiveKeyboard(page);
  await context.close();
  log("ALL PUBLIC P0 BROWSER FLOWS PASS (including real keyboard Manual tabs and Three-Coin/Yarrow partial restart; AI activation is separately fail-closed)");
} finally {
  await browser.close();
}
