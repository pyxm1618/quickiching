import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import puppeteer from "puppeteer-core";
import { resolveChromeExecutable } from "./browser-runtime.mjs";

/**
 * Reading Lifecycle Remediation 3 — final real-browser closeout.
 *
 * Runs on the auth-capable production build and proves:
 * - genuine Magic Link second-tab exact identity (shared localStorage, isolated sessionStorage);
 * - Sign Out retention + transient/commercial cleanup + passive Resume;
 * - cross-account commercial isolation while browser-local public readings survive;
 * - Delete Account full owned-state cleanup only after server success;
 * - Pending exact-id TTL/malformed/missing/storage/write/remove failure closure;
 * - four-method cross-state isolation;
 * - four-method completion uses replace semantics and browser history cannot resurrect casting;
 * - retired singleton/backup state never becomes runtime authority.
 */

const BASE = process.env.READING_FINAL_AUTH_BASE_URL || "http://127.0.0.1:3037";
const CAPTURE_FILE = process.env.R3_MAGIC_LINK_CAPTURE_FILE || "/tmp/qic-r3-magic-link.json";

const THREE_COIN_KEY = "quickiching:public-v1:three-coin";
const YARROW_KEY = "quickiching:public-v1:yarrow-v2";
const MEI_HUA_KEY = "quickiching:public-v1:mei-hua-number-time-v1";
const MANUAL_KEY = "quickiching:public-v1:manual-cast";
const MANUAL_DRAFT_KEY = "quickiching:public-v1:manual-cast:draft:v1";
const PENDING_PREFIX = "quickiching:public-v1:pending-completed-reading:";
const LOCALE_CONTINUATION_KEY = "quickiching:public-v1:locale-continuation";
const CHECKOUT_RETURN_KEY = "quickiching:commercial:checkout-return:v1";
const CHECKOUT_REQUEST_KEY = "quickiching:checkout-request:one";
const DEEP_CONTEXT_KEY = "quickiching:deep-reading-context:r3";
const RETIRED_SINGLETON_KEY = "quickiching:public-v1:completed-reading";
const RETIRED_BACKUP_KEY = "quickiching:public-v1:three-coin-completed-backup";
const CONSENT_KEY = "quickiching:analytics-consent:v1";
const LANGUAGE_PREF_KEY = "quickiching:language";
const APPEARANCE_PREF_KEY = "quickiching:appearance";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";
const ID_E = "55555555-5555-4555-8555-555555555555";
const THREE_ID = "33333333-3333-4333-8333-333333333333";
const YARROW_ID = "44444444-4444-4444-8444-444444444444";
const MEI_ID = "66666666-6666-4666-8666-666666666666";
const MANUAL_ID = "77777777-7777-4777-8777-777777777777";

const THREE_QUESTION = "Should I keep building this?";
const YARROW_QUESTION = "Should I stay on this path?";
const MEI_QUESTION = "Should I launch this project now?";
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
  console.log(`[R3 Final Browser Gate] ${message}`);
}

function methodEnvelope(id, question, data) {
  return {
    schemaVersion: 1,
    id,
    createdAt: new Date(Date.UTC(2026, 10, 15, 8, 0)).toISOString(),
    started: true,
    question,
    coreQuestionAtCast: question,
    coreQuestionFrozenAtCast: true,
    ...(data ? { data } : {}),
  };
}

function threeCoinSession(id, count, question = THREE_QUESTION) {
  return methodEnvelope(id, question, { steps: STEPS.slice(0, count) });
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

function manualDraft(question = MANUAL_QUESTION) {
  return {
    schemaVersion: 1,
    questionKey: question,
    mode: "line-values",
    lineValuesBottomUp: [9, 8, 7, 6, 9, 8],
    primaryHexagram: 1,
    changingLines: [],
  };
}

function pendingPayload(readingId, question, options = {}) {
  const now = options.now ?? Date.now();
  const expiresAt = options.expiresAt ?? now + 60 * 60 * 1000;
  return {
    schemaVersion: 1,
    readingId,
    method: "manual",
    methodVersion: "manual-cast-v1",
    question,
    lineValuesBottomUp: [7, 8, 9, 6, 7, 8],
    evidence: { kind: "manual", mode: "line-values" },
    createdAt: new Date(now - 60_000).toISOString(),
    pendingCreatedAt: new Date(now).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

async function freshOrigin(page) {
  await page.goto(BASE + "/", { waitUntil: "networkidle0" });
  await page.evaluate((consentKey) => {
    sessionStorage.clear();
    localStorage.clear();
    localStorage.setItem(consentKey, "denied");
  }, CONSENT_KEY);
}

async function pollCapture() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const parsed = JSON.parse(await readFile(CAPTURE_FILE, "utf8"));
      if (typeof parsed?.url === "string" && typeof parsed?.email === "string") return parsed;
    } catch {
      // Better Auth writes asynchronously after the browser submits the form.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Magic Link capture was not written");
}

async function requestMagicLink(page, email, callbackPath) {
  await rm(CAPTURE_FILE, { force: true });
  await page.goto(`${BASE}/signin?callbackURL=${encodeURIComponent(callbackPath)}`, { waitUntil: "networkidle0" });
  await page.waitForSelector("#signin-email", { visible: true, timeout: 15_000 });
  await page.type("#signin-email", email);
  await page.click('form button[type="submit"]');
  const captured = await pollCapture();
  assert.equal(captured.email, email);
  const link = new URL(captured.url);
  assert.equal(link.origin, BASE);
  assert(link.pathname.includes("magic-link"), `Expected real Better Auth magic-link verification URL, received ${link.pathname}`);
  return captured.url;
}

async function clickResume(page) {
  await page.waitForSelector("[data-reading-resume-action]", { visible: true, timeout: 15_000 });
  await page.click("[data-reading-resume-action]");
}

async function openSettings(page, expectedEmail) {
  const identity = await page.evaluate(async () => {
    const response = await fetch("/api/user/me", { cache: "no-store", credentials: "same-origin" });
    return { status: response.status, body: await response.json().catch(() => null) };
  });
  assert.equal(identity.status, 200, "Authenticated browser must resolve /api/user/me before Account actions");
  assert.equal(identity.body?.user?.email, expectedEmail, "Account action must execute under the expected genuine Better Auth session");

  const trigger = await page.$("[data-user-nav-menu-button]");
  const triggerVisible = trigger
    ? await trigger.evaluate((node) => Boolean(node.getClientRects().length))
    : false;

  if (triggerVisible) {
    await trigger.click();
    await page.waitForSelector("[data-user-nav-dropdown]", { visible: true, timeout: 10_000 });
    const clicked = await page.evaluate(() => {
      const button = [...document.querySelectorAll('[data-user-nav-dropdown] button')]
        .find((node) => node.textContent?.trim().includes("Settings"));
      if (!(button instanceof HTMLButtonElement)) return false;
      button.click();
      return true;
    });
    assert(clicked, "Authenticated user menu must expose Settings");
  } else {
    // AccountModalHost is dynamically mounted. Re-dispatch the same production
    // event until its listener is installed rather than treating module-load
    // timing as lifecycle behavior.
    let opened = false;
    for (let attempt = 0; attempt < 60 && !opened; attempt += 1) {
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent("quickiching:open-account", { detail: "settings" }));
      });
      opened = await page.evaluate(() => Boolean(document.querySelector('[data-account-surface="settings"]')));
      if (!opened) await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert(opened, "Production AccountModalHost must open the Settings surface");
  }

  await page.waitForSelector('[data-account-surface="settings"]', { visible: true, timeout: 15_000 });
  // SettingsView is React.lazy under Suspense. The dialog shell can be visible
  // before the actual Account controls chunk has mounted.
  await page.waitForSelector(".qic-account-settings-primary", { visible: true, timeout: 15_000 });
}

async function dispatchThreeCoinPointer(page, type, pointerId = 61) {
  const ok = await page.evaluate(({ eventType, id }) => {
    const button = [...document.querySelectorAll("button")]
      .find((node) => node.textContent?.trim() === "Toss three coins");
    if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
    if (eventType === "pointerdown") button.setPointerCapture = () => {};
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
  assert(ok, `Unable to dispatch ${type} to Three Coin`);
}

async function verifyMagicLinkSecondTab(context, pageA) {
  await freshOrigin(pageA);
  await pageA.evaluate(({ prefix, a, b, pendingA, pendingB, threeKey, continuationKey }) => {
    localStorage.setItem(prefix + a, JSON.stringify(pendingA));
    localStorage.setItem(prefix + b, JSON.stringify(pendingB));
    sessionStorage.setItem(threeKey, JSON.stringify({
      schemaVersion: 1,
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      createdAt: new Date().toISOString(),
      started: true,
      data: { steps: [] },
    }));
    sessionStorage.setItem(continuationKey, JSON.stringify({ stale: true }));
  }, {
    prefix: PENDING_PREFIX,
    a: ID_A,
    b: ID_B,
    pendingA: pendingPayload(ID_A, "Reading A exact callback"),
    pendingB: pendingPayload(ID_B, "Reading B must not win"),
    threeKey: THREE_COIN_KEY,
    continuationKey: LOCALE_CONTINUATION_KEY,
  });

  const magicURL = await requestMagicLink(
    pageA,
    "r3-account-a@example.com",
    `/readings/choice?session=${ID_A}`,
  );

  const pageB = await context.newPage();
  await pageB.setViewport({ width: 1280, height: 900 });
  await pageB.goto(BASE + "/", { waitUntil: "networkidle0" });

  const splitState = await pageB.evaluate(({ prefix, a, b, threeKey, continuationKey }) => ({
    pendingA: localStorage.getItem(prefix + a),
    pendingB: localStorage.getItem(prefix + b),
    three: sessionStorage.getItem(threeKey),
    continuation: sessionStorage.getItem(continuationKey),
  }), { prefix: PENDING_PREFIX, a: ID_A, b: ID_B, threeKey: THREE_COIN_KEY, continuationKey: LOCALE_CONTINUATION_KEY });
  assert(splitState.pendingA && splitState.pendingB, "Page B must share Page A localStorage Pending[A] + Pending[B]");
  assert.equal(splitState.three, null, "A genuine second tab must not inherit Page A method sessionStorage");
  assert.equal(splitState.continuation, null, "A genuine second tab must not inherit Page A C9 sessionStorage");

  await pageB.goto(magicURL, { waitUntil: "networkidle0" });
  await pageB.waitForFunction(
    (id) => location.pathname === "/readings/choice"
      && new URLSearchParams(location.search).get("session") === id,
    { timeout: 20_000 },
    ID_A,
  );
  await pageB.waitForSelector("[data-result-choice]", { timeout: 15_000 });
  assert.equal(
    await pageB.$eval("[data-result-choice]", (node) => node.getAttribute("data-reading-session")),
    ID_A,
    "Magic Link callback must resolve exact reading A",
  );
  const text = await pageB.$eval("[data-result-choice-question]", (node) => node.textContent ?? "");
  assert(text.includes("Reading A exact callback"), "Magic Link callback must render A");
  assert(!text.includes("Reading B must not win"), "Magic Link callback must never choose B/latest/first");
  const coexist = await pageB.evaluate(({ prefix, a, b }) => ({
    a: localStorage.getItem(prefix + a),
    b: localStorage.getItem(prefix + b),
  }), { prefix: PENDING_PREFIX, a: ID_A, b: ID_B });
  assert(coexist.a && coexist.b, "Choice callback must leave Pending[A] and Pending[B] coexisting");
  log("Magic Link — genuine BrowserContext second tab resolves exact A; localStorage shared, sessionStorage isolated");
  return pageB;
}

async function seedSignOutState(page) {
  await page.goto(BASE + "/", { waitUntil: "networkidle0" });
  await page.evaluate((x) => {
    sessionStorage.setItem(x.threeKey, JSON.stringify(x.three));
    sessionStorage.setItem(x.yarrowKey, JSON.stringify(x.yarrow));
    sessionStorage.setItem(x.meiKey, JSON.stringify(x.mei));
    sessionStorage.setItem(x.manualKey, JSON.stringify(x.manual));
    sessionStorage.setItem(x.manualDraftKey, JSON.stringify(x.manualDraft));
    sessionStorage.setItem(x.continuationKey, JSON.stringify({
      schemaVersion: 1,
      nonce: "r3-signout",
      method: "three-coin",
      readingId: x.three.id,
      targetLocale: "zh-Hans",
      issuedAt: Date.now(),
    }));
    sessionStorage.setItem(x.checkoutReturnKey, JSON.stringify({
      orderId: "order-A",
      creditsBeforeCheckout: 2,
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      returnUrl: "/readings/deep?session=" + x.pendingE.readingId,
    }));
    sessionStorage.setItem(x.checkoutRequestKey, "checkout-request-A");
    sessionStorage.setItem(x.deepContextKey, JSON.stringify({ account: "A" }));
    sessionStorage.setItem(x.appearanceKey, "dark");
    localStorage.setItem(x.pendingPrefix + x.pendingE.readingId, JSON.stringify(x.pendingE));
    localStorage.setItem(x.consentKey, "denied");
    localStorage.setItem(x.languageKey, "en");
  }, {
    threeKey: THREE_COIN_KEY,
    yarrowKey: YARROW_KEY,
    meiKey: MEI_HUA_KEY,
    manualKey: MANUAL_KEY,
    manualDraftKey: MANUAL_DRAFT_KEY,
    continuationKey: LOCALE_CONTINUATION_KEY,
    checkoutReturnKey: CHECKOUT_RETURN_KEY,
    checkoutRequestKey: CHECKOUT_REQUEST_KEY,
    deepContextKey: DEEP_CONTEXT_KEY,
    appearanceKey: APPEARANCE_PREF_KEY,
    consentKey: CONSENT_KEY,
    languageKey: LANGUAGE_PREF_KEY,
    pendingPrefix: PENDING_PREFIX,
    three: threeCoinSession(THREE_ID, 4),
    yarrow: methodEnvelope(YARROW_ID, YARROW_QUESTION, { changes: yarrowChanges(8) }),
    mei: methodEnvelope(MEI_ID, MEI_QUESTION, {
      mode: "number-time-draft",
      inputVersion: "mei-hua-number-time-input-v1",
      step: 3,
      number: 8,
    }),
    manual: methodEnvelope(MANUAL_ID, MANUAL_QUESTION),
    manualDraft: manualDraft(),
    pendingE: pendingPayload(ID_E, "Pending E survives Sign Out"),
  });

  await page.reload({ waitUntil: "networkidle0" });
  await clickResume(page);
  await page.waitForFunction(
    () => document.querySelector("[data-three-coin-ritual]")?.getAttribute("data-experience-stage") === "ritual",
    { timeout: 15_000 },
  );
}

async function verifySignOutRetention(page) {
  await seedSignOutState(page);
  await openSettings(page, "r3-account-a@example.com");
  await page.click('[data-account-sign-out="true"]');
  await page.waitForFunction(() => location.pathname === "/", { timeout: 20_000 });
  await page.waitForSelector("[data-three-coin-ritual]", { timeout: 15_000 });
  // C1 passive detection runs in QuestionFirst's mount effect. Wait for that
  // effect to expose the affordance before asserting retention; the UI must
  // still remain at the default landing stage until the user explicitly resumes.
  await page.waitForSelector(
    '[data-reading-resume="three-coin"] [data-reading-resume-action]',
    { visible: true, timeout: 15_000 },
  );

  const state = await page.evaluate((x) => ({
    three: sessionStorage.getItem(x.threeKey),
    yarrow: sessionStorage.getItem(x.yarrowKey),
    mei: sessionStorage.getItem(x.meiKey),
    manual: sessionStorage.getItem(x.manualKey),
    manualDraft: sessionStorage.getItem(x.manualDraftKey),
    pendingE: localStorage.getItem(x.pendingPrefix + x.pendingId),
    continuation: sessionStorage.getItem(x.continuationKey),
    checkoutReturn: sessionStorage.getItem(x.checkoutReturnKey),
    checkoutRequest: sessionStorage.getItem(x.checkoutRequestKey),
    deepContext: sessionStorage.getItem(x.deepContextKey),
    consent: localStorage.getItem(x.consentKey),
    language: localStorage.getItem(x.languageKey),
    appearance: sessionStorage.getItem(x.appearanceKey),
    stage: document.querySelector("[data-three-coin-ritual]")?.getAttribute("data-experience-stage"),
    resume: Boolean(document.querySelector("[data-reading-resume-action]")),
    activeCastButton: Boolean(document.querySelector(".hold-button")),
  }), {
    threeKey: THREE_COIN_KEY,
    yarrowKey: YARROW_KEY,
    meiKey: MEI_HUA_KEY,
    manualKey: MANUAL_KEY,
    manualDraftKey: MANUAL_DRAFT_KEY,
    pendingPrefix: PENDING_PREFIX,
    pendingId: ID_E,
    continuationKey: LOCALE_CONTINUATION_KEY,
    checkoutReturnKey: CHECKOUT_RETURN_KEY,
    checkoutRequestKey: CHECKOUT_REQUEST_KEY,
    deepContextKey: DEEP_CONTEXT_KEY,
    consentKey: CONSENT_KEY,
    languageKey: LANGUAGE_PREF_KEY,
    appearanceKey: APPEARANCE_PREF_KEY,
  });

  for (const [name, value] of Object.entries({
    three: state.three,
    yarrow: state.yarrow,
    mei: state.mei,
    manual: state.manual,
    manualDraft: state.manualDraft,
    pendingE: state.pendingE,
  })) assert(value, `Sign Out must preserve ${name}`);
  assert.equal(state.continuation, null, "Sign Out must clear C9 locale continuation");
  assert.equal(state.checkoutReturn, null, "Sign Out must clear checkout-return");
  assert.equal(state.checkoutRequest, null, "Sign Out must clear checkout request identity");
  assert.equal(state.deepContext, null, "Sign Out must clear account/deep commercial context");
  assert.equal(state.consent, "denied", "Sign Out must preserve analytics consent");
  assert.equal(state.language, "en", "Sign Out must preserve language preference");
  assert.equal(state.appearance, "dark", "Sign Out must preserve appearance preference");
  assert.equal(state.stage, "landing", "Sign Out return must render default Three Coin entry");
  assert.equal(state.resume, true, "Sign Out preserved Three Coin state must expose Resume");
  assert.equal(state.activeCastButton, false, "Sign Out must not automatically reactivate casting");

  const checks = [
    ["/methods/yarrow-stalks", "yarrow-stalks", () => document.querySelector(".ritual-progress-badge")],
    ["/methods/manual-cast", "manual", () => document.querySelector("[data-manual-cast-tool]")],
  ];
  for (const [path, method] of checks) {
    await page.goto(BASE + path, { waitUntil: "networkidle0" });
    await page.waitForSelector(`[data-reading-resume="${method}"] [data-reading-resume-action]`, { visible: true, timeout: 15_000 });
    assert.equal(await page.evaluate((selector) => Boolean(document.querySelector(selector)), method === "yarrow-stalks" ? ".ritual-progress-badge" : "[data-manual-cast-tool]"), false, `${method} must remain passive before explicit Resume`);
  }

  await page.goto(BASE + "/methods/mei-hua-yi-shu", { waitUntil: "networkidle0" });
  await page.waitForSelector('[data-reading-resume="mei-hua-yi-shu"] [data-reading-resume-action]', { visible: true, timeout: 15_000 });
  assert.equal(
    await page.$eval("[data-mei-hua-flow]", (node) => node.getAttribute("data-mei-hua-step")),
    "1",
    "Mei Hua must return to default step 1 before explicit Resume",
  );

  // Cross-method isolation: opening Yarrow never selects another method's state.
  await page.goto(BASE + "/methods/yarrow-stalks", { waitUntil: "networkidle0" });
  const visibleResumes = await page.$$eval("[data-reading-resume]", (nodes) => nodes.map((node) => node.getAttribute("data-reading-resume")));
  assert.deepEqual(visibleResumes, ["yarrow-stalks"], "Yarrow must expose only Yarrow's own resumable state");
  const ids = await page.evaluate((x) => Object.fromEntries(Object.entries(x).map(([name, key]) => {
    const raw = sessionStorage.getItem(key);
    return [name, raw ? JSON.parse(raw).id ?? null : null];
  })), { three: THREE_COIN_KEY, yarrow: YARROW_KEY, mei: MEI_HUA_KEY, manual: MANUAL_KEY });
  assert.deepEqual(ids, { three: THREE_ID, yarrow: YARROW_ID, mei: MEI_ID, manual: MANUAL_ID }, "Cross-method storage must remain isolated");
  log("Sign Out — public recovery retained/passive; C9/live context/commercial recovery cleared; method isolation PASS");
}

async function verifyCrossAccountSafety(page) {
  const magicURL = await requestMagicLink(page, "r3-account-b@example.com", "/");
  // Same tab on purpose: Account B inherits the same sessionStorage container,
  // so this proves cleanup rather than relying on second-tab isolation.
  await page.goto(magicURL, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => location.pathname === "/", { timeout: 20_000 });

  const state = await page.evaluate((x) => ({
    checkoutReturn: sessionStorage.getItem(x.checkoutReturnKey),
    checkoutRequest: sessionStorage.getItem(x.checkoutRequestKey),
    deepContext: sessionStorage.getItem(x.deepContextKey),
    publicThree: sessionStorage.getItem(x.threeKey),
    pending: localStorage.getItem(x.pendingPrefix + x.pendingId),
  }), {
    checkoutReturnKey: CHECKOUT_RETURN_KEY,
    checkoutRequestKey: CHECKOUT_REQUEST_KEY,
    deepContextKey: DEEP_CONTEXT_KEY,
    threeKey: THREE_COIN_KEY,
    pendingPrefix: PENDING_PREFIX,
    pendingId: ID_E,
  });
  assert.equal(state.checkoutReturn, null, "Account B must not inherit Account A checkout-return");
  assert.equal(state.checkoutRequest, null, "Account B must not inherit Account A checkout request identity");
  assert.equal(state.deepContext, null, "Account B must not inherit Account A commercial/account context");
  assert(state.publicThree, "Account B/anonymous transition may retain browser-local public method session");
  assert(state.pending, "Pending reading identity is browser-local reading identity, not account identity");
  log("Cross-account — Account A commercial recovery cannot leak into Account B; public Pending survives");
}

async function verifyDeleteAccount(page) {
  await page.evaluate((x) => {
    for (const [key, value] of Object.entries(x.session)) sessionStorage.setItem(key, value);
    for (const [key, value] of Object.entries(x.local)) localStorage.setItem(key, value);
  }, {
    session: {
      [THREE_COIN_KEY]: JSON.stringify(threeCoinSession(THREE_ID, 4)),
      [YARROW_KEY]: JSON.stringify(methodEnvelope(YARROW_ID, YARROW_QUESTION, { changes: yarrowChanges(8) })),
      [MEI_HUA_KEY]: JSON.stringify(methodEnvelope(MEI_ID, MEI_QUESTION, { mode: "number-time-draft", inputVersion: "mei-hua-number-time-input-v1", step: 3, number: 8 })),
      [MANUAL_KEY]: JSON.stringify(methodEnvelope(MANUAL_ID, MANUAL_QUESTION)),
      [MANUAL_DRAFT_KEY]: JSON.stringify(manualDraft()),
      [LOCALE_CONTINUATION_KEY]: JSON.stringify({ active: true }),
      [CHECKOUT_RETURN_KEY]: JSON.stringify({ orderId: "order-B" }),
      [CHECKOUT_REQUEST_KEY]: "request-B",
      [DEEP_CONTEXT_KEY]: JSON.stringify({ account: "B" }),
      [RETIRED_SINGLETON_KEY]: "retired-session-residue",
      [RETIRED_BACKUP_KEY]: "retired-session-residue",
      [APPEARANCE_PREF_KEY]: "dark",
    },
    local: {
      [PENDING_PREFIX + ID_E]: JSON.stringify(pendingPayload(ID_E, "delete me")),
      [RETIRED_SINGLETON_KEY]: "retired-residue",
      [RETIRED_BACKUP_KEY]: "retired-residue",
      [CONSENT_KEY]: "denied",
      [LANGUAGE_PREF_KEY]: "en",
    },
  });

  await page.reload({ waitUntil: "networkidle0" });
  await openSettings(page, "r3-account-b@example.com");
  const openedDelete = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('[data-account-surface="settings"] button')];
    const button = buttons.find((node) => node.textContent?.trim() === "Delete Account");
    if (!(button instanceof HTMLButtonElement)) return false;
    button.click();
    return true;
  });
  assert(openedDelete, "Settings must expose Delete Account");
  await page.waitForSelector("#delete-account-confirmation", { visible: true, timeout: 10_000 });
  await page.type("#delete-account-confirmation", "DELETE");
  // The browser is already on "/". Waiting only for pathname === "/" races
  // the delete request and cleanup. Require the actual full navigation caused
  // by DeleteAccountControl after server deletion + owned-state cleanup.
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0", timeout: 25_000 }),
    page.click('[data-account-delete-submit="true"]'),
  ]);
  assert.equal(new URL(page.url()).pathname, "/", "Delete Account success must navigate to the canonical Root");

  const state = await page.evaluate((x) => ({
    sessionOwned: x.sessionKeys.map((key) => [key, sessionStorage.getItem(key)]),
    pending: localStorage.getItem(x.pendingPrefix + x.pendingId),
    singleton: localStorage.getItem(x.singleton),
    backup: localStorage.getItem(x.backup),
    consent: localStorage.getItem(x.consent),
    language: localStorage.getItem(x.language),
    appearance: sessionStorage.getItem(x.appearance),
  }), {
    sessionKeys: [
      THREE_COIN_KEY,
      YARROW_KEY,
      MEI_HUA_KEY,
      MANUAL_KEY,
      MANUAL_DRAFT_KEY,
      LOCALE_CONTINUATION_KEY,
      CHECKOUT_RETURN_KEY,
      CHECKOUT_REQUEST_KEY,
      DEEP_CONTEXT_KEY,
      RETIRED_SINGLETON_KEY,
      RETIRED_BACKUP_KEY,
    ],
    pendingPrefix: PENDING_PREFIX,
    pendingId: ID_E,
    singleton: RETIRED_SINGLETON_KEY,
    backup: RETIRED_BACKUP_KEY,
    consent: CONSENT_KEY,
    language: LANGUAGE_PREF_KEY,
    appearance: APPEARANCE_PREF_KEY,
  });
  const remainingSessionOwned = state.sessionOwned.filter(([, value]) => value !== null);
  assert.deepEqual(
    remainingSessionOwned,
    [],
    `Delete Account must clear all owned session lifecycle state; remaining=${JSON.stringify(remainingSessionOwned)}`,
  );
  assert.equal(state.pending, null, "Delete Account must clear Pending[*]");
  assert.equal(state.singleton, null, "Delete Account must remove retired completed singleton residue");
  assert.equal(state.backup, null, "Delete Account must remove retired Three Coin backup residue");
  assert.equal(state.consent, "denied", "Delete Account must preserve analytics consent");
  assert.equal(state.language, "en", "Delete Account must preserve language preference");
  assert.equal(state.appearance, "dark", "Delete Account must preserve appearance preference");
  log("Delete Account — server-confirmed deletion clears all owned browser lifecycle state, preserves unrelated preferences");
}

async function verifyPendingClosure(page) {
  await freshOrigin(page);
  const expiredId = "88888888-8888-4888-8888-888888888888";
  const malformedId = "99999999-9999-4999-8999-999999999999";
  const liveId = ID_B;
  await page.evaluate((x) => {
    localStorage.setItem(x.prefix + x.expiredId, JSON.stringify(x.expired));
    localStorage.setItem(x.prefix + x.malformedId, "{not-json");
    localStorage.setItem(x.prefix + x.liveId, JSON.stringify(x.live));
  }, {
    prefix: PENDING_PREFIX,
    expiredId,
    malformedId,
    liveId,
    expired: pendingPayload(expiredId, "expired", { now: Date.now() - 2 * 60 * 60 * 1000, expiresAt: Date.now() - 60_000 }),
    live: pendingPayload(liveId, "live B"),
  });

  await page.goto(`${BASE}/readings/choice?session=${expiredId}`, { waitUntil: "networkidle0" });
  await page.waitForSelector("[data-result-choice-empty]", { timeout: 15_000 });
  const expiredState = await page.evaluate(({ expired, live }) => ({
    expired: localStorage.getItem(expired),
    live: localStorage.getItem(live),
  }), { expired: PENDING_PREFIX + expiredId, live: PENDING_PREFIX + liveId });
  assert.equal(expiredState.expired, null, "Expired exact Pending[A] must be removed");
  assert(expiredState.live, "Expired A must not consume/fallback to live B");

  await page.goto(`${BASE}/readings/choice?session=${malformedId}`, { waitUntil: "networkidle0" });
  await page.waitForSelector("[data-result-choice-empty]", { timeout: 15_000 });
  assert.equal(await page.$("[data-result-choice]"), null, "Malformed Pending must fail closed");

  await page.goto(`${BASE}/readings/choice?session=00000000-0000-4000-8000-000000000000`, { waitUntil: "networkidle0" });
  await page.waitForSelector("[data-result-choice-empty]", { timeout: 15_000 });
  assert.equal(await page.$("[data-result-choice]"), null, "Unknown exact id must not fallback");

  await page.goto(`${BASE}/readings/choice`, { waitUntil: "networkidle0" });
  await page.waitForSelector("[data-result-choice-empty]", { timeout: 15_000 });
  assert.equal(await page.$("[data-result-choice]"), null, "Missing exact id must not choose latest/first");

  // Storage unavailable: inject before document scripts execute so the
  // real Choice client experiences a throwing localStorage exact read.
  const unavailablePage = await page.browser().newPage();
  await unavailablePage.evaluateOnNewDocument((prefix) => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function(key) {
      if (this === localStorage && String(key).startsWith(prefix)) throw new DOMException("blocked", "SecurityError");
      return original.call(this, key);
    };
  }, PENDING_PREFIX);
  await unavailablePage.goto(`${BASE}/readings/choice?session=${liveId}`, { waitUntil: "networkidle0" });
  await unavailablePage.waitForSelector("[data-result-choice-empty]", { timeout: 15_000 });
  assert.equal(await unavailablePage.$("[data-result-choice]"), null, "Unavailable localStorage must fail closed without selecting B");
  await unavailablePage.close();
  log("Pending — TTL, malformed, unknown, missing and unavailable storage fail closed without fallback");

  // Pending write failure: completion must not navigate or retire the exact method session.
  await freshOrigin(page);
  await page.evaluate(({ key, value, prefix }) => {
    sessionStorage.setItem(key, JSON.stringify(value));
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(storageKey, storageValue) {
      if (this === localStorage && String(storageKey).startsWith(prefix)) throw new DOMException("quota", "QuotaExceededError");
      return original.call(this, storageKey, storageValue);
    };
  }, { key: THREE_COIN_KEY, value: threeCoinSession(THREE_ID, 5), prefix: PENDING_PREFIX });
  await page.reload({ waitUntil: "networkidle0" });
  await clickResume(page);
  // Reinstall the write blocker after reload.
  await page.evaluate((prefix) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(storageKey, storageValue) {
      if (this === localStorage && String(storageKey).startsWith(prefix)) throw new DOMException("quota", "QuotaExceededError");
      return original.call(this, storageKey, storageValue);
    };
  }, PENDING_PREFIX);
  await dispatchThreeCoinPointer(page, "pointerdown");
  await dispatchThreeCoinPointer(page, "pointerup");
  await page.waitForSelector("[data-record-this-cast]:not(:disabled)", { timeout: 15_000 });
  await page.click("[data-record-this-cast]");
  await page.waitForSelector('[data-reading-sealed-recovery], [role="alert"]', { timeout: 15_000 }).catch(() => null);
  await new Promise((resolve) => setTimeout(resolve, 800));
  assert.equal(new URL(page.url()).pathname, "/", "Pending write failure must not navigate");
  const sealed = await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) ?? "null"), THREE_COIN_KEY);
  assert.equal(sealed?.id, THREE_ID, "Pending write failure must retain the same reading id");
  assert.equal(sealed?.data?.steps?.length, 6, "Pending write failure must keep sealed six-line facts");
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), PENDING_PREFIX + THREE_ID), null, "Failed Pending write must not pretend to exist");

  // Pending remove failure: Start New Reading must stay on the exact result.
  await freshOrigin(page);
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: PENDING_PREFIX + ID_A,
    value: pendingPayload(ID_A, "remove failure exact A"),
  });
  await page.goto(`${BASE}/readings/result?session=${ID_A}`, { waitUntil: "networkidle0" });
  await page.waitForSelector("[data-public-reading-result]", { timeout: 20_000 }).catch(() => null);
  await page.evaluate((exactKey) => {
    const original = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function(key) {
      if (this === localStorage && key === exactKey) throw new DOMException("blocked", "SecurityError");
      return original.call(this, key);
    };
  }, PENDING_PREFIX + ID_A);
  const clicked = await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")]
      .find((node) => node.textContent?.includes("Start a New Reading"));
    if (!(button instanceof HTMLButtonElement)) return false;
    button.click();
    return true;
  });
  assert(clicked, "Free Result must expose Start a New Reading");
  await page.waitForSelector("[data-three-coin-clear-error]", { timeout: 10_000 });
  assert.equal(new URL(page.url()).pathname, "/readings/result", "Remove failure must keep exact result open");
  assert(await page.evaluate((key) => localStorage.getItem(key), PENDING_PREFIX + ID_A), "Remove failure must not pretend Pending[A] was removed");
  log("Pending — write failure retains sealed exact ID/no navigation; remove failure keeps result open");
}

async function seedHistoryMethod(page, method, id) {
  await freshOrigin(page);
  if (method === "three-coin") {
    await page.evaluate(({ key, value }) => sessionStorage.setItem(key, JSON.stringify(value)), {
      key: THREE_COIN_KEY,
      value: threeCoinSession(id, 5),
    });
    await page.reload({ waitUntil: "networkidle0" });
    await clickResume(page);
    await dispatchThreeCoinPointer(page, "pointerdown");
    await dispatchThreeCoinPointer(page, "pointerup");
    await page.waitForSelector("[data-record-this-cast]:not(:disabled)", { timeout: 15_000 });
    await page.click("[data-record-this-cast]");
    return;
  }

  if (method === "yarrow-stalks") {
    await page.evaluate(({ key, value }) => sessionStorage.setItem(key, JSON.stringify(value)), {
      key: YARROW_KEY,
      value: methodEnvelope(id, YARROW_QUESTION, { changes: yarrowChanges(17) }),
    });
    await page.goto(BASE + "/methods/yarrow-stalks", { waitUntil: "networkidle0" });
    await clickResume(page);
    const clicked = await page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find((node) => node.textContent?.includes("Perform change 18"));
      if (!(button instanceof HTMLButtonElement)) return false;
      button.click();
      return true;
    });
    assert(clicked, "Yarrow 17/18 must expose Perform change 18");
    return;
  }

  if (method === "mei-hua-yi-shu") {
    await page.evaluate(({ key, value }) => sessionStorage.setItem(key, JSON.stringify(value)), {
      key: MEI_HUA_KEY,
      value: methodEnvelope(id, MEI_QUESTION, {
        mode: "number-time-draft",
        inputVersion: "mei-hua-number-time-input-v1",
        step: 3,
        number: 8,
      }),
    });
    await page.goto(BASE + "/methods/mei-hua-yi-shu", { waitUntil: "networkidle0" });
    await clickResume(page);
    await page.waitForFunction(() => document.querySelector("[data-mei-hua-flow]")?.getAttribute("data-mei-hua-step") === "3", { timeout: 15_000 });
    const clicked = await page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find((node) => node.textContent?.includes("Confirm & Cast"));
      if (!(button instanceof HTMLButtonElement)) return false;
      button.click();
      return true;
    });
    assert(clicked, "Mei Hua step 3 must expose Confirm & Cast");
    return;
  }

  await page.evaluate(({ sessionKey, sessionValue, draftKey, draftValue }) => {
    sessionStorage.setItem(sessionKey, JSON.stringify(sessionValue));
    sessionStorage.setItem(draftKey, JSON.stringify(draftValue));
  }, {
    sessionKey: MANUAL_KEY,
    sessionValue: methodEnvelope(id, MANUAL_QUESTION),
    draftKey: MANUAL_DRAFT_KEY,
    draftValue: manualDraft(),
  });
  await page.goto(BASE + "/methods/manual-cast", { waitUntil: "networkidle0" });
  await clickResume(page);
  await page.waitForSelector("[data-manual-continue]", { visible: true, timeout: 15_000 });
  await page.click("[data-manual-continue]");
}

async function verifyFourMethodHistory(page) {
  const cases = [
    ["three-coin", "aaaaaaaa-1111-4111-8111-aaaaaaaa1111"],
    ["yarrow-stalks", "bbbbbbbb-2222-4222-8222-bbbbbbbb2222"],
    ["mei-hua-yi-shu", "cccccccc-3333-4333-8333-cccccccc3333"],
    ["manual", "dddddddd-4444-4444-8444-dddddddd4444"],
  ];

  for (const [method, id] of cases) {
    await seedHistoryMethod(page, method, id);
    await page.waitForFunction(
      (expected) => location.pathname === "/readings/choice"
        && new URLSearchParams(location.search).get("session") === expected,
      { timeout: 25_000 },
      id,
    );
    await page.waitForSelector("[data-result-choice]", { timeout: 15_000 });
    const before = await page.evaluate((prefix) => {
      const keys = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key?.startsWith(prefix)) keys.push(key);
      }
      return keys.sort();
    }, PENDING_PREFIX);
    assert.deepEqual(before, [PENDING_PREFIX + id], `${method} completion must create exactly Pending[id]`);

    await page.goBack({ waitUntil: "networkidle0" });
    await new Promise((resolve) => setTimeout(resolve, 500));
    const backState = await page.evaluate((x) => ({
      activeThree: Boolean(document.querySelector(".hold-button")),
      activeYarrow: Boolean(document.querySelector(".ritual-progress-badge")),
      activeManual: Boolean(document.querySelector("[data-manual-cast-tool]")),
      activeMei: document.querySelector("[data-mei-hua-flow]")?.getAttribute("data-mei-hua-step") ?? null,
      methodSession: sessionStorage.getItem(x.methodKey),
    }), {
      methodKey: method === "three-coin" ? THREE_COIN_KEY
        : method === "yarrow-stalks" ? YARROW_KEY
          : method === "mei-hua-yi-shu" ? MEI_HUA_KEY
            : MANUAL_KEY,
    });
    assert.equal(backState.methodSession, null, `${method} Back must not resurrect retired method session`);
    assert.equal(backState.activeThree, false, `${method} Back must not resurrect Three Coin casting`);
    assert.equal(backState.activeYarrow, false, `${method} Back must not resurrect Yarrow casting`);
    assert.equal(backState.activeManual, false, `${method} Back must not resurrect Manual casting`);
    assert.notEqual(backState.activeMei, "3", `${method} Back must not resurrect completed Mei Hua step`);

    await page.goForward({ waitUntil: "networkidle0" }).catch(() => null);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const after = await page.evaluate((prefix) => {
      const keys = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key?.startsWith(prefix)) keys.push(key);
      }
      return keys.sort();
    }, PENDING_PREFIX);
    assert.deepEqual(after, [PENDING_PREFIX + id], `${method} Back/Forward must not duplicate Pending or mint a new ID`);
    log(`History — ${method} replace/Back/Forward non-reentry PASS`);
  }
}

async function verifyLegacyNonAuthority(page) {
  await freshOrigin(page);
  await page.evaluate(({ singleton, backup, prefix, b, pendingB }) => {
    localStorage.setItem(singleton, JSON.stringify({ readingId: "legacy-singleton-local" }));
    localStorage.setItem(backup, JSON.stringify({ readingId: "legacy-backup-local" }));
    sessionStorage.setItem(singleton, JSON.stringify({ readingId: "legacy-singleton-session" }));
    sessionStorage.setItem(backup, JSON.stringify({ readingId: "legacy-backup-session" }));
    localStorage.setItem(prefix + b, JSON.stringify(pendingB));
  }, {
    singleton: RETIRED_SINGLETON_KEY,
    backup: RETIRED_BACKUP_KEY,
    prefix: PENDING_PREFIX,
    b: ID_B,
    pendingB: pendingPayload(ID_B, "Only exact Pending B is authoritative"),
  });

  await page.goto(BASE + "/readings/choice", { waitUntil: "networkidle0" });
  await page.waitForSelector("[data-result-choice-empty]", { timeout: 15_000 });
  assert.equal(await page.$("[data-result-choice]"), null, "Retired singleton/backup must not act as missing-session fallback");
  await page.goto(BASE + "/", { waitUntil: "networkidle0" });
  assert.equal(
    await page.$eval("[data-three-coin-ritual]", (node) => node.getAttribute("data-experience-stage")),
    "landing",
    "Legacy completed state must not hijack Home",
  );
  log("Legacy — retired singleton/backup are dead runtime authorities; exact Pending only");
}

async function main() {
  const serverlessChromium = {
    executablePath: async () => { throw new Error("A system Chrome/Chromium is required for this gate"); },
  };
  const { executablePath, usingSystemChrome } = await resolveChromeExecutable(serverlessChromium);
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = browser.defaultBrowserContext();
  const pageA = await context.newPage();
  await pageA.setViewport({ width: 1280, height: 900 });
  const consoleErrors = [];
  for (const page of [pageA]) {
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("pageerror", (error) => consoleErrors.push(error.message));
  }

  try {
    log(`Using ${usingSystemChrome ? "system Chrome" : "bundled Chromium"} at ${executablePath}`);
    const page = await verifyMagicLinkSecondTab(context, pageA);
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("pageerror", (error) => consoleErrors.push(error.message));

    await verifySignOutRetention(page);
    await verifyCrossAccountSafety(page);
    await verifyDeleteAccount(page);
    await verifyPendingClosure(page);
    await verifyFourMethodHistory(page);
    await verifyLegacyNonAuthority(page);

    const fatal = consoleErrors.filter((message) =>
      !/favicon|Failed to load resource.*404|Failed to load resource.*401/i.test(message));
    assert.deepEqual(fatal, [], `Unexpected browser errors: ${fatal.join(" | ")}`);
    log("PASS — Remediation 3 final cleanup / cross-tab / pending / history / legacy browser gate");
  } finally {
    await rm(CAPTURE_FILE, { force: true });
    await browser.close();
  }
}

await main();
