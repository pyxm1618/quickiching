import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
import { resolveChromeExecutable } from "./browser-runtime.mjs";

/**
 * Remediation 2 Authority Convergence — real-browser proof.
 *
 * C9:
 *   A. Three Coin 4/6 active locale switch continues exact reading.
 *   B. Passive direct /zh entry remains default entry + Resume.
 *   C. Yarrow 8/18 active locale switch continues exact reading.
 *   D. Manual active draft continues exact session/question/mode/draft.
 *   E. Mei Hua partial continues exact session/question/number/step.
 *
 * Current PR116 C5 regression:
 *   F. Result preserves session but filters analytics/test query and nonsemantic hash;
 *      an Authority-declared content fragment survives locale switching.
 *   G. Nested auth callback keeps the localized exact Result session.
 *   H. Nested pricing returnUrl keeps the localized exact Deep Reading session.
 *
 * This gate does not implement URL transformation. It drives the existing
 * src/navigation/locale-navigation.ts authority through the real shell.
 */

const BASE = process.env.NAV_CONTEXT_TEST_BASE_URL || process.env.PUBLIC_V1_TEST_BASE_URL || "http://127.0.0.1:3036";
// The real Sign In surface requires the auth capability deployment; CI runs a
// second instance of the same production build with auth enabled so the
// nested auth-context proof can exercise the real auth shell.
const AUTH_BASE = process.env.NAV_CONTEXT_AUTH_BASE_URL || "http://127.0.0.1:3037";

const THREE_COIN_KEY = "quickiching:public-v1:three-coin";
const YARROW_KEY = "quickiching:public-v1:yarrow-v2";
const MEI_HUA_KEY = "quickiching:public-v1:mei-hua-number-time-v1";
const MANUAL_KEY = "quickiching:public-v1:manual-cast";
const MANUAL_DRAFT_KEY = "quickiching:public-v1:manual-cast:draft:v1";
const PENDING_PREFIX = "quickiching:public-v1:pending-completed-reading:";
const LOCALE_CONTINUATION_KEY = "quickiching:public-v1:locale-continuation";

const ID_A = "6f1a2b3c-4d5e-4f60-9a7b-8c9d0e1f2a3b";
const THREE_COIN_QUESTION = "Should I accept the new role?";
const YARROW_ID = "9b8c7d6e-5f4a-4b3c-8d2e-1f0a9b8c7d6e";
const YARROW_QUESTION = "Should I stay on this path?";
const MEI_HUA_ID = "2b3c4d5e-6f70-4a81-9b2c-3d4e5f607182";
const MEI_HUA_QUESTION = "Should I launch this project now?";
const MANUAL_ID = "0a1b2c3d-4e5f-4a6b-9c8d-7e6f5a4b3c2d";
const MANUAL_QUESTION = "Should I move to Kyoto?";

const STEPS = [
  { lineIndex: 0, coinFaces: ["yang", "yang", "yang"], lineValue: 9, algorithmVersion: "three-coin-v1" },
  { lineIndex: 1, coinFaces: ["yin", "yin", "yin"], lineValue: 6, algorithmVersion: "three-coin-v1" },
  { lineIndex: 2, coinFaces: ["yang", "yin", "yin"], lineValue: 7, algorithmVersion: "three-coin-v1" },
  { lineIndex: 3, coinFaces: ["yang", "yang", "yin"], lineValue: 8, algorithmVersion: "three-coin-v1" },
  { lineIndex: 4, coinFaces: ["yang", "yin", "yin"], lineValue: 7, algorithmVersion: "three-coin-v1" },
  { lineIndex: 5, coinFaces: ["yang", "yang", "yang"], lineValue: 9, algorithmVersion: "three-coin-v1" },
];

function log(message) {
  console.log(`[Navigation Context Gate] ${message}`);
}

function threeCoinSessionPayload(id, stepCount, question = THREE_COIN_QUESTION) {
  return {
    schemaVersion: 1,
    id,
    createdAt: new Date(Date.UTC(2026, 10, 15, 9, 30)).toISOString(),
    started: true,
    question,
    coreQuestionAtCast: question,
    coreQuestionFrozenAtCast: true,
    data: { steps: STEPS.slice(0, stepCount) },
  };
}

function methodSessionEnvelope(id, question, data) {
  return {
    schemaVersion: 1,
    id,
    createdAt: new Date(Date.UTC(2026, 10, 15, 1, 0)).toISOString(),
    started: true,
    question,
    coreQuestionAtCast: question,
    coreQuestionFrozenAtCast: true,
    ...(data ? { data } : {}),
  };
}

function yarrowChanges(count) {
  return Array.from({ length: count }, (_, index) => ({
    lineIndex: Math.floor(index / 3),
    changeIndex: index % 3,
    startingStalks: 49,
    endingStalks: 28,
    leftGroup: 20,
    rightGroup: 28,
    leftRemainder: 4,
    rightRemainder: 4,
    algorithmVersion: "yarrow-zhu-xi-digital-v2",
  }));
}

function pendingPayload(readingId, method, question, lineValuesBottomUp) {
  const now = Date.now();
  return {
    schemaVersion: 1,
    readingId,
    method,
    methodVersion: method === "three-coin" ? "three-coin-v1" : "manual-cast-v1",
    ...(question ? { question } : {}),
    lineValuesBottomUp,
    evidence: method === "three-coin"
      ? { kind: "three-coin", steps: STEPS }
      : { kind: "manual", mode: "line-values" },
    createdAt: new Date(now - 60_000).toISOString(),
    pendingCreatedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 60 * 60 * 1000).toISOString(),
  };
}

async function clearNavigationStorage(page) {
  await page.evaluate((continuationKey) => {
    sessionStorage.clear();
    localStorage.clear();
    // A real visitor answers the consent banner first; seed that answer so a
    // fixed consent panel cannot intercept the Resume / language clicks.
    localStorage.setItem("quickiching:analytics-consent:v1", "denied");
    sessionStorage.removeItem(continuationKey);
  }, LOCALE_CONTINUATION_KEY);
}

async function seed(page, { threeCoin, yarrow, meiHua, manual, manualDraft, pendings = [] } = {}) {
  await page.goto(BASE + "/", { waitUntil: "networkidle0" });
  await clearNavigationStorage(page);
  await page.evaluate((records) => {
    for (const { key, value, storage } of records) {
      const target = storage === "local" ? localStorage : sessionStorage;
      target.setItem(key, JSON.stringify(value));
    }
  }, [
    ...(threeCoin ? [{ key: THREE_COIN_KEY, value: threeCoin }] : []),
    ...(yarrow ? [{ key: YARROW_KEY, value: yarrow }] : []),
    ...(meiHua ? [{ key: MEI_HUA_KEY, value: meiHua }] : []),
    ...(manual ? [{ key: MANUAL_KEY, value: manual }] : []),
    ...(manualDraft ? [{ key: MANUAL_DRAFT_KEY, value: manualDraft }] : []),
    ...pendings.map(([id, value]) => ({ key: `${PENDING_PREFIX}${id}`, value, storage: "local" })),
  ]);
}

async function clickLocaleSwitch(page, target) {
  const selector = `[data-locale-switch="${target}"]`;
  await page.waitForSelector(selector, { visible: true, timeout: 15_000 });
  await page.click(selector);
}

async function clickResume(page) {
  await page.waitForSelector("[data-reading-resume-action]", { visible: true, timeout: 15_000 });
  await page.click("[data-reading-resume-action]");
}

async function doneLineCount(page) {
  return page.evaluate(() => document.querySelectorAll('.ritual-six-lines li[data-state="done"]').length);
}

function threeCoinFacts(page) {
  return page.evaluate((key) => {
    const raw = sessionStorage.getItem(key);
    const session = raw ? JSON.parse(raw) : null;
    return {
      id: session?.id ?? null,
      question: session?.coreQuestionAtCast ?? session?.question ?? null,
      steps: session?.data?.steps?.length ?? 0,
      stage: document.querySelector("[data-three-coin-ritual]")?.getAttribute("data-experience-stage") ?? null,
      visibleQuestion: document.querySelector("[data-ritual-question-context] input")?.value ?? null,
      continuationLeftover: sessionStorage.getItem("quickiching:public-v1:locale-continuation"),
    };
  }, THREE_COIN_KEY);
}

/**
 * A — Three Coin 4/6 active locale switch: same id, same frozen question,
 * exact 4/6 stage, no recast.
 */
async function verifyThreeCoinActiveLocaleSwitch(page) {
  await seed(page, { threeCoin: threeCoinSessionPayload(ID_A, 4) });
  await page.goto(BASE + "/", { waitUntil: "networkidle0" });

  // Enter the active flow through the single Resume boundary.
  await page.waitForSelector("[data-reading-resume-action]", { visible: true, timeout: 15_000 });
  await clickResume(page);
  await page.waitForFunction(
    () => document.querySelector("[data-three-coin-ritual]")?.getAttribute("data-experience-stage") === "ritual",
    { timeout: 15_000 },
  );
  await page.waitForFunction(
    () => document.querySelectorAll('.ritual-six-lines li[data-state="done"]').length === 4,
    { timeout: 15_000 },
  );
  assert.equal(await doneLineCount(page), 4, "Resume must restore exactly four sealed lines before the switch");

  await clickLocaleSwitch(page, "zh-Hans");
  await page.waitForFunction(() => location.pathname === "/zh", { timeout: 20_000 });
  await page.waitForFunction(
    () => document.querySelector("[data-three-coin-ritual]")?.getAttribute("data-experience-stage") === "ritual",
    { timeout: 20_000 },
  );
  await page.waitForFunction(
    () => document.querySelectorAll('.ritual-six-lines li[data-state="done"]').length === 4,
    { timeout: 20_000 },
  );

  const facts = await threeCoinFacts(page);
  assert.equal(facts.id, ID_A, "Active locale switch must keep the exact reading id");
  assert.equal(facts.question, THREE_COIN_QUESTION, "Active locale switch must keep the frozen question");
  assert.equal(facts.visibleQuestion, THREE_COIN_QUESTION, "Active locale switch must keep the visible question");
  assert.equal(facts.steps, 4, "Active locale switch must keep exactly four cast steps");
  assert.equal(await doneLineCount(page), 4, "Active locale switch must show exactly 4/6 lines");
  assert.equal(facts.stage, "ritual", "Active locale switch must continue at the exact partial stage");
  assert.equal(facts.continuationLeftover, null, "The one-shot continuation intent must be consumed");
  log("A — Three Coin 4/6 active locale switch keeps the same reading at exactly 4/6");
}

/**
 * B — passive entry remains passive: a stored 4/6 opened directly in the
 * other locale renders the default entry with Resume and no auto ritual.
 */
async function verifyPassiveEntryStaysPassive(page) {
  await seed(page, { threeCoin: threeCoinSessionPayload(ID_A, 4) });
  await page.goto(BASE + "/zh", { waitUntil: "networkidle0" });

  const stage = await page.$eval("[data-three-coin-ritual]", (node) => node.getAttribute("data-experience-stage"));
  assert.equal(stage, "landing", "A direct /zh entry must render the default entry even with a stored 4/6");
  assert.equal(await page.$(".hold-button"), null, "A direct /zh entry must not auto-enter the ritual");
  assert.equal(await page.$("[data-ritual-question-context]"), null, "A direct /zh entry must not open the casting stage");
  await page.waitForSelector("[data-reading-resume-action]", { visible: true, timeout: 15_000 });
  const label = await page.$eval("[data-reading-resume-action]", (node) => node.textContent ?? "");
  assert(label.includes("4 / 6"), `Resume must be available and report 4/6, received: ${label}`);
  const leftover = await page.evaluate((key) => sessionStorage.getItem(key), LOCALE_CONTINUATION_KEY);
  assert.equal(leftover, null, "A passive entry must never fabricate a continuation intent");
  log("B — passive /zh entry stays passive: default entry + Resume, no auto ritual");
}

/**
 * C — Yarrow 8/18 active locale switch keeps the exact 8/18 and identity.
 */
async function verifyYarrowActiveLocaleSwitch(page) {
  await seed(page, {
    yarrow: methodSessionEnvelope(YARROW_ID, YARROW_QUESTION, { changes: yarrowChanges(8) }),
  });
  await page.goto(BASE + "/methods/yarrow-stalks", { waitUntil: "networkidle0" });
  await page.waitForSelector("[data-reading-resume-action]", { visible: true, timeout: 15_000 });
  await clickResume(page);
  await page.waitForFunction(
    () => document.querySelector(".ritual-progress-badge")?.textContent?.includes("8 / 18") === true,
    { timeout: 15_000 },
  );

  await clickLocaleSwitch(page, "zh-Hans");
  await page.waitForFunction(() => location.pathname === "/zh/methods/yarrow-stalks", { timeout: 20_000 });
  await page.waitForFunction(
    () => document.querySelector(".ritual-progress-badge")?.textContent?.includes("8 / 18") === true,
    { timeout: 20_000 },
  );

  const state = await page.evaluate((key) => {
    const raw = sessionStorage.getItem(key);
    const session = raw ? JSON.parse(raw) : null;
    return {
      id: session?.id ?? null,
      changes: session?.data?.changes?.length ?? 0,
      question: document.querySelector("input[data-private-question]")?.value ?? "",
    };
  }, YARROW_KEY);
  assert.equal(state.id, YARROW_ID, "Yarrow locale switch must keep the exact reading id");
  assert.equal(state.changes, 8, "Yarrow locale switch must keep exactly eight changes");
  assert.equal(state.question, YARROW_QUESTION, "Yarrow locale switch must keep the frozen question");
  log("C — Yarrow 8/18 active locale switch keeps the exact 8/18 and identity");
}

/**
 * D — Manual active draft locale switch keeps the exact draft and identity.
 */
async function verifyManualDraftActiveLocaleSwitch(page) {
  const draftValues = [9, 8, 7, 6, 9, 8];
  await seed(page, {
    manual: methodSessionEnvelope(MANUAL_ID, MANUAL_QUESTION),
    manualDraft: {
      schemaVersion: 1,
      questionKey: MANUAL_QUESTION,
      mode: "line-values",
      lineValuesBottomUp: draftValues,
      primaryHexagram: 1,
      changingLines: [],
    },
  });
  await page.goto(BASE + "/methods/manual-cast", { waitUntil: "networkidle0" });
  await page.waitForSelector("[data-reading-resume-action]", { visible: true, timeout: 15_000 });
  await clickResume(page);
  await page.waitForFunction(
    () => document.querySelector('[data-line-position="1"][data-line-value="9"][data-selected="true"]') !== null,
    { timeout: 15_000 },
  );

  await clickLocaleSwitch(page, "zh-Hans");
  await page.waitForFunction(() => location.pathname === "/zh/methods/manual-cast", { timeout: 20_000 });
  await page.waitForFunction(
    () => document.querySelector('[data-line-position="1"][data-line-value="9"][data-selected="true"]') !== null,
    { timeout: 20_000 },
  );

  for (let index = 0; index < draftValues.length; index += 1) {
    const position = index + 1;
    const selector = `[data-line-position="${position}"][data-line-value="${draftValues[index]}"][data-selected="true"]`;
    assert(await page.$(selector), `Locale switch must keep the exact draft line ${position}=${draftValues[index]}`);
  }
  const identity = await page.evaluate((keys) => {
    const session = JSON.parse(sessionStorage.getItem(keys.session) ?? "null");
    const draft = JSON.parse(sessionStorage.getItem(keys.draft) ?? "null");
    return { id: session?.id ?? null, draftQuestion: draft?.questionKey ?? null };
  }, { session: MANUAL_KEY, draft: MANUAL_DRAFT_KEY });
  assert.equal(identity.id, MANUAL_ID, "Manual locale switch must keep the exact session identity");
  assert.equal(identity.draftQuestion, MANUAL_QUESTION, "Manual locale switch must keep the draft question key");
  log("D — Manual draft active locale switch keeps the exact draft and identity");
}

/**
 * E — Mei Hua partial locale switch keeps exact identity, question, selected
 * number and step. No cast moment is computed and no recast occurs.
 */
async function verifyMeiHuaActiveLocaleSwitch(page) {
  const draft = {
    mode: "number-time-draft",
    inputVersion: "mei-hua-number-time-input-v1",
    step: 3,
    number: 8,
  };
  await seed(page, {
    meiHua: methodSessionEnvelope(MEI_HUA_ID, MEI_HUA_QUESTION, draft),
  });
  await page.goto(BASE + "/methods/mei-hua-yi-shu", { waitUntil: "networkidle0" });
  await page.waitForSelector("[data-reading-resume-action]", { visible: true, timeout: 15_000 });
  await clickResume(page);
  await page.waitForFunction(
    () => document.querySelector("[data-mei-hua-flow]")?.getAttribute("data-mei-hua-step") === "3",
    { timeout: 15_000 },
  );

  await clickLocaleSwitch(page, "zh-Hans");
  await page.waitForFunction(
    () => location.pathname === "/zh/methods/mei-hua-yi-shu"
      && document.querySelector("[data-mei-hua-flow]")?.getAttribute("data-mei-hua-step") === "3",
    { timeout: 20_000 },
  );

  const state = await page.evaluate((key) => {
    const raw = sessionStorage.getItem(key);
    const session = raw ? JSON.parse(raw) : null;
    return {
      id: session?.id ?? null,
      question: session?.coreQuestionAtCast ?? session?.question ?? null,
      mode: session?.data?.mode ?? null,
      step: session?.data?.step ?? null,
      number: session?.data?.number ?? null,
      hasCastMoment: typeof session?.data?.input?.utcMillis === "number",
      visibleStep: document.querySelector("[data-mei-hua-flow]")?.getAttribute("data-mei-hua-step"),
      continuationLeftover: sessionStorage.getItem("quickiching:public-v1:locale-continuation"),
    };
  }, MEI_HUA_KEY);

  assert.equal(state.id, MEI_HUA_ID, "Mei Hua locale switch must keep the exact session id");
  assert.equal(state.question, MEI_HUA_QUESTION, "Mei Hua locale switch must keep the exact question");
  assert.equal(state.mode, "number-time-draft", "Mei Hua must remain a draft, not create a cast");
  assert.equal(state.step, 3, "Mei Hua locale switch must keep exact step 3");
  assert.equal(state.number, 8, "Mei Hua locale switch must keep the selected number");
  assert.equal(state.visibleStep, "3", "Mei Hua target UI must resume at exact step 3");
  assert.equal(state.hasCastMoment, false, "Mei Hua continuation must not recalculate a cast moment");
  assert.equal(state.continuationLeftover, null, "Mei Hua one-shot intent must be consumed");
  log("E — Mei Hua partial active locale switch keeps id/question/number/exact step without recast");
}

/**
 * F — current C5 authority: Result preserves only flow-critical session state.
 * Analytics/test query and a nonsemantic Result fragment are filtered. A
 * semantic fragment on an Authority-declared content surface is preserved.
 */
async function verifyCurrentC5FilteringAndFragments(page) {
  await seed(page, {
    pendings: [[ID_A, pendingPayload(ID_A, "three-coin", THREE_COIN_QUESTION, [9, 6, 7, 8, 7, 9])]],
  });
  await page.goto(
    BASE + "/readings/result?session=" + ID_A + "&utm_source=campaign&preview=test#section",
    { waitUntil: "networkidle0" },
  );
  await page.waitForSelector("[data-completed-cast-gate]", { timeout: 20_000 });

  await clickLocaleSwitch(page, "zh-Hans");
  await page.waitForFunction(
    (expected) => location.pathname === "/zh/readings/result"
      && new URLSearchParams(location.search).get("session") === expected,
    { timeout: 20_000 },
    ID_A,
  );
  const resultState = await page.evaluate(() => ({
    session: new URLSearchParams(location.search).get("session"),
    utm: new URLSearchParams(location.search).get("utm_source"),
    preview: new URLSearchParams(location.search).get("preview"),
    hash: location.hash,
  }));
  assert.equal(resultState.session, ID_A, "Result locale switch must keep exact session A");
  assert.equal(resultState.utm, null, "Analytics query must not be mechanically copied");
  assert.equal(resultState.preview, null, "Test/preview query must not be mechanically copied");
  assert.equal(resultState.hash, "", "Nonsemantic Result hash must be filtered");

  await page.goto(BASE + "/guides/how-to-ask-the-i-ching?utm_source=campaign#overview", { waitUntil: "networkidle0" });
  const guideLocaleLink = await page.waitForSelector("[data-language-switcher] a[href]", { visible: true, timeout: 15_000 });
  await guideLocaleLink.click();
  await page.waitForFunction(
    () => location.pathname === "/zh/guides/how-to-ask-the-i-ching" && location.hash === "#overview",
    { timeout: 20_000 },
  );
  const guideState = await page.evaluate(() => ({
    utm: new URLSearchParams(location.search).get("utm_source"),
    hash: location.hash,
  }));
  assert.equal(guideState.utm, null, "Content analytics query must be filtered");
  assert.equal(guideState.hash, "#overview", "Authority-declared semantic content fragment must survive");
  log("F — PR116 C5 preserves session/semantic fragment and filters non-flow query/nonsemantic hash");
}

/**
 * G — nested auth context: Result A's Sign In carries session A into
 * callbackURL, and the locale switch on the real auth surface keeps the
 * localized Result A.
 *
 * The originating Result surface runs on the product server; the Sign In
 * surface runs on the auth-capable instance of the same production build.
 * The bridging hop is the exact asserted Sign In href — no context is
 * synthesized on either side.
 */
async function verifyNestedAuthLocaleContext(page) {
  await seed(page, {
    pendings: [[ID_A, pendingPayload(ID_A, "three-coin", THREE_COIN_QUESTION, [9, 6, 7, 8, 7, 9])]],
  });
  await page.goto(`${BASE}/readings/result?session=${ID_A}`, { waitUntil: "networkidle0" });
  await page.waitForSelector("[data-auth-reading-intent]", { visible: true, timeout: 20_000 });
  const signinHref = await page.$eval("[data-auth-reading-intent]", (node) => node.getAttribute("href"));
  assert(signinHref?.includes("/signin?callbackURL="), `Result Sign In must carry a callbackURL, received: ${signinHref}`);
  const initialCallback = new URL(signinHref, BASE).searchParams.get("callbackURL") ?? "";
  assert(initialCallback.includes(`session=${ID_A}`), `Result Sign In must keep session A in callbackURL, received: ${initialCallback}`);

  // Open the exact Sign In target on the auth-capable surface and switch.
  await page.goto(`${AUTH_BASE}${signinHref}`, { waitUntil: "networkidle0" });
  await page.waitForSelector('[data-locale-switch="zh-Hans"]', { visible: true, timeout: 20_000 });

  await clickLocaleSwitch(page, "zh-Hans");
  await page.waitForFunction(() => location.pathname === "/zh/signin", { timeout: 20_000 });
  const localizedCallback = await page.evaluate(() => new URLSearchParams(location.search).get("callbackURL"));
  assert.equal(
    localizedCallback,
    `/zh/readings/result?session=${ID_A}`,
    `The locale switch must keep the localized Result A in callbackURL, received: ${localizedCallback}`,
  );
  log("G — nested auth context keeps the localized Result A across the locale switch");
}

/**
 * H — nested pricing context: Pricing's nested returnUrl keeps the exact
 * nested Reading A across the locale switch.
 */
async function verifyNestedPricingLocaleContext(page) {
  const nestedReturn = `/readings/deep?session=${ID_A}`;
  await seed(page, {});
  await page.goto(`${BASE}/pricing?returnUrl=${encodeURIComponent(nestedReturn)}`, { waitUntil: "networkidle0" });

  await clickLocaleSwitch(page, "zh-Hans");
  await page.waitForFunction(() => location.pathname === "/zh/pricing", { timeout: 20_000 });
  const localizedReturn = await page.evaluate(() => new URLSearchParams(location.search).get("returnUrl"));
  assert.equal(
    localizedReturn,
    `/zh/readings/deep?session=${ID_A}`,
    `The locale switch must keep the exact nested Reading A in returnUrl, received: ${localizedReturn}`,
  );

  // And back again: the nested context must survive the full round trip.
  await clickLocaleSwitch(page, "en");
  await page.waitForFunction(() => location.pathname === "/pricing", { timeout: 20_000 });
  const restoredReturn = await page.evaluate(() => new URLSearchParams(location.search).get("returnUrl"));
  assert.equal(
    restoredReturn,
    nestedReturn,
    `The reverse locale switch must restore the exact nested Reading A, received: ${restoredReturn}`,
  );
  log("H — nested pricing returnUrl keeps the exact nested Reading A in both directions");
}

async function main() {
  const serverlessChromium = {
    executablePath: async () => {
      throw new Error("A system Chrome/Chromium is required for this gate");
    },
  };
  const { executablePath, usingSystemChrome } = await resolveChromeExecutable(serverlessChromium);
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const consoleErrors = [];
  // The auth capability gate rejects decorative /account texture assets with
  // 410 when auth is off. Track 410 responses by URL so only those known
  // capability-gated asset fetches are treated as expected noise; every other
  // console error stays fatal.
  const accountAsset410 = [];
  const other410 = [];
  page.on("response", (response) => {
    if (response.status() !== 410) return;
    const pathname = new URL(response.url()).pathname;
    if (/^\/account\/.+\.(?:png|webp|jpe?g|avif)$/i.test(pathname)) accountAsset410.push(response.url());
    else other410.push(response.url());
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  try {
    log(`Using ${usingSystemChrome ? "system Chrome" : "bundled Chromium"} at ${executablePath}`);
    await verifyThreeCoinActiveLocaleSwitch(page);
    await verifyPassiveEntryStaysPassive(page);
    await verifyYarrowActiveLocaleSwitch(page);
    await verifyManualDraftActiveLocaleSwitch(page);
    await verifyMeiHuaActiveLocaleSwitch(page);
    await verifyCurrentC5FilteringAndFragments(page);
    await verifyNestedAuthLocaleContext(page);
    await verifyNestedPricingLocaleContext(page);
    assert.deepEqual(other410, [], `Unexpected 410 responses: ${other410.join(" | ")}`);
    const fatal = consoleErrors.filter((message) =>
      !/favicon|Failed to load resource.*404/i.test(message)
      && !(accountAsset410.length > 0 && /Failed to load resource.*410/i.test(message)));
    assert.deepEqual(fatal, [], `Unexpected browser errors: ${fatal.join(" | ")}`);
    log(`PASS — navigation context / locale continuation browser gate (${accountAsset410.length} capability-gated account asset fetches ignored)`);
  } finally {
    await browser.close();
  }
}

await main();
