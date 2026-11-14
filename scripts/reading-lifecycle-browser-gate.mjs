import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
import { resolveChromeExecutable } from "./browser-runtime.mjs";

/**
 * Reading Lifecycle / Navigation Authority — Remediation 1 browser gate.
 *
 * Proves, in a real Chromium session:
 *   A. a stored partial cast does not auto-enter the ritual; Resume restores it exactly
 *   B. a fresh completion hands off with replace, and Browser Back cannot resurrect it
 *   C. a completed reading does not hijack the Home entry
 *   D. two completed readings keep exact identity, and a missing session fails closed
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
  assert.equal(await page.$(".hold-button"), null, "A stored 4/6 cast must not expose the cast button before Resume");
  await page.waitForSelector("[data-reading-resume-action]", { visible: true, timeout: 15_000 });
  const resumeLabel = await page.$eval("[data-reading-resume-action]", (node) => node.textContent ?? "");
  assert(resumeLabel.includes("4 / 6"), `Resume affordance must report the stored progress, received: ${resumeLabel}`);

  await clickResume(page);
  await page.waitForFunction(
    () => document.querySelector("[data-three-coin-ritual]")?.getAttribute("data-experience-stage") === "ritual",
    { timeout: 10_000 },
  );
  await page.waitForSelector(".hold-button:not(:disabled)", { timeout: 10_000 });
  assert.equal(await doneLineCount(page), 4, "Resume must restore exactly four sealed lines");
  const restored = await page.evaluate((key) => {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, THREE_COIN_KEY);
  assert.equal(restored?.id, ID_A, "Resume must preserve the exact reading id");
  assert.equal(restored?.coreQuestionAtCast, THREE_COIN_QUESTION, "Resume must preserve the frozen question");
  assert.equal(restored?.data?.steps?.length, 4, "Resume must preserve exactly four cast steps");
  log("C1 — stored 4/6 renders the default entry, Resume restores the exact 4/6 cast");
}

async function verifyFreshCompletionNonReentry(page) {
  await seed(page, { threeCoinSession: threeCoinSessionPayload(ID_A, 5) });
  await page.goto(BASE + "/", { waitUntil: "networkidle0" });
  await clickResume(page);
  await page.waitForSelector(".hold-button:not(:disabled)", { timeout: 10_000 });
  assert.equal(await doneLineCount(page), 5, "Resume must restore five sealed lines");

  await dispatchPointer(page, "pointerdown");
  await dispatchPointer(page, "pointerup");
  await page.waitForSelector("[data-record-this-cast]:not(:disabled)", { timeout: 15_000 });
  await page.click("[data-record-this-cast]");
  await page.waitForFunction(() => location.pathname === "/readings/choice", { timeout: 20_000 });
  const sessionId = await page.evaluate(() => new URLSearchParams(location.search).get("session"));
  assert(sessionId, "Fresh completion must hand off with an exact session id");
  assert.equal(sessionId, ID_A, "Fresh completion must never mint a new reading id");
  await page.waitForSelector("[data-result-choice]", { timeout: 15_000 });

  const storage = await page.evaluate(({ threeCoinKey, pendingPrefix, retired }) => ({
    session: sessionStorage.getItem(threeCoinKey),
    pending: localStorage.getItem(`${pendingPrefix}${new URLSearchParams(location.search).get("session")}`),
    singleton: sessionStorage.getItem(retired),
  }), { threeCoinKey: THREE_COIN_KEY, pendingPrefix: PENDING_PREFIX, retired: RETIRED_SINGLETON_KEY });
  assert.equal(storage.session, null, "Fresh completion must retire the exact method session");
  assert(storage.pending, "Fresh completion must persist exactly Pending[A]");
  assert.equal(JSON.parse(storage.pending).readingId, ID_A, "Pending must be keyed by the exact reading id");
  assert.equal(storage.singleton, null, "The retired completed-reading singleton must not be written");

  await page.goBack({ waitUntil: "networkidle0" });
  await new Promise((resolve) => setTimeout(resolve, 1200));
  assert.equal(await page.$(".hold-button"), null, "Browser Back must not resurrect the completed casting screen");
  assert.equal(await page.$("[data-ritual-question-context]"), null, "Browser Back must not restore an active cast step");
  assert.equal(await page.$("[data-completed-cast]"), null, "Browser Back must not restore a terminal casting screen");
  log("C2/C7 — fresh completion writes Pending[A], retires the session, replaces into Choice; Back cannot re-enter casting");
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
    await verifyCrossMethodIdentity(page);
    const fatal = consoleErrors.filter((message) => !/favicon|Failed to load resource.*404/i.test(message));
    assert.deepEqual(fatal, [], `Unexpected browser errors: ${fatal.join(" | ")}`);
    log("PASS — reading lifecycle browser gate");
  } finally {
    await browser.close();
  }
}

await main();
