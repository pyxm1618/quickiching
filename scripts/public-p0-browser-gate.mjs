import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { CLASSICAL_HEXAGRAMS } from "../src/domain/public-reading/classical.ts";

const BASE = process.env.PUBLIC_V1_TEST_BASE_URL || "http://127.0.0.1:3000";
const THREE_COIN_STORAGE_KEY = "quickiching:public-v1:three-coin";
const PENDING_READING_KEY_PREFIX = "quickiching:public-v1:pending-completed-reading:";
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
  if (["Cast the Coins", "Record This Cast", "开始掷币", "记录这一爻"].includes(text)) {
    await page.waitForFunction(wanted => [...document.querySelectorAll("button")].some(node => node.textContent?.trim() === wanted && !node.disabled), {timeout:15000}, text);
  }
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
  // Manual Cast renders its own question block instead of the shared active-question card.
  await page.waitForSelector("[data-manual-question]", { timeout: 15_000 });
  await waitForText(page, "Free cast without a bound question");
}

async function assertNoOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  assert(dimensions.scrollWidth <= dimensions.clientWidth + 1, `${label}: horizontal overflow ${dimensions.scrollWidth} > ${dimensions.clientWidth}`);
}

async function resetThreeCoin(page) {
  await page.goto(`${BASE}/robots.txt`, { waitUntil: "networkidle0", timeout: 30_000 });
  await page.evaluate((key) => {
    sessionStorage.removeItem(key);
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const pendingKey = localStorage.key(index);
      if (pendingKey?.startsWith("quickiching:public-v1:pending-completed-reading:")) localStorage.removeItem(pendingKey);
    }
  }, THREE_COIN_STORAGE_KEY);
}

async function seedThreeCoin(page, question) {
  await seedThreeCoinSession(page, randomUUID(), new Date().toISOString(), FIXTURE_STEPS, question);
}


async function verifyChineseNoChangingLines(page) {
  await seedThreeCoinSession(page, randomUUID(), new Date().toISOString(), NO_CHANGE_STEPS, "这次起卦没有动爻吗？");
  await openSeededThreeCoinResult(page, "zh-Hans");
  await page.waitForSelector("[data-result-choice]", { timeout: 15_000 });
  const choice = await page.evaluate(() => ({
    authGate: document.querySelector("[data-completed-cast-gate]") !== null,
    primaryChoice: document.querySelector("[data-result-choice-primary]") !== null,
    relatingChoice: document.querySelector("[data-result-choice-relating]") !== null,
    freeChoice: document.querySelector("[data-result-choice-free]") !== null,
    deepChoice: document.querySelector("[data-result-choice-deep]") !== null,
    text: document.body?.innerText ?? "",
  }));
  assert.equal(choice.authGate, false, "Chinese Result Choice must not require sign-in");
  assert(choice.primaryChoice, "Chinese Result Choice must show the primary hexagram");
  assert(choice.relatingChoice, "Chinese Result Choice must show the changing/relating summary");
  assert(choice.freeChoice && choice.deepChoice, "Chinese Result Choice must offer both reading paths");
  assert(choice.text.includes("卦象不变"), "No-changing cast must explicitly show an unchanged result");
  assert(choice.text.includes("无动爻"), "No-changing cast must explicitly show that there are no moving lines");
  await assertNoOverflow(page, "Chinese no-changing Result Choice 390px");
  log("Chinese no-changing completed cast renders Result Choice before auth PASS");
}

async function seedThreeCoinSession(page, id, createdAt, steps = FIXTURE_STEPS, question = "") {
  await page.goto(`${BASE}/robots.txt`, { waitUntil: "networkidle0", timeout: 30_000 });
  await page.evaluate(({ key, id: readingId, createdAt: readingCreatedAt, steps, question: coreQuestionAtCast }) => {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const pendingKey = localStorage.key(index);
      if (pendingKey?.startsWith("quickiching:public-v1:pending-completed-reading:")) localStorage.removeItem(pendingKey);
    }
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


async function openSeededThreeCoinResult(page, locale = "en") {
  const prefix = locale === "zh-Hans" ? "/zh" : "";
  const entryPath = `${prefix}/`;
  const resultPath = `${prefix}/readings/choice`;
  const seededId = await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) || "null")?.id ?? "", THREE_COIN_STORAGE_KEY);
  assert(seededId, "Seeded Three-Coin session must have a stable id");

  await page.goto(`${BASE}${entryPath}`, { waitUntil: "networkidle0", timeout: 30_000 });
  await page.waitForSelector("[data-reading-sealed-recovery]", { timeout: 30_000 });
  assert.equal(new URL(page.url()).pathname, entryPath, "A restored completed cast must not navigate by itself");
  await page.click("[data-reading-retry-handoff]");
  await page.waitForFunction(
    ({ resultPath, seededId }) => location.pathname === resultPath
      && new URLSearchParams(location.search).get("session") === seededId,
    { timeout: 30_000 },
    { resultPath, seededId },
  );
  await page.waitForSelector("[data-result-choice]", { timeout: 15_000 });
  assert.equal(await page.$("[data-completed-cast-gate]"), null, "Result Choice must appear before any auth/save gate");

  const state = await page.evaluate(({ completedKey, seededId }) => {
    const raw = sessionStorage.getItem(completedKey);
    const completed = raw ? JSON.parse(raw) : null;
    return {
      completed,
      pathname: location.pathname,
      session: new URLSearchParams(location.search).get("session"),
      ritualCompleteViewVisible: document.querySelector('[data-ritual-view="complete"]') !== null,
      seededId,
    };
  }, { completedKey: COMPLETED_READING_STORAGE_KEY, seededId });

  assert.equal(state.pathname, resultPath, "Restored completed cast must recover into the canonical Result Choice route");
  assert.equal(state.session, seededId, "Recovered Result Choice route must preserve the same stable casting id");
  assert.equal(state.completed?.readingId, seededId, "Canonical completed-reading must preserve the same stable casting id");
  assert.equal(state.completed?.method, "three-coin", "Canonical completed-reading must preserve the Three-Coin method");
  assert.equal(state.ritualCompleteViewVisible, false, "Restored six-line cast must not remain on a completed casting screen");
}

async function assertQuestionPrivacy(page, question, { requireVisible = true } = {}) {
  const state = await page.evaluate(() => ({
    url: location.href,
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
    jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].map((node) => node.textContent ?? "").join("\n"),
    resourceUrls: performance.getEntriesByType("resource").map((entry) => entry.name),
    activeQuestion: (document.querySelector('input[data-private-question]') instanceof HTMLInputElement)
      ? document.querySelector('input[data-private-question]').value
      : document.querySelector('[data-core-question-at-cast]')?.textContent?.trim() ?? "",
  }));
  if (requireVisible) assert(state.activeQuestion === question, "Question was not preserved in the editable reading flow");
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
  for (const forbidden of ["/my-readings", "/readings/", "/api/", "/trigrams/", "/en/"]) assert(!sitemap.includes(forbidden), `Sitemap contains forbidden path ${forbidden}`);

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
      classicalSourceUrls: [...document.querySelectorAll('article[data-hexagram-detail] a[href]')]
        .map((node) => node.getAttribute("href") ?? "")
        .filter((href) => href.includes("zh.wikisource.org")),
      classicalHeading: document.querySelector("#hexagram-classical-title")?.textContent ?? "",
      classicalSubheadings: [...(document.querySelector("#hexagram-classical-title")?.closest("section")?.querySelectorAll("h3") ?? [])].map((node) => node.textContent?.trim()),
      classicalSectionSourceUrls: [...(document.querySelector("#hexagram-classical-title")?.closest("section")?.querySelectorAll('a[href]') ?? [])]
        .map((node) => node.getAttribute("href") ?? "").filter((href) => href.includes("zh.wikisource.org")),
      lineSourceUrls: Array.from({ length: 6 }, (_, index) => {
        const label = document.documentElement.lang === "zh-Hans" ? `第${index + 1}爻经典原文来源` : `Source for classical line ${index + 1}`;
        return document.querySelector(`article[data-hexagram-detail] a[aria-label="${label}"]`)?.getAttribute("href") ?? "";
      }),
      text: document.body?.innerText ?? "",
    }));
    assert(snapshot.canonical.endsWith(path), `${path}: canonical is not self-referencing`);
    assert(snapshot.lineAnchors.every(Boolean), `${path}: six line anchors are incomplete`);
    assert(snapshot.classicalSourceUrls.length >= 7, `${path}: fixed classical source links are incomplete`);
    const classical = CLASSICAL_HEXAGRAMS.find((entry) => path.endsWith("/" + entry.slug));
    assert(classical, `${path}: classical record is missing`);
    assert(snapshot.classicalSourceUrls.every((href) => href === classical.source.textSourceUrl), `${path}: classical source must match this hexagram's fixed source URL and revision`);
    assert.deepEqual(snapshot.lineSourceUrls, classical.lines.map((line) => line.source.textSourceUrl), `${path}: six individually labelled classical line sources are incomplete or incorrect`);
    if (path.startsWith("/zh/")) {
      assert(snapshot.text.includes("卦辞") && snapshot.text.includes("大象"), `${path}: Chinese classical text is missing`);
    } else {
      // The approved English knowledge layout replaces the old source-explainer copy.
      // Assert its semantic sections while keeping the real fixed-source checks above.
      assert(snapshot.classicalHeading.includes("Classical Text & Modern Interpretation"), `${path}: English classical section heading is missing`);
      assert.deepEqual(snapshot.classicalSubheadings, ["Judgment", "Image"], `${path}: Judgment/Image source sections are missing`);
      assert.deepEqual(snapshot.classicalSectionSourceUrls, [classical.source.textSourceUrl, classical.source.textSourceUrl], `${path}: Judgment/Image fixed classical source links are incomplete or incorrect`);
      assert(!snapshot.text.includes("Classical Line Text"), `${path}: English rendering must not be labelled as classical original text`);
    }
  }

  const retiredGet = await fetch(`${BASE}/api/personalized-interpretation`);
  assert.equal(retiredGet.status, 404, "Retired free personalized endpoint must be closed");
  const retiredPost = await fetch(`${BASE}/api/personalized-interpretation`, { method: "POST" });
  assert.equal(retiredPost.status, 404, "Retired free personalized endpoint must not accept POST");
  const otherApi = await fetch(`${BASE}/api/not-a-route`);
  assert.equal(otherApi.status, 404, "Unlisted API routes must remain closed");
  log("140-URL sitemap, English/Chinese hubs, entity metadata/anchors, private-route exclusion, and API closure PASS");
}


async function recordFormalLine(page, count, locale = "en") {
  await page.waitForSelector('.hold-button:not(:disabled)', { timeout: 15_000 });
  await clickText(page, locale === "zh-Hans" ? "掷三枚铜钱" : "Toss three coins");
  await clickText(page, locale === "zh-Hans" ? "记录这一爻" : "Record This Cast");
  if (count < 6) await page.waitForFunction(expected => document.querySelectorAll('.ritual-six-lines li[data-state="done"]').length === expected, { timeout: 15_000 }, count);
}

async function verifyQuestionReading(page, locale = "en") {
  const zh = locale === "zh-Hans";
  const prefix = zh ? "/zh" : "";
  const question = zh ? "这次变化中，我应该先守住什么？" : "What deserves my attention in this transition?";
  await resetThreeCoin(page);
  await page.evaluate(() => {
    const staleNow = Date.now();
    localStorage.setItem("quickiching:public-v1:pending-completed-reading:00000000-0000-4000-8000-000000000099", JSON.stringify({
      schemaVersion: 1,
      readingId: "00000000-0000-4000-8000-000000000099",
      createdAt: "2026-08-19T00:00:00.000Z",
      method: "three-coin", methodVersion: "three-coin-v1",
      question: "Earlier completed reading must not replace the new cast",
      lineValuesBottomUp: [7, 7, 7, 7, 7, 7],
      evidence: { kind: "three-coin", steps: [] },
      pendingCreatedAt: new Date(staleNow).toISOString(),
      expiresAt: new Date(staleNow + 60 * 60 * 1000).toISOString(),
    }));
  });
  await page.goto(`${BASE}${prefix}/`, { waitUntil: "networkidle0", timeout: 30_000 });
  await page.waitForSelector("textarea[data-private-question]");
  await page.type("textarea[data-private-question]", question);
  await clickText(page, zh ? "开始起卦" : "Start Divination");
  await clickText(page, zh ? "开始掷币" : "Cast the Coins");
  for (let line = 1; line <= 6; line += 1) await recordFormalLine(page, line, locale);

  await page.waitForFunction(prefix => location.pathname === `${prefix}/readings/choice`, { timeout: 15_000 }, prefix);
  await page.waitForSelector("[data-result-choice]", { timeout: 15_000 });
  await assertQuestionPrivacy(page, question, { requireVisible: false });

  const choiceState = await page.evaluate(() => ({
    session: JSON.parse(sessionStorage.getItem("quickiching:public-v1:three-coin") || "null"),
    completed: JSON.parse(localStorage.getItem("quickiching:public-v1:pending-completed-reading:" + (new URLSearchParams(location.search).get("session") || "")) || "null"),
    authGate: document.querySelector("[data-auth-required-before-reveal]") !== null,
    primaryCard: document.querySelector("[data-primary-card]") !== null,
    deepEntry: document.querySelector("[data-deep-reading-entry]") !== null,
    freeHref: document.querySelector("[data-result-choice-free]")?.getAttribute("href") ?? "",
    deepHref: document.querySelector("[data-result-choice-deep]")?.getAttribute("href") ?? "",
  }));
  assert.equal(new URL(page.url()).searchParams.get("session"), choiceState.session.id, "Result Choice URL must select this exact formal Three-Coin cast, even when another completed reading exists");
  assert.equal(choiceState.completed?.readingId, choiceState.session.id, "Result Choice must use the new completed cast, not a stale completed reading");
  assert.deepEqual(choiceState.completed?.lineValuesBottomUp, choiceState.session.data.steps.map(step => step.lineValue), "Result Choice handoff must preserve all six authoritative line values");
  assert.equal(choiceState.authGate, false, "Result Choice must be visible before authentication");
  assert.equal(choiceState.primaryCard, false, "Result Choice must not render Free Reading content");
  assert.equal(choiceState.deepEntry, false, "Result Choice must not render Deep Reading content");

  const freeUrl = new URL(choiceState.freeHref, BASE);
  const deepUrl = new URL(choiceState.deepHref, BASE);
  assert.equal(freeUrl.pathname, `${prefix}/readings/result`);
  assert.equal(deepUrl.pathname, `${prefix}/readings/deep`);
  assert.equal(freeUrl.searchParams.get("session"), choiceState.session.id);
  assert.equal(deepUrl.searchParams.get("session"), choiceState.session.id);

  await Promise.all([
    page.waitForFunction(prefix => location.pathname === `${prefix}/readings/result`, { timeout: 15_000 }, prefix),
    page.click("[data-result-choice-free]"),
  ]);
  await page.waitForSelector("[data-completed-cast-gate='auth-required']", { timeout: 15_000 });
  const signinHref = await page.$eval('[data-auth-reading-intent="free"]', node => node.getAttribute("href"));
  const callback = new URL(signinHref, BASE).searchParams.get("callbackURL");
  assert.equal(new URL(callback, BASE).searchParams.get("session"), choiceState.session.id, "Free Reading sign-in callback must preserve this exact cast identity");

  const lineDescriptions = zh ? { 6: "阴爻，动爻", 7: "阳爻", 8: "阴爻", 9: "阳爻，动爻" } : { 6: "yin, moving", 7: "yang", 8: "yin", 9: "yang, moving" };
  const expectedLabels = choiceState.session.data.steps.map((step, index) => zh ? `第 ${index + 1} 爻：${lineDescriptions[step.lineValue]}` : `Line ${index + 1}: ${lineDescriptions[step.lineValue]}`).reverse();
  assert.deepEqual(await page.$$eval('[data-completed-six-lines] [role="img"]', nodes => nodes.map(node => node.getAttribute("aria-label"))), expectedLabels, "Free Reading auth gate must preserve this cast's six lines");
  assert.equal(choiceState.session.coreQuestionAtCast, question, "The frozen question must be stored with this cast");
  assert.equal(choiceState.session.coreQuestionFrozenAtCast, true, "The session must record the first-real-cast question freeze");
  assert.equal(choiceState.session.data?.steps?.length, 6, "The completed browser session must preserve all six authoritative steps");

  const sessionBeforeRefresh = JSON.stringify(choiceState.session);
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector("[data-completed-cast-gate='auth-required']", { timeout: 15_000 });
  await assertQuestionPrivacy(page, question, { requireVisible: false });
  const sessionAfterRefresh = await page.evaluate(() => sessionStorage.getItem("quickiching:public-v1:three-coin"));
  assert.equal(sessionAfterRefresh, sessionBeforeRefresh, "Free Reading auth-gate refresh must restore the exact same completed cast and question");
  log(`${locale}: Result Choice first, same-session Free handoff, auth callback, six-line facts, privacy and restore PASS`);
}


async function verifyQuestionSkipFreeOnly(page) {
  await resetThreeCoin(page);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0", timeout: 30_000 });
  await clickText(page, "Skip — free reading only");
  await page.waitForSelector('[data-experience-stage="question-confirm"]');
  await page.click('.ritual-back');
  await page.waitForSelector('[data-experience-stage="landing"] textarea[data-private-question]');
  await clickText(page, "Skip — free reading only");
  await clickText(page, "Cast the Coins");
  await recordFormalLine(page, 1);
  assert.equal(await page.$('input[data-private-question]'), null, "A skipped question cannot be added after the first line is cast");
  assert.equal(await page.$("button[data-question-restart]"), null, "A frozen free-only cast must not offer late question restart");
  for (let line = 2; line <= 6; line += 1) await recordFormalLine(page, line);

  await page.waitForFunction(() => location.pathname === "/readings/choice", { timeout: 15_000 });
  await page.waitForSelector("[data-result-choice]", { timeout: 15_000 });
  const state = await page.evaluate(() => ({
    session: JSON.parse(sessionStorage.getItem("quickiching:public-v1:three-coin") || "null"),
    completed: JSON.parse(localStorage.getItem("quickiching:public-v1:pending-completed-reading:" + (new URLSearchParams(location.search).get("session") || "")) || "null"),
    authGate: document.querySelector("[data-auth-required-before-reveal]") !== null,
    primaryCard: document.querySelector("[data-primary-card]") !== null,
    deepEntry: document.querySelector("[data-deep-reading-entry]") !== null,
    freeChoice: document.querySelector("[data-result-choice-free]") !== null,
    deepChoice: document.querySelector("[data-result-choice-deep]") !== null,
  }));
  assert.equal(state.session.coreQuestionFrozenAtCast, true, "Questionless cast must still freeze the no-question decision at first cast");
  assert.equal(state.session.coreQuestionAtCast ?? "", "", "Questionless cast must not manufacture a question");
  assert.equal(state.session.data?.steps?.length, 6, "Questionless completed cast must preserve six lines");
  assert.deepEqual(state.completed?.lineValuesBottomUp, state.session.data.steps.map(step => step.lineValue));
  assert.equal(state.authGate, false, "Questionless completed cast must still see Result Choice before authentication");
  assert.equal(state.primaryCard, false, "Result Choice must not reveal Free Reading content");
  assert.equal(state.deepEntry, false, "Result Choice must not reveal Deep Reading content");
  assert(state.freeChoice && state.deepChoice, "Result Choice must offer both Free Reading and Deep Reading");
  log("Optional question skip, first-line freeze, six-line completion, and Result Choice-before-auth PASS");
}


async function verifyChineseQuestionAndDeepEntry(page) {
  const question = "面对职业选择，我现在最需要看清什么？";
  await seedThreeCoin(page, question);
  await openSeededThreeCoinResult(page, "zh-Hans");
  await page.waitForSelector("[data-result-choice]", { timeout: 15_000 });
  await waitForText(page, question);
  await assertQuestionPrivacy(page, question, { requireVisible: false });

  const state = await page.evaluate(() => ({
    authGate: document.querySelector("[data-auth-required-before-reveal]") !== null,
    primaryCard: document.querySelector("[data-primary-card]") !== null,
    deepEntry: document.querySelector("[data-deep-reading-entry]") !== null,
    deepHref: document.querySelector("[data-result-choice-deep]")?.getAttribute("href") ?? "",
    freeHref: document.querySelector("[data-result-choice-free]")?.getAttribute("href") ?? "",
    session: JSON.parse(sessionStorage.getItem("quickiching:public-v1:three-coin") || "null"),
  }));
  assert.equal(state.authGate, false, "Chinese Result Choice must be visible before authentication");
  assert.equal(state.primaryCard, false, "Chinese Result Choice must not render Free Reading content");
  assert.equal(state.deepEntry, false, "Chinese Result Choice must not render Deep Reading content");
  assert.equal(state.session.question, question, "Chinese choice source session must preserve the same question");
  assert.equal(state.session.coreQuestionAtCast, question, "Chinese choice source session must preserve the frozen core question");
  assert.equal(state.session.data?.steps?.length, 6, "Chinese choice source session must preserve the same six lines");
  const deepUrl = new URL(state.deepHref, BASE);
  const freeUrl = new URL(state.freeHref, BASE);
  assert.equal(deepUrl.pathname, "/zh/readings/deep");
  assert.equal(freeUrl.pathname, "/zh/readings/result");
  assert.equal(deepUrl.searchParams.get("session"), state.session.id);
  assert.equal(freeUrl.searchParams.get("session"), state.session.id);

  await Promise.all([
    page.waitForFunction(() => location.pathname === "/zh/readings/deep", { timeout: 15_000 }),
    page.click("[data-result-choice-deep]"),
  ]);
  await page.waitForSelector('[data-completed-cast-gate="auth-required"]', { timeout: 15_000 });
  const deepSigninHref = await page.$eval('[data-auth-reading-intent="deep"]', node => node.getAttribute("href"));
  const callback = new URL(new URL(deepSigninHref, BASE).searchParams.get("callbackURL"), BASE);
  assert.equal(callback.pathname, "/zh/readings/deep");
  assert.equal(callback.searchParams.get("session"), state.session.id);
  await assertNoOverflow(page, "Chinese Deep Reading auth gate 390px");
  log("Chinese Result Choice, same-cast Deep handoff, privacy, and auth-after-choice PASS");
}


async function setManualValues(page, values) {
  for (let index = 0; index < values.length; index += 1) {
    const position = index + 1;
    const value = values[index];
    const selector = `[data-line-position="${position}"][data-line-value="${value}"]`;
    const button = await page.waitForSelector(selector, { timeout: 5000 });
    assert(button, `Manual line ${position} value ${value} button missing`);
    await button.click();
  }
}

async function resetManualSession(page) {
  await page.goto(`${BASE}/robots.txt`, { waitUntil: "networkidle0", timeout: 30_000 });
  await page.evaluate(() => {
    sessionStorage.removeItem("quickiching:public-v1:manual-cast");
    sessionStorage.removeItem("quickiching:public-v1:manual-cast:draft:v1");
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const pendingKey = localStorage.key(index);
      if (pendingKey?.startsWith("quickiching:public-v1:pending-completed-reading:")) localStorage.removeItem(pendingKey);
    }
  });
}

async function startManual(page) {
  await resetManualSession(page);
  await page.goto(`${BASE}/methods/manual-cast`, { waitUntil: "networkidle0", timeout: 30_000 });
  await skipQuestion(page);
}

async function buildManual(page, values) {
  await setManualValues(page, values);
  await page.click("[data-manual-continue]");
  await page.waitForFunction(() => location.pathname === "/readings/choice", { timeout: 15_000 });
  await page.waitForSelector("[data-result-choice]", { timeout: 15_000 });
  const state = await page.evaluate(() => {
    const completedRaw = localStorage.getItem("quickiching:public-v1:pending-completed-reading:" + (new URLSearchParams(location.search).get("session") || ""));
    const manualRaw = sessionStorage.getItem("quickiching:public-v1:manual-cast");
    return {
      completed: completedRaw ? JSON.parse(completedRaw) : null,
      session: new URLSearchParams(location.search).get("session"),
      manual: manualRaw ? JSON.parse(manualRaw) : null,
      revealed: document.querySelector("[data-public-reading-result]") !== null,
      authGate: document.querySelector("[data-completed-cast-gate]") !== null,
    };
  });
  assert(state.completed, "Manual Build Reading must write canonical completed-reading");
  assert(state.manual, "Manual Build Reading must preserve its canonical current session");
  assert.equal(state.completed.method, "manual", "Manual completed-reading must use the canonical manual method");
  assert.equal(state.completed.readingId, state.manual.id, "Manual result handoff must preserve the same casting id");
  assert.deepEqual(state.completed.lineValuesBottomUp, values, "Manual result handoff must preserve all six authoritative values");
  assert.equal(state.revealed, false, "Manual Result Choice must not render Free Reading content");
  assert.equal(state.authGate, false, "Manual Result Choice must appear before authentication");
  return state;
}

async function verifyManualAndMovement(page) {
  await startManual(page);
  const noChange = await buildManual(page, [7, 8, 7, 8, 7, 8]);
  assert.equal(noChange.completed.evidence?.mode, "line-values", "Mode A must preserve line-values evidence");

  await startManual(page);
  const singleChange = await buildManual(page, [6, 7, 8, 7, 8, 7]);
  assert.deepEqual(singleChange.completed.lineValuesBottomUp, [6, 7, 8, 7, 8, 7]);

  await startManual(page);
  const multipleChange = await buildManual(page, [6, 9, 8, 7, 8, 7]);
  assert.deepEqual(multipleChange.completed.lineValuesBottomUp, [6, 9, 8, 7, 8, 7]);

  await startManual(page);
  await page.focus('[data-manual-mode="line-values"]');
  await page.keyboard.press("ArrowRight");
  await page.waitForSelector('#manual-mode-primary-changing-panel[role="tabpanel"]');
  assert.equal(await page.$eval('[data-manual-mode="primary-changing"]', (node) => node.getAttribute("aria-selected")), "true", "ArrowRight must activate Manual mode B");
  await page.click("[data-hexagram-picker-trigger]");
  await page.waitForSelector('[data-hexagram-number="24"]', { timeout: 5000 });
  await page.click('[data-hexagram-number="24"]');
  await page.click('[data-moving-line-position="1"]');
  await page.click("[data-manual-continue]");
  await page.waitForFunction(() => location.pathname === "/readings/choice", { timeout: 15_000 });
  await page.waitForSelector("[data-result-choice]", { timeout: 15_000 });
  const modeB = await page.evaluate(() => {
    const raw = localStorage.getItem("quickiching:public-v1:pending-completed-reading:" + (new URLSearchParams(location.search).get("session") || ""));
    return raw ? JSON.parse(raw) : null;
  });
  assert(modeB, "Manual Mode B must write canonical completed-reading");
  assert.equal(modeB.method, "manual");
  assert.equal(modeB.evidence?.mode, "primary-changing");
  assert.equal(modeB.evidence?.primaryHexagramNumber, 24);
  assert.deepEqual(modeB.evidence?.changingLines, [1]);
  await assertNoOverflow(page, "Manual Result Choice 390px");
  log("Manual A/B, keyboard tabs, exact pending handoff, stable id, and Result Choice PASS");
}

async function verifyPartialRestart(page) {
  const question = "What remains important if I begin again?";
  await seedThreeCoinSession(page, "partial-reading-before", "2026-08-19T10:00:00.000Z", FIXTURE_STEPS.slice(0, 1), question);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0", timeout: 30_000 });
  await page.waitForFunction(() => document.querySelectorAll('.ritual-six-lines li[data-state="done"]').length === 1);
  const before = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key) || "null"), THREE_COIN_STORAGE_KEY);
  await page.click('.ritual-back');
  await page.waitForSelector('[data-experience-stage="landing"] textarea[data-private-question]');
  assert.equal(await page.evaluate(key => sessionStorage.getItem(key), THREE_COIN_STORAGE_KEY), null, "Formal restart must clear the old partial cast");
  await page.type("textarea[data-private-question]", question);
  await clickText(page, "Start Divination");
  await clickText(page, "Cast the Coins");
  await page.waitForSelector('.hold-button:not(:disabled)');
  const after = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key) || "null"), THREE_COIN_STORAGE_KEY);
  assert.notEqual(after.id, before.id, "Restart must create a fresh reading identity");
  assert.notEqual(after.createdAt, before.createdAt, "Restart must create a fresh timestamp");
  assert.equal(after.question, question, "The same question can start a new independent cast");
  assert.equal("data" in after, false, "Restart must discard partial facts");
  log("Formal partial restart clears old facts and permits a fresh same-question cast PASS");
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


async function verifyAccountPersistenceBoundary(page) {
  await seedThreeCoin(page, "Same completed cast must wait for account persistence");
  await openSeededThreeCoinResult(page);

  const choiceState = await page.evaluate(() => ({
    authGate: document.querySelector("[data-auth-required-before-reveal]") !== null,
    primaryCard: document.querySelector("[data-primary-card]") !== null,
    freeChoice: document.querySelector("[data-result-choice-free]") !== null,
  }));
  assert.equal(choiceState.authGate, false, "Result Choice must appear before account persistence");
  assert.equal(choiceState.primaryCard, false, "Result Choice must not render Free Reading content");
  assert(choiceState.freeChoice, "Result Choice must offer Free Reading");

  await Promise.all([
    page.waitForFunction(() => location.pathname === "/readings/result", { timeout: 15_000 }),
    page.click("[data-result-choice-free]"),
  ]);
  await page.waitForSelector("[data-completed-cast-gate='auth-required']", { timeout: 15_000 });

  const freeState = await page.evaluate(() => ({
    authGate: document.querySelector("[data-completed-cast-gate='auth-required']") !== null,
    primaryCard: document.querySelector("[data-primary-card]") !== null,
  }));
  assert(freeState.authGate, "Anonymous Free Reading must wait for account persistence after the user chooses Free Reading");
  assert.equal(freeState.primaryCard, false, "Free Reading must not reveal before account persistence");
  log("Three-Coin Result Choice precedes formal Free Reading account persistence PASS");
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
  await page.goto(`${BASE}/robots.txt`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.evaluate(() => localStorage.setItem("quickiching:analytics-consent:v1", "denied"));
  await verifySeoAssets(page);
  await verifyQuestionReading(page);
  await verifyQuestionReading(page, "zh-Hans");
  await verifyQuestionSkipFreeOnly(page);
  await page.setViewport({ width: 390, height: 844 });
  await verifyChineseNoChangingLines(page);
  await verifyChineseQuestionAndDeepEntry(page);
  await verifyPartialRestart(page);
  await verifyYarrowPartialRestart(page);
  await verifyManualAndMovement(page);
  await verifyAccountPersistenceBoundary(page);
  await verifyResponsiveKeyboard(page);
  await context.close();
  log("ALL PUBLIC P0 BROWSER FLOWS PASS (including real keyboard Manual tabs and formal Three-Coin/Yarrow partial restart; AI activation is separately fail-closed)");
} finally {
  await browser.close();
}
