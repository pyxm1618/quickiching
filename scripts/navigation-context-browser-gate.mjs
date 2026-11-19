import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
import { resolveChromeExecutable } from "./browser-runtime.mjs";

/**
 * Remediation 2 Authority Convergence — real-browser proof.
 *
 * C9:
 *   A. Three Coin 4/6 active locale switch continues exact reading.
 *   B. Passive direct /zh entry remains the clean default entry with exact recovery state preserved.
 *   C. Yarrow 8/18 active locale switch continues exact reading.
 *   D. Manual active draft continues exact session/question/mode/draft.
 *   E. Mei Hua partial continues exact session/question/number/step.
 *
 * Current PR116 C5 regression:
 *   F. Result preserves session but filters analytics/test query and nonsemantic hash;
 *      an Authority-declared content fragment survives locale switching.
 *   G. Nested auth callback keeps the localized exact Result session.
 *   H. Nested pricing returnUrl keeps the localized exact Deep Reading session.
 *   I. QuestionFirst New Question clears live-flow authority before locale switch.
 *   J. Three Coin Start New Reading clears live-flow authority before locale switch.
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
const CHECKOUT_RETURN_CONTEXT_KEY = "quickiching:commercial:checkout-return:v1";

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

async function seed(page, { threeCoin, yarrow, meiHua, manual, manualDraft, checkoutReturn, pendings = [] } = {}) {
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
    ...(checkoutReturn ? [{ key: CHECKOUT_RETURN_CONTEXT_KEY, value: checkoutReturn }] : []),
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

  await page.waitForSelector('[data-reading-resume="three-coin"] [data-reading-resume-action]', { visible: true, timeout: 15_000 });
  assert.equal(await page.$(".hold-button"), null, "Stored Three Coin progress must remain passive before explicit Resume");
  await clickResume(page);
  await page.waitForFunction(
    () => document.querySelectorAll('.ritual-six-lines li[data-state="done"]').length === 4,
    { timeout: 15_000 },
  );
  const continuationBeforeLocaleSwitch = await page.evaluate((key) => sessionStorage.getItem(key), LOCALE_CONTINUATION_KEY);
  assert.equal(continuationBeforeLocaleSwitch, null, "Ordinary Resume must not fabricate locale-continuation intent");
  assert.equal(await doneLineCount(page), 4, "Locale continuation must restore exactly four sealed lines before the switch");

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
 * other locale renders the clean default entry, preserves exact recovery data,
 * and does not fabricate continuation intent.
 */
async function verifyPassiveEntryStaysPassive(page) {
  await seed(page, { threeCoin: threeCoinSessionPayload(ID_A, 4) });
  await page.goto(BASE + "/zh", { waitUntil: "networkidle0" });

  const stage = await page.$eval("[data-three-coin-ritual]", (node) => node.getAttribute("data-experience-stage"));
  assert.equal(stage, "landing", "A direct /zh entry must render the default entry even with a stored 4/6");
  assert.equal(await page.$(".hold-button"), null, "A direct /zh entry must not auto-enter the ritual");
  assert.equal(await page.$("[data-ritual-question-context]"), null, "A direct /zh entry must not open the casting stage");
  await page.waitForSelector('[data-reading-resume="three-coin"] [data-reading-resume-action]', { visible: true, timeout: 15_000 });
  assert.equal(await page.$(".hold-button"), null, "A direct /zh entry must stay passive until the user chooses Resume");
  const stored = await page.evaluate((key) => {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, THREE_COIN_KEY);
  assert.equal(stored?.id, ID_A, "Passive entry must preserve the exact reading id");
  assert.equal(stored?.data?.steps?.length, 4, "Passive entry must preserve all four stored lines");
  const leftover = await page.evaluate((key) => sessionStorage.getItem(key), LOCALE_CONTINUATION_KEY);
  assert.equal(leftover, null, "A passive entry must never fabricate a continuation intent");
  log("B — passive /zh entry stays clean while exact 4/6 recovery state remains preserved");
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
async function verifyRestartBoundariesClearLocaleAuthority(page) {
  // I — QuestionFirst / Yarrow: enter a fresh active flow, then New Question.
  await seed(page, {});
  await page.goto(BASE + "/methods/yarrow-stalks", { waitUntil: "networkidle0" });
  await page.waitForSelector("textarea[data-private-question]", { visible: true, timeout: 15_000 });
  await page.type("textarea[data-private-question]", "Should I keep following this path?");
  await page.evaluate(() => {
    const button = [...document.querySelectorAll("[data-question-first] button")]
      .find((node) => node.textContent?.includes("Continue"));
    if (!(button instanceof HTMLButtonElement)) throw new Error("Yarrow Continue button not found");
    button.click();
  });
  await page.waitForSelector("input[data-private-question]", { visible: true, timeout: 15_000 });
  const yarrowActiveId = await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) ?? "null")?.id ?? null, YARROW_KEY);
  assert(yarrowActiveId, "Yarrow fresh active flow must own a reading id before New Question");

  await page.evaluate(() => {
    const button = [...document.querySelectorAll("[data-question-first] button")]
      .find((node) => node.textContent?.trim() === "New question");
    if (!(button instanceof HTMLButtonElement)) throw new Error("Yarrow New question button not found");
    button.click();
  });
  await page.waitForSelector("textarea[data-private-question]", { visible: true, timeout: 15_000 });
  const yarrowRestarted = await page.evaluate(({ sessionKey, continuationKey }) => ({
    session: sessionStorage.getItem(sessionKey),
    continuation: sessionStorage.getItem(continuationKey),
    activeInput: Boolean(document.querySelector("input[data-private-question]")),
    resume: Boolean(document.querySelector("[data-reading-resume-action]")),
  }), { sessionKey: YARROW_KEY, continuationKey: LOCALE_CONTINUATION_KEY });
  assert.equal(yarrowRestarted.session, null, "New Question must retire the old Yarrow session");
  assert.equal(yarrowRestarted.continuation, null, "New Question must leave no locale-continuation intent");
  assert.equal(yarrowRestarted.activeInput, false, "New Question must leave the active Yarrow stage");
  assert.equal(yarrowRestarted.resume, false, "New Question must not expose the retired Yarrow reading as resumable");

  await clickLocaleSwitch(page, "zh-Hans");
  await page.waitForFunction(() => location.pathname === "/zh/methods/yarrow-stalks", { timeout: 20_000 });
  await page.waitForSelector("textarea[data-private-question]", { visible: true, timeout: 15_000 });
  const yarrowTarget = await page.evaluate(({ sessionKey, continuationKey }) => ({
    session: sessionStorage.getItem(sessionKey),
    continuation: sessionStorage.getItem(continuationKey),
    activeInput: Boolean(document.querySelector("input[data-private-question]")),
    progress: Boolean(document.querySelector(".ritual-progress-badge")),
    resume: Boolean(document.querySelector("[data-reading-resume-action]")),
  }), { sessionKey: YARROW_KEY, continuationKey: LOCALE_CONTINUATION_KEY });
  assert.equal(yarrowTarget.session, null, "Target locale must not reactivate the old Yarrow reading id");
  assert.equal(yarrowTarget.continuation, null, "Target locale must have no stale continuation intent");
  assert.equal(yarrowTarget.activeInput, false, "Target locale must stay at the normal Yarrow question entry");
  assert.equal(yarrowTarget.progress, false, "Target locale must not auto-enter the old Yarrow cast");
  assert.equal(yarrowTarget.resume, false, "Target locale must not offer Resume for the retired Yarrow reading");

  // J — Three Coin: explicitly Resume the exact 4/6 flow through the ordinary
  // user ingress, then use ritual Back as the Start New boundary.
  await seed(page, { threeCoin: threeCoinSessionPayload(ID_A, 4) });
  await page.goto(BASE + "/", { waitUntil: "networkidle0" });
  await page.waitForSelector('[data-reading-resume="three-coin"] [data-reading-resume-action]', { visible: true, timeout: 15_000 });
  await clickResume(page);
  await page.waitForFunction(
    () => document.querySelectorAll('.ritual-six-lines li[data-state="done"]').length === 4,
    { timeout: 15_000 },
  );
  await page.waitForSelector(".ritual-cast-ui .ritual-back:not(:disabled)", { visible: true, timeout: 15_000 });
  await page.click(".ritual-cast-ui .ritual-back");
  await page.waitForFunction(
    () => document.querySelector("[data-three-coin-ritual]")?.getAttribute("data-experience-stage") === "landing",
    { timeout: 15_000 },
  );
  const threeCoinRestarted = await page.evaluate(({ sessionKey, continuationKey }) => ({
    session: sessionStorage.getItem(sessionKey),
    continuation: sessionStorage.getItem(continuationKey),
    doneLines: document.querySelectorAll('.ritual-six-lines li[data-state="done"]').length,
    resume: Boolean(document.querySelector("[data-reading-resume-action]")),
  }), { sessionKey: THREE_COIN_KEY, continuationKey: LOCALE_CONTINUATION_KEY });
  assert.equal(threeCoinRestarted.session, null, "Start New Reading must retire the old Three Coin session");
  assert.equal(threeCoinRestarted.continuation, null, "Start New Reading must leave no locale-continuation intent");
  assert.equal(threeCoinRestarted.doneLines, 0, "Start New Reading must remove the old 4/6 cast from the UI");
  assert.equal(threeCoinRestarted.resume, false, "Start New Reading must not expose the retired Three Coin reading as resumable");

  await clickLocaleSwitch(page, "zh-Hans");
  await page.waitForFunction(() => location.pathname === "/zh", { timeout: 20_000 });
  const threeCoinTarget = await page.evaluate(({ sessionKey, continuationKey }) => ({
    session: sessionStorage.getItem(sessionKey),
    continuation: sessionStorage.getItem(continuationKey),
    stage: document.querySelector("[data-three-coin-ritual]")?.getAttribute("data-experience-stage"),
    doneLines: document.querySelectorAll('.ritual-six-lines li[data-state="done"]').length,
    resume: Boolean(document.querySelector("[data-reading-resume-action]")),
  }), { sessionKey: THREE_COIN_KEY, continuationKey: LOCALE_CONTINUATION_KEY });
  assert.equal(threeCoinTarget.session, null, "Target locale must not reactivate old Three Coin reading A");
  assert.equal(threeCoinTarget.continuation, null, "Target locale must have no stale Three Coin continuation intent");
  assert.equal(threeCoinTarget.stage, "landing", "Target locale must stay at the normal Three Coin entry");
  assert.equal(threeCoinTarget.doneLines, 0, "Target locale must not auto-enter the old 4/6 Three Coin cast");
  assert.equal(threeCoinTarget.resume, false, "Target locale must not offer Resume for retired Three Coin reading A");

  log("I/J — restart boundaries retire the old reading and leave locale switching passive");
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
  await page.waitForSelector("[data-public-reading-result] [data-free-reading-ritual]", { timeout: 20_000 });
  assert.equal(await page.$("[data-completed-cast-gate='auth-required']"), null, "Free Result must remain public before locale switching");

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
 * G — nested auth context: Deep Reading A remains account-gated. Its Sign In
 * carries session A into callbackURL, and the locale switch on the real auth
 * surface keeps the localized Deep Reading A.
 *
 * Free Result is intentionally public in Phase 2; auth-context preservation is
 * therefore verified on the paid Deep Reading capability that still requires
 * authenticated ownership.
 */
async function verifyNestedAuthLocaleContext(page) {
  await seed(page, {
    pendings: [[ID_A, pendingPayload(ID_A, "three-coin", THREE_COIN_QUESTION, [9, 6, 7, 8, 7, 9])]],
  });
  await page.goto(`${BASE}/readings/deep?session=${ID_A}`, { waitUntil: "networkidle0" });
  await page.waitForSelector('[data-completed-cast-gate="auth-required"]', { visible: true, timeout: 20_000 });
  const signinHref = await page.$eval('[data-auth-reading-intent="deep"]', (node) => node.getAttribute("href"));
  assert(signinHref?.includes("/signin?callbackURL="), `Deep Reading Sign In must carry a callbackURL, received: ${signinHref}`);
  const initialCallback = new URL(signinHref, BASE).searchParams.get("callbackURL") ?? "";
  assert.equal(
    initialCallback,
    `/readings/deep?session=${ID_A}`,
    `Deep Reading Sign In must keep session A in callbackURL, received: ${initialCallback}`,
  );

  // Open the exact Sign In target on the auth-capable surface and switch.
  await page.goto(`${AUTH_BASE}${signinHref}`, { waitUntil: "networkidle0" });
  await page.waitForSelector('[data-locale-switch="zh-Hans"]', { visible: true, timeout: 20_000 });

  await clickLocaleSwitch(page, "zh-Hans");
  await page.waitForFunction(() => location.pathname === "/zh/signin", { timeout: 20_000 });
  const localizedCallback = await page.evaluate(() => new URLSearchParams(location.search).get("callbackURL"));
  assert.equal(
    localizedCallback,
    `/zh/readings/deep?session=${ID_A}`,
    `The locale switch must keep localized Deep Reading A in callbackURL, received: ${localizedCallback}`,
  );
  log("G — nested auth context keeps localized Deep Reading A across the locale switch");
}

/**
 * H — nested pricing context: Pricing's nested returnUrl keeps the exact
 * nested Reading A across the locale switch.
 */
async function verifyNestedPricingLocaleContext(page) {
  const nestedReturn = `/readings/deep?session=${ID_A}`;
  await seed(page, {});
  await page.goto(
    `${BASE}/pricing?returnUrl=${encodeURIComponent(nestedReturn)}&utm_source=drop-me`,
    { waitUntil: "networkidle0" },
  );

  // The test is specifically about current C5's reading return context. Do not
  // inject a fabricated payment-recovery identity: Pricing is allowed to
  // normalize invalid/stale recovery state before locale navigation.
  await page.waitForFunction(
    (expected) => new URLSearchParams(location.search).get("returnUrl") === expected,
    { timeout: 20_000 },
    nestedReturn,
  );

  await clickLocaleSwitch(page, "zh-Hans");
  await page.waitForFunction(() => location.pathname === "/zh/pricing", { timeout: 20_000 });
  const localized = await page.evaluate(() => ({
    returnUrl: new URLSearchParams(location.search).get("returnUrl"),
    utm: new URLSearchParams(location.search).get("utm_source"),
  }));
  assert.equal(
    localized.returnUrl,
    `/zh/readings/deep?session=${ID_A}`,
    `The locale switch must keep the exact nested Reading A in returnUrl, received: ${localized.returnUrl}`,
  );
  assert.equal(localized.utm, null, "S16 must filter analytics-only query state");

  await clickLocaleSwitch(page, "en");
  await page.waitForFunction(() => location.pathname === "/pricing", { timeout: 20_000 });
  const restored = await page.evaluate(() => ({
    returnUrl: new URLSearchParams(location.search).get("returnUrl"),
    utm: new URLSearchParams(location.search).get("utm_source"),
  }));
  assert.equal(
    restored.returnUrl,
    nestedReturn,
    `The reverse locale switch must restore the exact nested Reading A, received: ${restored.returnUrl}`,
  );
  assert.equal(restored.utm, null, "Reverse locale switch must keep analytics state filtered");

  // Fresh payment recovery identity is flow-critical only while it matches the
  // authoritative checkout-return context. Prove it survives the same locale
  // operation without allowing analytics state through.
  const orderId = "ord_r2_fresh_1";
  const now = Date.now();
  await seed(page, {
    checkoutReturn: {
      returnUrl: nestedReturn,
      creditsBeforeCheckout: 0,
      orderId,
      createdAt: now,
      expiresAt: now + 60_000,
    },
  });
  await page.goto(
    `${BASE}/pricing?returnUrl=${encodeURIComponent(nestedReturn)}&orderId=${orderId}&utm_source=drop-me`,
    { waitUntil: "networkidle0" },
  );
  await page.waitForFunction(
    (expectedOrderId) => document.querySelector('[data-locale-switch="zh-Hans"]')?.getAttribute("href")?.includes(`orderId=${expectedOrderId}`) === true,
    { timeout: 20_000 },
    orderId,
  );
  await clickLocaleSwitch(page, "zh-Hans");
  await page.waitForFunction(
    (expectedOrderId) => location.pathname === "/zh/pricing"
      && new URLSearchParams(location.search).get("orderId") === expectedOrderId,
    { timeout: 20_000 },
    orderId,
  );
  const recoveryLocalized = await page.evaluate(() => ({
    returnUrl: new URLSearchParams(location.search).get("returnUrl"),
    orderId: new URLSearchParams(location.search).get("orderId"),
    utm: new URLSearchParams(location.search).get("utm_source"),
  }));
  assert.equal(recoveryLocalized.returnUrl, `/zh/readings/deep?session=${ID_A}`);
  assert.equal(recoveryLocalized.orderId, orderId, "Fresh payment recovery identity must survive locale switch");
  assert.equal(recoveryLocalized.utm, null, "Payment recovery locale switch must still filter analytics state");

  log("H — nested pricing returnUrl round-trip + fresh payment recovery identity preservation PASS");
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
    await verifyRestartBoundariesClearLocaleAuthority(page);
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
