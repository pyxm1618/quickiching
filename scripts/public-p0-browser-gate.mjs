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
const NO_CHANGE_STEPS = Array.from({ length: 6 }, (_, lineIndex) => ({
  lineIndex,
  coinFaces: lineIndex % 2 === 0 ? ["yang", "yin", "yin"] : ["yang", "yin", "yang"],
  lineValue: lineIndex % 2 === 0 ? 7 : 8,
  algorithmVersion: "three-coin-v1",
}));
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
const CHINESE_HEXAGRAM_PATHS = HEXAGRAM_PATHS.map((path) => "/zh" + path);

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
  const skipLabel = await page.$eval("body", () => [...document.querySelectorAll("button")]
    .map((node) => node.textContent?.trim())
    .find((text) => text === "Skip — free reading only"));
  assert.equal(skipLabel, "Skip — free reading only", "Question skip must clearly leave this cast free-only");
  await clickText(page, skipLabel);
  await waitForText(page, "Question · set before the first line");
}

async function assertNoOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  assert(dimensions.scrollWidth <= dimensions.clientWidth + 1, `${label}: horizontal overflow ${dimensions.scrollWidth} > ${dimensions.clientWidth}`);
}

async function resetThreeCoin(page) {
  await page.goto(`${BASE}/robots.txt`, { waitUntil: "networkidle0", timeout: 30_000 });
  await page.evaluate((key) => {
    sessionStorage.removeItem(key);
    sessionStorage.removeItem("quickiching:question:three-coin:started");
    sessionStorage.removeItem("quickiching:question:three-coin:question");
  }, THREE_COIN_STORAGE_KEY);
}

async function seedThreeCoin(page, question) {
  await seedThreeCoinSession(page, `fixture-${Date.now()}`, new Date().toISOString(), FIXTURE_STEPS, question);
}

async function verifyChineseNoChangingLines(page) {
  await seedThreeCoinSession(page, `fixture-no-change-${Date.now()}`, new Date().toISOString(), NO_CHANGE_STEPS, "这次起卦没有动爻吗？");
  await page.goto(`${BASE}/zh/methods/three-coin`, { waitUntil: "networkidle0", timeout: 30_000 });
  await page.waitForFunction(() => location.pathname === "/zh/readings/three-coin/result", { timeout: 15_000 });
  const result = await page.$eval("[data-public-reading-result]", (node) => ({
    text: node.textContent ?? "",
    overviewLabel: node.querySelector("[data-primary-overview]")?.getAttribute("aria-label") ?? "",
    overviewDescription: node.querySelector("[data-primary-overview]")?.textContent ?? "",
    bridgeLabel: node.querySelector(".change-bridge")?.getAttribute("aria-label") ?? "",
    relatingCards: node.querySelectorAll("[data-relating-card]").length,
    noRelatingCards: node.querySelectorAll("[data-no-relating-card]").length,
  }));
  assert(result.text.includes("无动爻"), "Chinese result must identify that no lines changed");
  assert(result.text.includes("本次没有变卦（之卦）"), "Chinese result must say no relating hexagram was produced");
  assert(result.text.includes("六爻均未发生变化，因此本次阅读以本卦为核心。"), "Chinese no-change result must explain why there is no relating hexagram");
  assert(result.overviewLabel.includes("本卦"), "Chinese overview aria label must identify the primary hexagram");
  assert(result.overviewDescription.includes("无动爻"), "Chinese overview must expose no changing lines to assistive technology");
  assert(result.bridgeLabel.includes("无动爻") && result.bridgeLabel.includes("本次没有变卦"), "Chinese bridge aria label must describe the unchanged cast");
  assert.equal(result.relatingCards, 0, "A no-change cast must not render a fabricated relating hexagram");
  assert.equal(result.noRelatingCards, 1, "A no-change cast must explain the missing relating hexagram");
  assert(!/None\b/.test(result.text), "Chinese no-change result must not expose an English None label");
  log("Chinese Three-Coin no-changing-lines labels, explanation, and screen-reader text PASS");
}

async function seedThreeCoinSession(page, id, createdAt, steps = FIXTURE_STEPS, question = "") {
  await page.goto(`${BASE}/robots.txt`, { waitUntil: "networkidle0", timeout: 30_000 });
  await page.evaluate(({ key, id: readingId, createdAt: readingCreatedAt, steps, question: coreQuestionAtCast }) => {
    sessionStorage.setItem(key, JSON.stringify({
      schemaVersion: 1,
      id: readingId,
      createdAt: readingCreatedAt,
      started: true,
      ...(coreQuestionAtCast ? { question: coreQuestionAtCast, coreQuestionAtCast, coreQuestionFrozenAtCast: true } : {}),
      data: { steps },
    }));
  }, { key: THREE_COIN_STORAGE_KEY, id, createdAt, steps, question });
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
      : document.querySelector('[data-core-question-at-cast]')?.textContent?.trim() ?? "",
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
  assert.equal(locs.length, 146, `Sitemap must contain 146 URLs, received ${locs.length}`);
  assert(sitemap.includes("https://www.quickiching.com/zh"), "Sitemap must include the Chinese homepage");
  assert(sitemap.includes("https://www.quickiching.com/zh/methods/three-coin"), "Sitemap must include the Chinese Three Coin page");
  assert(sitemap.includes("https://www.quickiching.com/zh/methods/mei-hua-yi-shu"), "Sitemap must include the Chinese Mei Hua page");
  for (const path of HEXAGRAM_PATHS) assert(sitemap.includes(`https://www.quickiching.com${path}`), `Sitemap missing ${path}`);
  assert(sitemap.includes("https://www.quickiching.com/zh/hexagrams"), "Sitemap must include the Chinese Hexagram hub");
  for (const path of CHINESE_HEXAGRAM_PATHS) assert(sitemap.includes(`https://www.quickiching.com${path}`), `Sitemap missing ${path}`);
  for (const forbidden of ["/history", "/readings/", "/api/", "/trigrams/", "/en/"]) assert(!sitemap.includes(forbidden), `Sitemap contains forbidden path ${forbidden}`);

  const hubResponse = await page.goto(`${BASE}/hexagrams`, { waitUntil: "networkidle0", timeout: 30_000 });
  assert.equal(hubResponse?.status(), 200, "Hexagram hub must be reachable");
  const hub = await page.evaluate(() => [...document.querySelectorAll('a[href^="/hexagrams/"]')].map((node) => new URL(node.getAttribute("href") ?? "", location.href).pathname).filter((path) => path !== "/hexagrams"));
  assert.equal(new Set(hub).size, 64, `Hub must link exactly 64 entity pages, received ${new Set(hub).size}`);
  for (const path of ["/hexagrams/1-the-creative", "/hexagrams/2-the-receptive", "/hexagrams/24-return", "/hexagrams/64-before-completion", "/zh/hexagrams/1-the-creative", "/zh/hexagrams/64-before-completion"]) {
    const response = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0", timeout: 30_000 });
    assert.equal(response?.status(), 200, `${path} must be reachable`);
    const snapshot = await page.evaluate(() => ({
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? "",
      lineAnchors: Array.from({ length: 6 }, (_, index) => document.querySelector(`#line-${index + 1}`) !== null),
      classicalSourceUrls: [...document.querySelectorAll('a[href]')]
        .map((node) => node.getAttribute("href") ?? "")
        .filter((href) => href.includes("zh.wikisource.org")),
      classicalSourceText: [...document.querySelectorAll('article[data-hexagram-detail] [data-seo-exclude]')]
        .map((node) => node.textContent ?? "")
        .join(" "),
      text: document.body?.innerText ?? "",
    }));
    assert(snapshot.canonical.endsWith(path), `${path}: canonical is not self-referencing`);
    assert(snapshot.lineAnchors.every(Boolean), `${path}: six line anchors are incomplete`);
    assert(snapshot.classicalSourceUrls.length >= 7, `${path}: fixed classical source links are incomplete`);
    if (path.startsWith("/zh/")) {
      assert(snapshot.text.includes("卦辞") && snapshot.text.includes("大象"), `${path}: Chinese classical text is missing`);
    } else {
      const sourceText = snapshot.classicalSourceText.toLocaleLowerCase();
      assert(sourceText.includes("classical source record") && sourceText.includes("fixed records for the six lines"), `${path}: English classical source explanation is missing`);
      assert(!/\p{Script=Han}/u.test(snapshot.classicalSourceText), `${path}: Chinese classical text leaked into the English source region`);
    }
  }

  const historyHtml = await (await fetch(`${BASE}/history/`)).text();
  assert(/name="robots"[^>]*content="[^"]*noindex[^"]*follow/i.test(historyHtml) || /content="[^"]*noindex[^"]*follow[^\"]*"[^>]*name="robots"/i.test(historyHtml), "History must be noindex, follow");
  const retiredGet = await fetch(`${BASE}/api/personalized-interpretation`);
  assert.equal(retiredGet.status, 404, "Retired free personalized endpoint must be closed");
  const retiredPost = await fetch(`${BASE}/api/personalized-interpretation`, { method: "POST" });
  assert.equal(retiredPost.status, 404, "Retired free personalized endpoint must not accept POST");
  const otherApi = await fetch(`${BASE}/api/not-a-route`);
  assert.equal(otherApi.status, 404, "Unlisted API routes must remain closed");
  log("140-URL sitemap, English/Chinese hubs, entity metadata/anchors, History noindex, and API closure PASS");
}

async function verifyQuestionReading(page) {
  const question = "What deserves my attention in this transition?";
  await resetThreeCoin(page);
  await page.goto(`${BASE}/methods/three-coin`, { waitUntil: "networkidle0", timeout: 30_000 });
  await page.waitForSelector("textarea[data-private-question]");
  await page.type("textarea[data-private-question]", question);
  await clickText(page, "Continue with question");
  const castButtonSelector = 'button[aria-label^="Toss three coins"]';
  for (let line = 1; line <= 6; line += 1) {
    await page.waitForSelector(castButtonSelector, { timeout: 15_000 });
    await page.click(castButtonSelector);
    if (line === 6) {
      await page.waitForFunction(
        () => location.pathname === "/readings/three-coin/result" || Boolean(document.body?.innerText?.includes("6 / 6 lines")),
        { timeout: 15_000 }
      );
    } else {
      await waitForText(page, `${line} / 6 lines`);
    }
  }
  await page.waitForFunction(() => location.pathname === "/readings/three-coin/result", { timeout: 15_000 });
  await waitForText(page, "Your Three-Coin Reading");
  await waitForText(page, question);
  await assertQuestionPrivacy(page, question);
  const questionState = await page.evaluate(() => ({
    displayedQuestion: document.querySelector("[data-core-question-at-cast]")?.textContent?.trim() ?? "",
    session: JSON.parse(sessionStorage.getItem("quickiching:public-v1:three-coin") || "null"),
  }));
  assert.equal(questionState.displayedQuestion, question, "The unified result must restore the question frozen before the first line");
  assert.equal(questionState.session.coreQuestionAtCast, question, "The frozen question must be stored with this cast");
  assert.equal(questionState.session.coreQuestionFrozenAtCast, true, "The session must record the question freeze");
  await waitForText(page, "What does this reading mean for your specific situation?");
  await clickText(page, "Save reading");
  await waitForText(page, "Saved in this browser");
  const savedLocalReading = await page.evaluate(() => {
    const records = JSON.parse(localStorage.getItem("quickiching:public-history:v1") || "[]");
    return Array.isArray(records) ? records[0] ?? null : null;
  });
  assert.equal(savedLocalReading?.question, question, "Explicit History save must preserve the question with the cast");
  assert.equal(savedLocalReading?.method, "three-coin", "History save must retain the casting method");
  assert.equal(savedLocalReading?.lineValuesBottomUp?.length, 6, "History save must retain the exact six cast lines");
  const freeEndpointCalls = await page.evaluate(() => performance.getEntriesByType("resource").filter((entry) => entry.name.includes("personalized-interpretation") || entry.name.includes("/api/readings/")).length);
  assert.equal(freeEndpointCalls, 0, "The free cast must not call an AI or paid generation endpoint");
  assert.equal(await page.$("[data-interpret-question]"), null, "The retired free personalized CTA must not render");
  await page.reload({ waitUntil: "networkidle0" });
  await waitForText(page, "Your Three-Coin Reading");
  await assertQuestionPrivacy(page, question);
  await waitForText(page, "What does this reading mean for your specific situation?");
  await waitForText(page, "Sign in to continue");
  const paidEndpointCalls = await page.evaluate(() => performance.getEntriesByType("resource").filter((entry) => entry.name.includes("/api/readings/")).length);
  assert.equal(paidEndpointCalls, 0, "An anonymous visit must not start paid generation");
  assert(await page.$("[data-deep-reading-entry]"), "Deep Reading entry must appear alongside the complete free cast interpretation");
  assert(await page.$("#general-cast-interpretation"), "Complete free cast interpretation must remain available on the Deep Reading page");
  log("Question-before-cast, immutable first-line binding, refresh recovery, free endpoint closure, and sign-in gated Deep Reading PASS");
}

async function verifyQuestionSkipFreeOnly(page) {
  await resetThreeCoin(page);
  await page.goto(`${BASE}/methods/three-coin`, { waitUntil: "networkidle0", timeout: 30_000 });
  await clickText(page, "Skip — free reading only");
  await waitForText(page, "This cast will remain free-only");
  assert.equal(await page.$('input[data-private-question]'), null, "Skipping must not leave a question field that suggests later binding");
  await clickText(page, "Start over with a question");
  await page.waitForSelector("textarea[data-private-question]");
  await clickText(page, "Skip — free reading only");

  const castButtonSelector = 'button[aria-label^="Toss three coins"]';
  await page.waitForSelector(castButtonSelector, { timeout: 15_000 });
  await page.click(castButtonSelector);
  await waitForText(page, "A question was not set before the first line was cast");
  await waitForText(page, "1 / 6 lines");
  assert.equal(await page.$('input[data-private-question]'), null, "A skipped question cannot be added after the first line is cast");
  assert.equal(await page.$("button[data-question-restart]"), null, "A frozen free-only cast must not offer late question restart");

  for (let line = 2; line <= 6; line += 1) {
    await page.waitForFunction((selector) => {
      const button = document.querySelector(selector);
      return button instanceof HTMLButtonElement && !button.disabled;
    }, { timeout: 15_000 }, castButtonSelector);
    await page.click(castButtonSelector);
    if (line < 6) await waitForText(page, `${line} / 6 lines`);
  }
  await page.waitForFunction(() => location.pathname === "/readings/three-coin/result", { timeout: 15_000 });
  await waitForText(page, "This cast was not bound to a clear question before the first line was cast");
  assert(await page.$("[data-primary-card]"), "A questionless cast must still provide its complete free interpretation");
  assert.equal(await page.$("[data-context-enrichment-form]"), null, "A questionless cast must not open Deep Reading context input");
  const paidCalls = await page.evaluate(() => performance.getEntriesByType("resource").filter((entry) => entry.name.includes("/api/readings/")).length);
  assert.equal(paidCalls, 0, "A questionless free cast must not start paid generation");
  log("Optional question skip, free-only cast, first-line freeze, and no late Deep Reading question PASS");
}

async function verifyChineseQuestionAndDeepEntry(page) {
  const question = "面对职业选择，我现在最需要看清什么？";
  await seedThreeCoin(page, question);
  await page.goto(`${BASE}/zh/methods/three-coin`, { waitUntil: "networkidle0", timeout: 30_000 });
  await page.waitForFunction(() => location.pathname === "/zh/readings/three-coin/result", { timeout: 15_000 });
  await waitForText(page, "本次三枚铜钱起卦结果");
  await assertQuestionPrivacy(page, question);
  assert.equal(await page.$eval("[data-core-question-at-cast]", (node) => node.textContent?.trim()), question, "Chinese unified result must restore the frozen question");
  assert.equal(await page.$("[data-interpret-question]"), null, "Retired free personalized CTA must not render in Chinese");
  await assertNoOverflow(page, "Chinese Three-Coin result 390px");

  await waitForText(page, "这次卦象对你的具体处境意味着什么？");
  await waitForText(page, "登录并继续");
  const placement = await page.evaluate(() => {
    const result = document.querySelector("[data-public-reading-result]");
    const overview = result?.querySelector("[data-primary-overview]");
    const entry = result?.querySelector("[data-deep-reading-entry]");
    const freeInterpretation = result?.querySelector("#general-cast-interpretation");
    const login = [...(entry?.querySelectorAll("a") ?? [])].find((node) => node.textContent?.includes("登录并继续"));
    const detailsButton = [...(entry?.querySelectorAll("button") ?? [])].find((node) => node.textContent?.includes("补充选项、限制与顾虑"));
    return {
      overviewBeforeEntry: Boolean(overview && entry && (overview.compareDocumentPosition(entry) & Node.DOCUMENT_POSITION_FOLLOWING)),
      entryBeforeFreeInterpretation: Boolean(entry && freeInterpretation && (entry.compareDocumentPosition(freeInterpretation) & Node.DOCUMENT_POSITION_FOLLOWING)),
      entryTop: entry ? Math.round(entry.getBoundingClientRect().top + window.scrollY) : null,
      loginTop: login ? Math.round(login.getBoundingClientRect().top + window.scrollY) : null,
      loginLabel: login?.textContent?.trim() ?? "",
      hasSituationForm: entry?.querySelector("[data-context-enrichment-form]") !== null,
      optionalDetailsButton: detailsButton instanceof HTMLButtonElement,
      optionalFieldsHidden: entry?.querySelector('textarea[placeholder*="每行"]') === null,
    };
  });
  assert(placement.overviewBeforeEntry, "The cast summary must appear before the Deep Reading entry");
  assert(placement.entryBeforeFreeInterpretation, "Deep Reading must appear before the long free interpretation");
  assert(placement.hasSituationForm, "An eligible anonymous cast must allow the user to enter situation context");
  assert(placement.optionalDetailsButton && placement.optionalFieldsHidden, "Additional context fields must start collapsed");
  assert(placement.loginLabel.includes("$2.99"), "Anonymous Deep Reading CTA must show its current price");
  assert(await page.$("#general-cast-interpretation"), "Chinese complete free cast interpretation must remain available");

  const viewport = page.viewport();
  assert(viewport, "Browser gate must have an explicit mobile viewport");
  assert(placement.loginTop - placement.entryTop < viewport.height * 2, "Mobile Deep Reading CTA must not be pushed more than two screens down the entry card");
  await page.setViewport({ width: 1440, height: 1000 });
  await page.waitForFunction(() => window.innerWidth === 1440);
  const desktopPlacement = await page.$eval("[data-deep-reading-entry]", (entry) => {
    const login = [...entry.querySelectorAll("a")].find((node) => node.textContent?.includes("登录并继续"));
    return {
      entryTop: Math.round(entry.getBoundingClientRect().top + window.scrollY),
      loginTop: login ? Math.round(login.getBoundingClientRect().top + window.scrollY) : null,
    };
  });
  assert(desktopPlacement.loginTop !== null && desktopPlacement.loginTop - desktopPlacement.entryTop < 1000, "Desktop Deep Reading CTA must remain close to the cast summary");
  await page.setViewport(viewport);
  await assertNoOverflow(page, "Chinese Three-Coin result 390px");
  await page.type("#deep-context-situation", "Should I buy bitcoin with all my savings this week?");
  await page.waitForSelector('[data-deep-reading-blocked="risk"]');
  assert.equal(await page.$('[data-deep-reading-entry] a[href*="signin"]'), null, "Risky context must not send an anonymous user toward a paid request");
  assert(await page.$("#general-cast-interpretation"), "Risk blocking must preserve the complete free interpretation");
  await page.click("#deep-context-situation", { clickCount: 3 });
  await page.keyboard.press("Backspace");
  await page.type("#deep-context-situation", "I am considering a new role and want to understand what responsibilities to clarify.");
  await page.waitForSelector('[data-deep-reading-blocked="risk"]', { hidden: true });
  assert(await page.$('[data-deep-reading-entry] a[href*="signin"]'), "Correcting optional context must restore the eligible CTA without changing the core question");
  assert.equal(await page.$eval("[data-core-question-at-cast]", (node) => node.textContent?.trim()), question);
  const apiCalls = await page.evaluate(() => performance.getEntriesByType("resource").filter((entry) => entry.name.includes("/api/readings/")).length);
  assert.equal(apiCalls, 0, "Anonymous Chinese visit must not start paid generation");
  log("Chinese question binding, mobile layout, localized Deep Reading entry, and anonymous generation boundary PASS");
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
  await clickText(page, "Skip — free reading only");
  await page.waitForSelector("select:not(#manual-primary-hexagram)", { timeout: 15_000 });
}

async function verifyManualAndMovement(page) {
  await startManual(page);
  await buildManual(page, [7, 8, 7, 8, 7, 8]);
  assert.equal(await page.$$eval("[data-relating-card]", (nodes) => nodes.length), 0, "No-moving reading must not render a fabricated relating hexagram");
  assert.equal(await page.$$eval("[data-no-relating-card]", (nodes) => nodes.length), 1, "No-moving reading must explain that there is no relating hexagram");
  await waitForText(page, "No changing lines");
  await waitForText(page, "No line changed, so this reading remains centered on the primary hexagram.");
  const noChangeText = await page.$eval("[data-public-reading-result]", (node) => node.textContent ?? "");
  assert(!/Changing line\(s\):\s*None/.test(noChangeText), "No-moving reading must not display a bare None");
  await newManual(page);
  await buildManual(page, [6, 7, 8, 7, 8, 7]);
  assert.equal(await page.$$eval("[data-relating-card]", (nodes) => nodes.length), 1, "Single-moving reading must render one relating card");
  await newManual(page);
  await buildManual(page, [6, 9, 8, 7, 8, 7]);
  await waitForText(page, "Changing line(s): 1, 2");
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
  await seedThreeCoinSession(page, "partial-reading-before", "2026-08-19T10:00:00.000Z", FIXTURE_STEPS.slice(0, 1), question);
  await page.goto(`${BASE}/methods/three-coin`, { waitUntil: "networkidle0", timeout: 30_000 });
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
  await seedThreeCoin(page, "Same facts · first question");
  await page.goto(`${BASE}/methods/three-coin`, { waitUntil: "networkidle0", timeout: 30_000 });
  await page.waitForFunction(() => location.pathname === "/readings/three-coin/result", { timeout: 15_000 });
  await waitForText(page, "Your Three-Coin Reading");
  await clickText(page, "Save reading");
  await waitForText(page, "Saved in this browser");

  await seedThreeCoinSession(page, "history-three-coin-second", "2026-08-19T12:00:00.000Z", FIXTURE_STEPS, "Same facts · second question");
  await page.goto(`${BASE}/methods/three-coin`, { waitUntil: "networkidle0", timeout: 30_000 });
  await page.waitForFunction(() => location.pathname === "/readings/three-coin/result", { timeout: 15_000 });
  await waitForText(page, "Your Three-Coin Reading");
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
  await verifyQuestionSkipFreeOnly(page);
  await page.setViewport({ width: 390, height: 844 });
  await verifyChineseNoChangingLines(page);
  await verifyChineseQuestionAndDeepEntry(page);
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
