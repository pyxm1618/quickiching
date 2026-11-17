import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
import { resolveChromeExecutable } from "./browser-runtime.mjs";

/**
 * Reading Lifecycle / Navigation Authority — Remediation 1 browser gate.
 *
 * Proves, in a real Chromium session:
 *   A. a stored partial cast does not auto-enter the ritual or pollute the Home Hero; its exact data remains preserved
 *   B. a fresh completion hands off with replace, and Browser Back cannot resurrect it
 *   C. a completed reading does not hijack the Home entry
 *   D. two completed readings keep exact identity, and a missing session fails closed
 *   E. Yarrow 8/18 reopen stays on the QuestionFirst default entry; one Resume
 *      restores the frozen question and the exact 8/18 with the same id
 *   F. Manual draft reopen does the same for the exact draft line values
 *   G. Manual sealed recovery keeps the frozen question across reload, and
 *      Retry Handoff writes Pending[A] with the exact original identity
 */

const BASE = process.env.PUBLIC_V1_TEST_BASE_URL || "http://127.0.0.1:3000";
const THREE_COIN_KEY = "quickiching:public-v1:three-coin";
const PENDING_PREFIX = "quickiching:public-v1:pending-completed-reading:";
const RETIRED_SINGLETON_KEY = "quickiching:public-v1:completed-reading";
const RETIRED_BACKUP_KEY = "quickiching:public-v1:three-coin-completed-backup";

const ID_A = "6f1a2b3c-4d5e-4f60-9a7b-8c9d0e1f2a3b";
const ID_B = "7a2b3c4d-5e6f-4a70-8b9c-0d1e2f3a4b5c";

const STEPS = [
  { lineIndex: 0, coinFaces: ["yang", "yang", "yang"], lineValue: 9, algorithmVersion: "three-coin-v1" },
  { lineIndex: 1, coinFaces: ["yin", "yin", "yin"], lineValue: 6, algorithmVersion: "three-coin-v1" },
  { lineIndex: 2, coinFaces: ["yang", "yin", "yin"], lineValue: 7, algorithmVersion: "three-coin-v1" },
  { lineIndex: 3, coinFaces: ["yang", "yang", "yin"], lineValue: 8, algorithmVersion: "three-coin-v1" },
  { lineIndex: 4, coinFaces: ["yang", "yin", "yin"], lineValue: 7, algorithmVersion: "three-coin-v1" },
  { lineIndex: 5, coinFaces: ["yang", "yang", "yang"], lineValue: 9, algorithmVersion: "three-coin-v1" },
];

const THREE_COIN_QUESTION = "Should I accept the new role?";
const MANUAL_QUESTION = "Should I move to Kyoto?";
const YARROW_QUESTION = "Should I stay on this path?";
const YARROW_KEY = "quickiching:public-v1:yarrow-v2";
const MANUAL_KEY = "quickiching:public-v1:manual-cast";
const MANUAL_DRAFT_KEY = "quickiching:public-v1:manual-cast:draft:v1";
const MEI_HUA_KEY = "quickiching:public-v1:mei-hua-number-time-v1";
const YARROW_ID = "9b8c7d6e-5f4a-4b3c-8d2e-1f0a9b8c7d6e";
const MANUAL_ID = "0a1b2c3d-4e5f-4a6b-9c8d-7e6f5a4b3c2d";

function log(message) {
  console.log(`[Reading Lifecycle Gate] ${message}`);
}

function threeCoinSessionPayload(id, stepCount, question = THREE_COIN_QUESTION) {
  return {
    schemaVersion: 1,
    id,
    createdAt: new Date(Date.UTC(2026, 10, 14, 9, 30)).toISOString(),
    started: true,
    question,
    coreQuestionAtCast: question,
    coreQuestionFrozenAtCast: true,
    data: { steps: STEPS.slice(0, stepCount) },
  };
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

async function clearLifecycleStorage(page) {
  await page.evaluate((retiredKeys) => {
    sessionStorage.clear();
    localStorage.clear();
    for (const key of retiredKeys) {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    }
    // A real visitor answers the consent banner first; seed that answer so a
    // fixed consent panel cannot intercept the Resume / navigation clicks.
    localStorage.setItem("quickiching:analytics-consent:v1", "denied");
  }, [RETIRED_SINGLETON_KEY, RETIRED_BACKUP_KEY]);
}

async function seed(page, { threeCoinSession, pendings = [] } = {}) {
  await page.goto(BASE + "/", { waitUntil: "networkidle0" });
  await clearLifecycleStorage(page);
  await page.evaluate(({ threeCoinKey, pendingPrefix, session, pendingRecords }) => {
    if (session) sessionStorage.setItem(threeCoinKey, JSON.stringify(session));
    for (const [readingId, payload] of pendingRecords) {
      localStorage.setItem(`${pendingPrefix}${readingId}`, JSON.stringify(payload));
    }
  }, {
    threeCoinKey: THREE_COIN_KEY,
    pendingPrefix: PENDING_PREFIX,
    session: threeCoinSession ?? null,
    pendingRecords: pendings,
  });
}

async function seedMethodState(page, entries) {
  await page.goto(BASE + "/", { waitUntil: "networkidle0" });
  await clearLifecycleStorage(page);
  await page.evaluate((records) => {
    for (const { key, value } of records) sessionStorage.setItem(key, JSON.stringify(value));
  }, entries);
}

function yarrowChanges(count) {
  const states = [
    { startingStalks: 49, endingStalks: 44, leftGroup: 25, rightGroup: 24, leftRemainder: 1, rightRemainder: 3 },
    { startingStalks: 44, endingStalks: 36, leftGroup: 20, rightGroup: 24, leftRemainder: 4, rightRemainder: 3 },
    { startingStalks: 36, endingStalks: 28, leftGroup: 16, rightGroup: 20, leftRemainder: 4, rightRemainder: 3 },
  ];
  return Array.from({ length: count }, (_, index) => ({
    lineIndex: Math.floor(index / 3),
    changeIndex: index % 3,
    ...states[index % 3],
    removedFromRight: 1,
    algorithmVersion: "yarrow-zhu-xi-digital-v2",
  }));
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

async function doneLineCount(page) {
  return page.evaluate(() => document.querySelectorAll('.ritual-six-lines li[data-state="done"]').length);
}

async function dispatchPointer(page, type, pointerId = 41) {
  const dispatched = await page.evaluate(({ eventType, id }) => {
    const button = [...document.querySelectorAll("button")].find((node) => node.textContent?.trim() === "Toss three coins");
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
  assert(dispatched, `Unable to dispatch ${type} on the Three Coin cast button`);
}

async function clickResume(page) {
  await page.waitForSelector("[data-reading-resume-action]", { visible: true, timeout: 10_000 });
  await page.click("[data-reading-resume-action]");
}


async function startFreshThreeCoin(page, lineCount = 0) {
  await page.goto(BASE + "/", { waitUntil: "networkidle0" });
  await clearLifecycleStorage(page);
  await page.waitForSelector("[data-home-skip-question]", { visible: true, timeout: 15_000 });
  await page.click("[data-home-skip-question]");
  await page.waitForSelector('[data-experience-stage="question-confirm"]', { timeout: 15_000 });
  await page.waitForSelector("[data-home-primary-action]:not(:disabled)", { timeout: 15_000 });
  await page.click("[data-home-primary-action]");
  await page.waitForFunction(
    () => document.querySelector("[data-three-coin-ritual]")?.getAttribute("data-experience-stage") === "ritual",
    { timeout: 15_000 },
  );
  await page.waitForSelector(".hold-button:not(:disabled)", { timeout: 15_000 });

  for (let index = 0; index < lineCount; index += 1) {
    await page.waitForSelector(".hold-button:not(:disabled)", { timeout: 15_000 });
    await dispatchPointer(page, "pointerdown", 100 + index);
    await dispatchPointer(page, "pointerup", 100 + index);
    await page.waitForSelector("[data-record-this-cast]:not(:disabled)", { timeout: 15_000 });

    // A pointer release seals the authoritative line immediately, but the
    // visible six-line stack advances only when the user records it. Keep the
    // sixth line sealed-but-unrecorded so the completion test can exercise the
    // real final handoff click itself.
    const leaveFinalSealed = lineCount === 6 && index === 5;
    if (!leaveFinalSealed) {
      await page.click("[data-record-this-cast]");
      await page.waitForFunction(
        (expected) => document.querySelectorAll('.ritual-six-lines li[data-state="done"]').length === expected,
        { timeout: 15_000 },
        index + 1,
      );
    }
  }

  return page.evaluate((key) => {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, THREE_COIN_KEY);
}

async function verifyMethodDetailIsNotASecondEntry(page) {
  await page.goto(`${BASE}/methods/three-coin`, { waitUntil: "networkidle0" });
  assert.equal(await page.$("[data-three-coin-ritual]"), null, "/methods/three-coin must not mount the ritual");
  assert.equal(await page.$(".hold-button"), null, "/methods/three-coin must not expose active casting");
  const cta = await page.$eval("[data-three-coin-cta]", (node) => node.getAttribute("href"));
  assert.equal(cta, "/", "/methods/three-coin CTA must target the canonical Root entry");
  await page.goto(`${BASE}/zh/methods/three-coin`, { waitUntil: "networkidle0" });
  assert.equal(await page.$("[data-three-coin-ritual]"), null, "/zh/methods/three-coin must not mount the ritual");
  const zhCta = await page.$eval("[data-three-coin-cta]", (node) => node.getAttribute("href"));
  assert.equal(zhCta, "/zh", "/zh/methods/three-coin CTA must target the localized Root entry");
  log("C8 — / and /zh only: method detail renders SEO content + canonical CTA, no ritual");
}


async function verifyPartialResume(page) {
  await seed(page, { threeCoinSession: threeCoinSessionPayload(ID_A, 4) });
  await page.goto(BASE + "/", { waitUntil: "networkidle0" });
  const stage = await page.$eval("[data-three-coin-ritual]", (node) => node.getAttribute("data-experience-stage"));
  assert.equal(stage, "landing", "A stored 4/6 cast must render the normal entry state");
  assert.equal(await page.$("[data-ritual-question-context]"), null, "A stored 4/6 cast must not auto-enter the ritual");
  assert.equal(await page.$(".hold-button"), null, "A stored 4/6 cast must not expose the cast button on Home");
  assert.equal(await page.$("[data-reading-resume]"), null, "Home Hero must not render a Resume presentation");
  assert.equal(await page.$("[data-reading-resume-action]"), null, "Home Hero must not render a Resume action");
  const heroText = await page.$eval("[data-three-coin-ritual]", (node) => node.textContent ?? "");
  assert(!heroText.includes("You have an unfinished cast."), "Home Hero must not render unfinished-cast copy");
  assert(!heroText.includes("Resume ·"), "Home Hero must not render Resume progress copy");
  assert(heroText.includes("Start Divination"), "Home primary CTA must remain");
  assert(heroText.includes("Skip — free reading only"), "Home free-reading Skip must remain");

  const preserved = await page.evaluate((key) => {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, THREE_COIN_KEY);
  assert.equal(preserved?.id, ID_A, "Removing Home Resume presentation must preserve the exact reading id");
  assert.equal(preserved?.coreQuestionAtCast, THREE_COIN_QUESTION, "Removing Home Resume presentation must preserve the frozen question");
  assert.equal(preserved?.data?.steps?.length, 4, "Removing Home Resume presentation must preserve all four sealed lines");
  log("C1 — stored 4/6 remains preserved while Home renders only the clean landing CTA structure");
}

async function verifyFreshCompletionNonReentry(page) {
  const readingA = await startFreshThreeCoin(page, 6);
  assert(readingA?.id, "Fresh Three Coin completion must own an exact reading id");
  assert.equal(readingA?.data?.steps?.length, 6, "Fresh Three Coin completion must seal six lines before handoff");

  await page.waitForSelector("[data-record-this-cast]:not(:disabled)", { timeout: 15_000 });
  await page.click("[data-record-this-cast]");
  await page.waitForFunction(() => location.pathname === "/readings/choice", { timeout: 20_000 });
  const sessionId = await page.evaluate(() => new URLSearchParams(location.search).get("session"));
  assert.equal(sessionId, readingA.id, "Fresh completion must hand off the exact reading id");
  await page.waitForSelector("[data-result-choice]", { timeout: 15_000 });

  const storage = await page.evaluate(({ threeCoinKey, pendingPrefix, retired }) => ({
    session: sessionStorage.getItem(threeCoinKey),
    pending: localStorage.getItem(`${pendingPrefix}${new URLSearchParams(location.search).get("session")}`),
    singleton: sessionStorage.getItem(retired),
  }), { threeCoinKey: THREE_COIN_KEY, pendingPrefix: PENDING_PREFIX, retired: RETIRED_SINGLETON_KEY });
  assert.equal(storage.session, null, "Fresh completion must retire the exact method session");
  assert(storage.pending, "Fresh completion must persist exactly Pending[A]");
  assert.equal(JSON.parse(storage.pending).readingId, readingA.id, "Pending must be keyed by the exact reading id");
  assert.equal(storage.singleton, null, "The retired completed-reading singleton must not be written");

  await page.goBack({ waitUntil: "networkidle0" });
  await new Promise((resolve) => setTimeout(resolve, 1200));
  assert.equal(await page.$(".hold-button"), null, "Browser Back must not resurrect the completed casting screen");
  assert.equal(await page.$("[data-ritual-question-context]"), null, "Browser Back must not restore an active cast step");
  assert.equal(await page.$("[data-completed-cast]"), null, "Browser Back must not restore a terminal casting screen");
  log("C2/C7 — fresh completion writes exact Pending[A], retires the session, replaces into Choice; Back cannot re-enter casting");
}
async function verifyHomeIsNotHijacked(page) {
  await seed(page, {
    threeCoinSession: threeCoinSessionPayload(ID_A, 6),
    pendings: [[ID_A, pendingPayload(ID_A, "three-coin", THREE_COIN_QUESTION, [9, 6, 7, 8, 7, 9])]],
  });
  await page.goto(BASE + "/", { waitUntil: "networkidle0" });
  const stage = await page.$eval("[data-three-coin-ritual]", (node) => node.getAttribute("data-experience-stage"));
  assert.equal(stage, "landing", "A completed reading must not hijack the Home entry");
  assert.equal(new URL(page.url()).pathname, "/", "A completed reading must not navigate Home away");
  assert.equal(await page.$("[data-ritual-question-context]"), null, "A completed reading must not open the ritual");
  assert.equal(await page.$(".hold-button"), null, "A completed reading must not expose active casting");
  const pending = await page.evaluate((key) => localStorage.getItem(key), `${PENDING_PREFIX}${ID_A}`);
  assert(pending, "Home entry must not consume or clear Pending[A]");
  log("C1 — existing completed state leaves Home as the default entry");
}

async function verifyCrossMethodIdentity(page) {
  await seed(page, {
    pendings: [
      [ID_A, pendingPayload(ID_A, "three-coin", THREE_COIN_QUESTION, [9, 6, 7, 8, 7, 9])],
      [ID_B, pendingPayload(ID_B, "manual", MANUAL_QUESTION, [7, 8, 9, 6, 7, 8])],
    ],
  });

  await page.goto(`${BASE}/readings/choice?session=${ID_A}`, { waitUntil: "networkidle0" });
  await page.waitForSelector("[data-result-choice]", { timeout: 10_000 });
  assert.equal(await page.$eval("[data-result-choice]", (node) => node.getAttribute("data-reading-session")), ID_A);
  const aText = await page.$eval("[data-result-choice-question]", (node) => node.textContent ?? "");
  assert(aText.includes(THREE_COIN_QUESTION), "session=A must render reading A");
  assert(!aText.includes(MANUAL_QUESTION), "session=A must never render reading B");

  await page.goto(`${BASE}/readings/choice?session=${ID_B}`, { waitUntil: "networkidle0" });
  await page.waitForSelector("[data-result-choice]", { timeout: 10_000 });
  assert.equal(await page.$eval("[data-result-choice]", (node) => node.getAttribute("data-reading-session")), ID_B);
  const bText = await page.$eval("[data-result-choice-question]", (node) => node.textContent ?? "");
  assert(bText.includes(MANUAL_QUESTION), "session=B must render reading B");

  await page.goto(`${BASE}/readings/choice`, { waitUntil: "networkidle0" });
  await page.waitForSelector("[data-result-choice-empty]", { timeout: 10_000 });
  assert.equal(await page.$("[data-result-choice]"), null, "A missing session must fail closed even when readings exist");

  await page.goto(`${BASE}/readings/choice?session=00000000-0000-4000-8000-000000000000`, { waitUntil: "networkidle0" });
  await page.waitForSelector("[data-result-choice-empty]", { timeout: 10_000 });
  assert.equal(await page.$("[data-result-choice]"), null, "An unknown session must never fall back to another reading");
  log("C3 — exact server/pending identity: A→A, B→B, missing session and unknown session fail closed");
}

async function verifyChoiceTransitionsHaveNoGlobalLoading(page) {
  const pending = pendingPayload(ID_A, "three-coin", THREE_COIN_QUESTION, [9, 6, 7, 8, 7, 9]);

  for (const target of [
    { selector: "[data-result-choice-free]", pathname: "/readings/result", label: "Free Reading" },
    { selector: "[data-result-choice-deep]", pathname: "/readings/deep", label: "Deep Reading" },
  ]) {
    await seed(page, { pendings: [[ID_A, pending]] });
    await page.goto(`${BASE}/readings/choice?session=${ID_A}`, { waitUntil: "networkidle0" });
    await page.waitForSelector("[data-result-choice]", { timeout: 15_000 });
    await page.evaluate(() => {
      window.__qicSawGlobalPreparingScene = document.body?.innerText.includes("Preparing Your Experience") ?? false;
      const observer = new MutationObserver(() => {
        if (document.body?.innerText.includes("Preparing Your Experience")) {
          window.__qicSawGlobalPreparingScene = true;
        }
      });
      observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
      window.__qicPreparingObserver = observer;
    });

    await page.click(target.selector);
    await page.waitForFunction((pathname) => location.pathname === pathname, { timeout: 20_000 }, target.pathname);
    await page.waitForFunction(
      () => !document.body?.innerText.includes("Preparing Your Experience"),
      { timeout: 15_000 },
    );
    const flashed = await page.evaluate(() => {
      window.__qicPreparingObserver?.disconnect();
      return window.__qicSawGlobalPreparingScene === true;
    });
    assert.equal(flashed, false, `${target.label} must not flash the retired global Preparing Your Experience scene`);
  }
  log("Choice → Free / Deep — no global full-screen intermediate loading scene");
}


async function verifyYarrowPartialReopen(page) {
  await seedMethodState(page, [
    { key: YARROW_KEY, value: methodSessionEnvelope(YARROW_ID, YARROW_QUESTION, { changes: yarrowChanges(8) }) },
  ]);
  await page.goto(`${BASE}/methods/yarrow-stalks`, { waitUntil: "networkidle0" });

  // C1: QuestionFirst must render its default entry, not the active question
  // stage, and the Yarrow tool must not be mounted at all.
  assert(await page.$("textarea[data-private-question]"), "A stored 8/18 cast must render the normal question entry");
  assert.equal(await page.$('input[data-private-question]'), null, "A stored 8/18 cast must not auto-enter the active question stage");
  assert.equal(await page.$(".ritual-progress-badge"), null, "A stored 8/18 cast must not mount the Yarrow tool before Resume");
  await page.waitForSelector("[data-reading-resume-action]", { visible: true, timeout: 15_000 });
  const resumeLabel = await page.$eval("[data-reading-resume-action]", (node) => node.textContent ?? "");
  assert(resumeLabel.includes("8 / 18 changes"), `Yarrow Resume must report the exact progress, received: ${resumeLabel}`);

  // One explicit Resume restores question + exact 8/18 with the same identity.
  await clickResume(page);
  await page.waitForFunction(
    () => document.querySelector(".ritual-progress-badge")?.textContent?.includes("8 / 18") === true,
    { timeout: 15_000 },
  );
  const badge = await page.$eval(".ritual-progress-badge", (node) => node.textContent ?? "");
  assert(badge.includes("8 / 18"), `Resume must restore exactly 8/18 changes, received: ${badge}`);
  const state = await page.evaluate((key) => {
    const raw = sessionStorage.getItem(key);
    const session = raw ? JSON.parse(raw) : null;
    return {
      id: session?.id ?? null,
      changes: session?.data?.changes?.length ?? null,
      question: document.querySelector("input[data-private-question]")?.value ?? "",
      resumeAffordance: Boolean(document.querySelector("[data-reading-resume-action]")),
    };
  }, YARROW_KEY);
  assert.equal(state.id, YARROW_ID, "Resume must preserve the exact Yarrow reading id");
  assert.equal(state.changes, 8, "Resume must preserve exactly eight changes");
  assert.equal(state.question, YARROW_QUESTION, "Resume must restore the frozen question");
  assert.equal(state.resumeAffordance, false, "A single Resume must consume the affordance");
  log("C1 — Yarrow 8/18 reopen: default entry, one Resume restores question + exact 8/18");
}

async function verifyManualDraftReopen(page) {
  const draftValues = [9, 8, 7, 6, 9, 8];
  await seedMethodState(page, [
    { key: MANUAL_KEY, value: methodSessionEnvelope(MANUAL_ID, MANUAL_QUESTION) },
    {
      key: MANUAL_DRAFT_KEY,
      value: {
        schemaVersion: 1,
        questionKey: MANUAL_QUESTION,
        mode: "line-values",
        lineValuesBottomUp: draftValues,
        primaryHexagram: 1,
        changingLines: [],
      },
    },
  ]);
  await page.goto(`${BASE}/methods/manual-cast`, { waitUntil: "networkidle0" });

  // C1: default entry; the draft is detected but never mounted as the flow.
  assert(await page.$("textarea[data-private-question]"), "A stored Manual draft must render the normal question entry");
  assert.equal(await page.$("[data-manual-cast-tool]"), null, "A stored Manual draft must not open the editor before Resume");
  await page.waitForSelector("[data-reading-resume-action]", { visible: true, timeout: 15_000 });
  const resumeLabel = await page.$eval("[data-reading-resume-action]", (node) => node.textContent ?? "");
  assert(resumeLabel.includes("saved draft"), `Manual Resume must report the stored draft, received: ${resumeLabel}`);

  // One explicit Resume restores the question and the exact draft line values.
  await clickResume(page);
  await page.waitForFunction(
    () => document.querySelector('[data-line-position="1"][data-line-value="9"][data-selected="true"]') !== null,
    { timeout: 15_000 },
  );
  const question = await page.$eval("[data-manual-question] p", (node) => node.textContent ?? "");
  assert(question.includes(MANUAL_QUESTION), `Resume must restore the Manual question, received: ${question}`);
  for (let index = 0; index < draftValues.length; index += 1) {
    const position = index + 1;
    const selector = `[data-line-position="${position}"][data-line-value="${draftValues[index]}"][data-selected="true"]`;
    assert(await page.$(selector), `Resume must restore exact draft line ${position}=${draftValues[index]}`);
  }
  const storedDraft = await page.evaluate((key) => {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, MANUAL_DRAFT_KEY);
  assert.deepEqual(storedDraft?.lineValuesBottomUp, draftValues, "Resume must not overwrite the authoritative draft");
  assert.equal(storedDraft?.questionKey, MANUAL_QUESTION, "Resume must preserve the draft question key");
  log("C1 — Manual draft reopen: default entry, one Resume restores question + exact draft");
}

async function injectPendingWriteFailure(page) {
  await page.evaluate((pendingPrefix) => {
    const original = Storage.prototype.setItem;
    Object.defineProperty(window, "__restorePendingSetItem", {
      configurable: true,
      value: () => {
        Object.defineProperty(Storage.prototype, "setItem", {
          configurable: true,
          writable: true,
          value: original,
        });
      },
    });
    Object.defineProperty(Storage.prototype, "setItem", {
      configurable: true,
      writable: true,
      value: function blockedSetItem(itemKey, itemValue) {
        if (this === localStorage && String(itemKey).startsWith(pendingPrefix)) {
          throw new DOMException("Storage blocked", "SecurityError");
        }
        return original.call(this, itemKey, itemValue);
      },
    });
  }, PENDING_PREFIX);
}

async function restorePendingWriteFailure(page) {
  await page.evaluate(() => window.__restorePendingSetItem?.());
}

/**
 * HIGH-002 — Manual sealed recovery must keep the frozen question.
 *
 * fresh completion -> handoff failure -> sealed session remains -> reload ->
 * exact reconstruction -> Retry Handoff -> Pending[A] with the original
 * frozen question, same id, same lines, same evidence.
 */
async function verifyManualSealedRecoveryKeepsQuestion(page) {
  const question = "Should I move to Kyoto for a year?";
  await page.goto(BASE + "/", { waitUntil: "networkidle0" });
  await clearLifecycleStorage(page);
  await page.goto(`${BASE}/methods/manual-cast`, { waitUntil: "networkidle0" });
  await page.waitForSelector("[data-question-first] textarea[data-private-question]", { timeout: 15_000 });
  await page.type("[data-question-first] textarea[data-private-question]", question);
  await page.evaluate(() => document.querySelector("[data-question-first] button.mystic-button")?.click());
  await page.waitForSelector("[data-manual-cast-tool]:not([data-reading-sealed])", { timeout: 15_000 });

  // Force the handoff failure: Pending[A] cannot be written, so the exact
  // completed facts stay sealed in the Manual method session.
  await injectPendingWriteFailure(page);
  await page.evaluate(() => document.querySelector("[data-manual-continue]")?.click());
  await page.waitForSelector("[data-reading-sealed]", { timeout: 15_000 });
  const sealedId = await page.$eval("[data-reading-sealed]", (node) => node.getAttribute("data-reading-sealed") ?? "");
  assert(sealedId, "A failed handoff must seal the Manual completed facts");
  assert.equal(new URL(page.url()).pathname, "/methods/manual-cast", "A failed handoff must not navigate");
  await restorePendingWriteFailure(page);

  // Simulated reload: the sealed reading must be reconstructed from the
  // authoritative Manual session, including the frozen core question.
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector("[data-reading-sealed]", { timeout: 15_000 });
  const sealedSession = await page.evaluate((key) => {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, MANUAL_KEY);
  assert.equal(sealedSession?.id, sealedId, "Reload must reconstruct the exact sealed reading id");
  assert.equal(sealedSession?.coreQuestionAtCast, question, "The authoritative sealed session must keep the frozen core question");

  // Retry Handoff must hand off the exact same completed reading.
  await page.evaluate(() => document.querySelector("[data-reading-retry-handoff]")?.click());
  await page.waitForFunction(
    (resultPath) => location.pathname === resultPath && new URLSearchParams(location.search).get("session") !== null,
    { timeout: 20_000 },
    "/readings/choice",
  );
  const sessionId = await page.evaluate(() => new URLSearchParams(location.search).get("session"));
  assert.equal(sessionId, sealedId, "Retry Handoff must reuse the exact sealed reading id");
  await page.waitForSelector("[data-result-choice]", { timeout: 15_000 });

  const pending = await page.evaluate((prefix) => {
    const id = new URLSearchParams(location.search).get("session") || "";
    const raw = localStorage.getItem(prefix + id);
    return raw ? JSON.parse(raw) : null;
  }, PENDING_PREFIX);
  assert(pending, "Retry Handoff must persist exactly Pending[A]");
  assert.equal(pending.readingId, sealedId, "Pending[A].readingId must be the original reading id");
  assert.equal(pending.question, question, "Pending[A].question must be the original frozen question");
  assert.deepEqual(pending.lineValuesBottomUp, [7, 7, 7, 7, 7, 7], "Pending[A] must keep the exact six line values");
  assert.deepEqual(pending.evidence, { kind: "manual", mode: "line-values" }, "Pending[A] must keep the exact evidence");
  assert.equal(pending.createdAt, sealedSession?.createdAt, "Pending[A].createdAt must be the original cast timestamp");
  assert.equal(await page.evaluate((key) => sessionStorage.getItem(key), MANUAL_KEY), null, "A successful retry must retire the sealed method session");
  log("HIGH-002 — Manual sealed recovery keeps the frozen question across reload and Retry Handoff");
}


async function verifyManualSealedStartNewIdentity(page) {
  const questionA = "Should I stay in Kyoto this winter?";
  const questionB = "Should I visit Kyoto in spring?";
  await page.goto(BASE + "/", { waitUntil: "networkidle0" });
  await clearLifecycleStorage(page);
  await page.goto(`${BASE}/methods/manual-cast`, { waitUntil: "networkidle0" });
  await page.waitForSelector("[data-question-first] textarea[data-private-question]", { timeout: 15_000 });
  await page.type("[data-question-first] textarea[data-private-question]", questionA);
  await page.evaluate(() => document.querySelector("[data-question-first] button.mystic-button")?.click());
  await page.waitForSelector("[data-manual-cast-tool]:not([data-reading-sealed])", { timeout: 15_000 });

  await injectPendingWriteFailure(page);
  await page.click("[data-manual-continue]");
  await page.waitForSelector("[data-reading-sealed]", { timeout: 15_000 });
  await restorePendingWriteFailure(page);
  const readingA = await page.evaluate((key) => {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, MANUAL_KEY);
  assert(readingA?.id, "Manual sealed A must retain an authoritative method session");
  assert.equal(readingA.coreQuestionAtCast, questionA, "Manual sealed A must freeze question A");

  await page.click("[data-reading-start-new]");
  await page.waitForSelector("[data-question-first] textarea[data-private-question]", { timeout: 15_000 });
  assert.equal(await page.evaluate((key) => sessionStorage.getItem(key), MANUAL_KEY), null, "Start New must retire Manual reading A");
  assert.equal(
    await page.$eval("[data-question-first] textarea[data-private-question]", (node) => node.value),
    "",
    "Start New must not inherit A's frozen question",
  );

  await page.type("[data-question-first] textarea[data-private-question]", questionB);
  await page.evaluate(() => document.querySelector("[data-question-first] button.mystic-button")?.click());
  await page.waitForSelector("[data-manual-cast-tool]:not([data-reading-sealed])", { timeout: 15_000 });
  await new Promise((resolve) => setTimeout(resolve, 5));
  await injectPendingWriteFailure(page);
  await page.click("[data-manual-continue]");
  await page.waitForSelector("[data-reading-sealed]", { timeout: 15_000 });
  await restorePendingWriteFailure(page);

  const readingB = await page.evaluate((key) => {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, MANUAL_KEY);
  assert(readingB?.id, "Manual reading B must have a method-session identity");
  assert.notEqual(readingB.id, readingA.id, "Manual Start New must mint B.id != A.id");
  assert.notEqual(readingB.createdAt, readingA.createdAt, "Manual Start New must mint B.createdAt != A.createdAt");
  assert.equal(readingB.coreQuestionAtCast, questionB, "Manual reading B must freeze only the explicitly entered question B");
  assert.notEqual(readingB.coreQuestionAtCast, questionA, "Manual reading B must not inherit A.coreQuestionAtCast");
  log("T1 — Manual sealed Start New retires A and mints an independent B identity");
}

async function verifyYarrowSealedStartNewLifecycle(page) {
  const questionB = "What should guide the new Yarrow reading?";
  await seedMethodState(page, [
    { key: YARROW_KEY, value: methodSessionEnvelope(YARROW_ID, YARROW_QUESTION, { changes: yarrowChanges(17) }) },
  ]);
  await page.goto(`${BASE}/methods/yarrow-stalks`, { waitUntil: "networkidle0" });
  await clickResume(page);
  await page.waitForFunction(
    () => document.querySelector(".ritual-progress-badge")?.textContent?.includes("17 / 18") === true,
    { timeout: 15_000 },
  );

  await injectPendingWriteFailure(page);
  await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((node) => node.textContent?.includes("Perform change 18"));
    button?.click();
  });
  await page.waitForSelector("[data-reading-sealed-recovery]", { timeout: 15_000 });
  await restorePendingWriteFailure(page);
  const readingA = await page.evaluate((key) => {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, YARROW_KEY);
  assert.equal(readingA?.id, YARROW_ID, "Yarrow failed handoff must keep exact reading A");
  assert.equal(readingA?.coreQuestionAtCast, YARROW_QUESTION, "Yarrow reading A must keep its frozen question");

  await page.click("[data-reading-start-new]");
  await page.waitForSelector("[data-question-first] textarea[data-private-question]", { timeout: 15_000 });
  assert.equal(await page.evaluate((key) => sessionStorage.getItem(key), YARROW_KEY), null, "Yarrow Start New must retire A method session");
  assert.equal(await page.$("[data-reading-sealed-recovery]"), null, "Yarrow sealed facts must leave active method authority");
  assert.equal(
    await page.$eval("[data-question-first] textarea[data-private-question]", (node) => node.value),
    "",
    "Yarrow Start New must reset QuestionFirst frozen question",
  );

  await page.type("[data-question-first] textarea[data-private-question]", questionB);
  await page.evaluate(() => document.querySelector("[data-question-first] button.mystic-button")?.click());
  await page.waitForSelector(".ritual-progress-badge", { timeout: 15_000 });
  await new Promise((resolve) => setTimeout(resolve, 5));
  await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((node) => node.textContent?.includes("Perform change 1"));
    button?.click();
  });
  await page.waitForFunction(
    () => document.querySelector(".ritual-progress-badge")?.textContent?.includes("1 / 18") === true,
    { timeout: 15_000 },
  );
  const readingB = await page.evaluate((key) => {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, YARROW_KEY);
  assert(readingB?.id, "Yarrow reading B must have a method-session identity");
  assert.notEqual(readingB.id, readingA.id, "Yarrow Start New must mint B.id != A.id");
  assert.notEqual(readingB.createdAt, readingA.createdAt, "Yarrow Start New must mint B.createdAt != A.createdAt");
  assert.equal(readingB.coreQuestionAtCast, questionB, "Yarrow B must own the new question lifecycle");
  log("T2 — Yarrow sealed Start New resets QuestionFirst and mints an independent B identity");
}

async function clickLocaleAndWait(page, expectedPath) {
  await page.waitForSelector("body > header [data-locale-target]", { visible: true, timeout: 15_000 });
  await page.click("body > header [data-locale-target]");
  await page.waitForFunction((path) => location.pathname === path, { timeout: 20_000 }, expectedPath);
}

async function verifyActiveFlowLocaleContinuation(page) {
  // Three Coin: Home has no Resume presentation. Locale continuation still
  // preserves an actively entered 4/6 flow through the existing C9 mechanism.
  const threeCoinActive = await startFreshThreeCoin(page, 4);
  assert(threeCoinActive?.id, "Three Coin active flow must own an exact identity");
  await page.waitForSelector('body > header[data-navigation-surface="S02"]', { timeout: 15_000 });
  assert.equal(await page.$("[data-reading-resume-action]"), null, "Three Coin Home/flow must not expose the retired Resume presentation");
  await clickLocaleAndWait(page, "/zh");
  await page.waitForFunction(
    () => document.querySelector("[data-three-coin-ritual]")?.getAttribute("data-experience-stage") === "ritual",
    { timeout: 15_000 },
  );
  assert.equal(await doneLineCount(page), 4, "Three Coin locale switch must restore exact 4/6 active-flow facts");
  assert.equal(await page.$("[data-reading-resume-action]"), null, "Three Coin locale switch must not introduce a Resume UI");
  assert.equal(
    await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) || "null")?.id, THREE_COIN_KEY),
    threeCoinActive.id,
    "Three Coin locale switch must keep identity",
  );

  // Yarrow: direct reopen stays passive; explicit locale switch continues exact 8/18.
  await seedMethodState(page, [
    { key: YARROW_KEY, value: methodSessionEnvelope(YARROW_ID, YARROW_QUESTION, { changes: yarrowChanges(8) }) },
  ]);
  await page.goto(`${BASE}/methods/yarrow-stalks`, { waitUntil: "networkidle0" });
  assert(await page.$("[data-reading-resume-action]"), "Yarrow direct reopen must remain passive");
  await clickResume(page);
  await page.waitForFunction(() => document.querySelector(".ritual-progress-badge")?.textContent?.includes("8 / 18") === true, { timeout: 15_000 });
  assert.equal(await page.$eval("[data-flow-exit]", (node) => node.getAttribute("href")), "/", "Yarrow must expose explicit local Exit");
  await clickLocaleAndWait(page, "/zh/methods/yarrow-stalks");
  await page.waitForFunction(() => document.querySelector(".ritual-progress-badge")?.textContent?.includes("8 / 18") === true, { timeout: 15_000 });
  assert.equal(await page.$("[data-reading-resume-action]"), null, "Yarrow locale switch must not require a second Resume");
  assert.equal(await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) || "null")?.id, YARROW_KEY), YARROW_ID, "Yarrow locale switch must keep identity");

  // Manual: direct reopen stays passive; explicit locale switch continues exact draft.
  const manualValues = [9, 8, 7, 6, 9, 8];
  await seedMethodState(page, [
    { key: MANUAL_KEY, value: methodSessionEnvelope(MANUAL_ID, MANUAL_QUESTION) },
    {
      key: MANUAL_DRAFT_KEY,
      value: {
        schemaVersion: 1,
        questionKey: MANUAL_QUESTION,
        mode: "line-values",
        lineValuesBottomUp: manualValues,
        primaryHexagram: 1,
        changingLines: [],
      },
    },
  ]);
  await page.goto(`${BASE}/methods/manual-cast`, { waitUntil: "networkidle0" });
  assert(await page.$("[data-reading-resume-action]"), "Manual direct reopen must remain passive");
  await clickResume(page);
  await page.waitForSelector('[data-line-position="1"][data-line-value="9"][data-selected="true"]', { timeout: 15_000 });
  assert.equal(await page.$eval("[data-flow-exit]", (node) => node.getAttribute("href")), "/", "Manual must expose explicit local Exit");
  assert(await page.$("[data-question-restart]"), "Manual reversible stage must expose Back / Edit Question");
  await clickLocaleAndWait(page, "/zh/methods/manual-cast");
  await page.waitForSelector('[data-line-position="1"][data-line-value="9"][data-selected="true"]', { timeout: 15_000 });
  assert.equal(await page.$("[data-reading-resume-action]"), null, "Manual locale switch must not require a second Resume");
  assert.equal(await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) || "null")?.id, MANUAL_KEY), MANUAL_ID, "Manual locale switch must keep identity");

  // Mei Hua: a direct open remains Step 1 with Resume; explicit switch preserves Step 3 + number.
  const meiId = "2b3c4d5e-6f70-4a81-9b2c-3d4e5f607182";
  const meiQuestion = "What should I understand about this transition?";
  await seedMethodState(page, [{
    key: MEI_HUA_KEY,
    value: methodSessionEnvelope(meiId, meiQuestion, {
      mode: "number-time-draft",
      inputVersion: "mei-hua-number-time-input-v1",
      step: 3,
      number: 17,
    }),
  }]);
  await page.goto(`${BASE}/methods/mei-hua-yi-shu`, { waitUntil: "networkidle0" });
  assert.equal(await page.$eval("[data-mei-hua-flow]", (node) => node.getAttribute("data-mei-hua-step")), "1", "Mei Hua direct reopen must remain passive at Step 1");
  assert(await page.$("[data-reading-resume-action]"), "Mei Hua direct reopen must offer Resume");
  await clickResume(page);
  await page.waitForSelector('[data-mei-hua-flow][data-mei-hua-step="3"]', { timeout: 15_000 });
  await clickLocaleAndWait(page, "/zh/methods/mei-hua-yi-shu");
  await page.waitForSelector('[data-mei-hua-flow][data-mei-hua-step="3"]', { timeout: 15_000 });
  assert.equal(await page.$("[data-reading-resume-action]"), null, "Mei Hua locale switch must not require a second Resume");
  const meiState = await page.evaluate((key) => {
    const session = JSON.parse(sessionStorage.getItem(key) || "null");
    return { id: session?.id, number: session?.data?.number, step: session?.data?.step };
  }, MEI_HUA_KEY);
  assert.deepEqual(meiState, { id: meiId, number: 17, step: 3 }, "Mei Hua locale switch must keep identity, irreversible number and semantic step");

  log("T5 — explicit locale switch continues Three Coin / Yarrow / Manual / Mei Hua while direct reopen stays passive");
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
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  try {
    log(`Using ${usingSystemChrome ? "system Chrome" : "bundled Chromium"} at ${executablePath}`);
    await verifyMethodDetailIsNotASecondEntry(page);
    await verifyPartialResume(page);
    await verifyFreshCompletionNonReentry(page);
    await verifyHomeIsNotHijacked(page);
    await verifyYarrowPartialReopen(page);
    await verifyManualDraftReopen(page);
    await verifyManualSealedRecoveryKeepsQuestion(page);
    await verifyManualSealedStartNewIdentity(page);
    await verifyYarrowSealedStartNewLifecycle(page);
    await verifyActiveFlowLocaleContinuation(page);
    await verifyCrossMethodIdentity(page);
    await verifyChoiceTransitionsHaveNoGlobalLoading(page);
    const fatal = consoleErrors.filter((message) => !/favicon|Failed to load resource.*404/i.test(message));
    assert.deepEqual(fatal, [], `Unexpected browser errors: ${fatal.join(" | ")}`);
    log("PASS — reading lifecycle browser gate");
  } finally {
    await browser.close();
  }
}

await main();
