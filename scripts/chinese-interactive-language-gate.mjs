import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { resolveChromeExecutable } from "./browser-runtime.mjs";

const BASE = process.env.CHINESE_INTERACTIVE_GATE_BASE_URL || process.env.PUBLIC_V1_TEST_BASE_URL || "http://127.0.0.1:3000";

const ALLOWED_LATIN = [
  "Quick I Ching",
  "QuickIChing",
  "Google Analytics",
  "Analytics",
  "Microsoft Clarity",
  "Clarity",
  "Google",
  "Microsoft",
  "Waffo",
  "IANA",
  "Vercel AI Gateway",
  "localStorage",
  "sessionStorage",
  "Unicode",
  "Wikisource",
  "UTC",
  "URL",
  "API",
  "JSON",
  "AI",
  "ID",
  "HTTP",
  "HTTPS",
  "Cookie",
  "Cookies",
  "SVG",
  "DOM",
  "IP",
  "SSL",
  "TLS",
  "DNS",
  "HTML",
  "CSS",
  "SDK",
];

function log(message) {
  console.log(`[Chinese Interactive Language Gate] ${message}`);
}

function normalize(value) {
  return String(value ?? "").normalize("NFKC");
}

function stripAllowedLatin(value) {
  let text = normalize(value);
  text = text.replace(/https?:\/\/\S+/giu, " ");
  text = text.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gu, " ");
  text = text.replace(/\b[A-Za-z]+(?:\/[A-Za-z_]+)+\b/gu, " ");
  // 注意：已彻底移除任何版本号正则豁免（如 -v1 等）！
  text = text.replace(/\bQuick\s*I\s*Ching\b/giu, " ").replace(/\bQuickIChing\b/giu, " ");
  for (const allowed of [...ALLOWED_LATIN].sort((a, b) => b.length - a.length)) {
    text = text.split(allowed).join(" ");
  }
  return text;
}

function findLatinContamination(text) {
  const cleaned = stripAllowedLatin(text);
  const matches = cleaned.match(/\p{Script=Latin}[\p{Script=Latin}\p{M}'’\-]*/gu) ?? [];
  const words = matches.filter((word) => [...word].length >= 2);
  return [...new Set(words)];
}

async function extractAuditableEntries(page) {
  return page.evaluate(() => {
    const entries = [];

    // 1. 可见文本（过滤 script, style, noscript, template, [hidden], [aria-hidden='true']）
    const clone = document.body.cloneNode(true);
    if (clone instanceof HTMLElement) {
      clone.querySelectorAll("script, style, noscript, template, [hidden], [aria-hidden='true'], [data-language-switcher]").forEach((node) => node.remove());
      const visible = (clone.innerText || clone.textContent || "")
        .replace(/\r\n/g, "\n")
        .replace(/\u00a0/g, " ")
        .trim();
      entries.push({ source: "textContent", selector: "body", text: visible });
    }

    // 2. 交互与无障碍属性（aria-label, aria-description, title, alt, placeholder）
    const elements = document.querySelectorAll("*");
    const attrs = ["aria-label", "aria-description", "title", "alt", "placeholder"];
    elements.forEach((el) => {
      if (el.closest("script, style, noscript, template, [hidden], [aria-hidden='true'], [data-language-switcher]")) return;
      for (const attr of attrs) {
        const val = el.getAttribute(attr);
        if (val && val.trim()) {
          const selector = el.tagName.toLowerCase() + (el.id ? `#${el.id}` : el.className ? `.${String(el.className).split(" ")[0]}` : "");
          entries.push({ source: attr, selector, text: val.trim() });
        }
      }
    });

    return entries;
  });
}

async function assertPurity(page, contextLabel) {
  const pageUrl = page.url();
  const entries = await extractAuditableEntries(page);
  const violations = [];

  for (const entry of entries) {
    const words = findLatinContamination(entry.text);
    for (const word of words) {
      const idx = entry.text.indexOf(word);
      const start = Math.max(0, idx - 25);
      const end = Math.min(entry.text.length, idx + word.length + 25);
      const snippet = entry.text.slice(start, end).replace(/\s+/g, " ");
      violations.push({
        path: pageUrl,
        state: contextLabel,
        source: entry.source,
        selector: entry.selector,
        word,
        context: snippet,
      });
    }
  }

  if (violations.length > 0) {
    console.error(`\n❌ Purity violation detected in [${contextLabel}] on ${pageUrl}:`);
    console.table(violations);
    assert.fail(
      `${contextLabel}: Found ${violations.length} unauthorized Latin words: [${violations.map((v) => v.word).join(", ")}]`,
    );
  }
}

async function seedCompletedReading(page, { id, method }) {
  const createdAt = new Date().toISOString();
  const lineValuesBottomUp = [7, 7, 7, 7, 7, 7];
  const steps = lineValuesBottomUp.map((lineValue, lineIndex) => ({
    lineIndex,
    lineValue,
    coinFaces: ["yin", "yin", "yang"],
    algorithmVersion: "three-coin-v1",
  }));

  let methodVersion;
  let evidence;
  if (method === "three-coin") {
    methodVersion = "three-coin-v1";
    evidence = { kind: "three-coin", steps };
  } else if (method === "yarrow-stalks") {
    methodVersion = "yarrow-zhu-xi-digital-v2";
    evidence = {
      kind: "yarrow-stalks",
      lines: lineValuesBottomUp.map((lineValue, lineIndex) => ({
        lineIndex,
        lineValue,
        changes: [],
      })),
    };
  } else if (method === "mei-hua-yi-shu") {
    methodVersion = "mei-hua-number-moment-classical-v1";
    evidence = {
      kind: "mei-hua-yi-shu",
      calculation: {
        algorithmVersion: methodVersion,
        lineValuesBottomUp,
        methodCalculation: {
          kind: "mei-hua-number-time",
          number: 29,
          utcMillis: Date.UTC(2026, 9, 31, 12, 0, 0),
          ianaTimeZone: "UTC",
        },
      },
    };
  } else {
    throw new Error(`Unsupported fixture method: ${method}`);
  }

  await page.evaluate((reading) => {
    sessionStorage.setItem("quickiching:public-v1:completed-reading", JSON.stringify(reading));
  }, {
    schemaVersion: 1,
    id,
    createdAt,
    method,
    methodVersion,
    question: "我现在是否适合换一份工作？",
    lineValuesBottomUp,
    evidence,
  });
}

async function main() {
  const { executablePath, usingSystemChrome } = await resolveChromeExecutable(chromium);
  log(`Launching Chromium at ${executablePath}${usingSystemChrome ? " (system runner)" : " (serverless fallback)"}`);

  const browser = await puppeteer.launch({
    args: usingSystemChrome ? ["--no-sandbox", "--disable-dev-shm-usage"] : [...chromium.args, "--disable-dev-shm-usage"],
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    let mockUser = {
      user: { id: "usr_gate", email: "1@quickiching.com" },
    };

    let checkoutInterceptorMode = "pass";

    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const url = new URL(req.url());
      if (url.pathname.includes("/api/user/me")) {
        req.respond({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockUser),
        });
        return;
      }

      if (url.pathname.includes("/api/checkout") && req.method() === "POST") {
        if (checkoutInterceptorMode === "401") {
          req.respond({
            status: 401,
            contentType: "application/json",
            body: JSON.stringify({ error: "UNAUTHORIZED" }),
          });
          return;
        }
        if (checkoutInterceptorMode === "409") {
          req.respond({
            status: 409,
            contentType: "application/json",
            body: JSON.stringify({ error: "CHECKOUT_CONCURRENT_TRANSACTION" }),
          });
          return;
        }
        if (checkoutInterceptorMode === "429") {
          req.respond({
            status: 429,
            contentType: "application/json",
            body: JSON.stringify({ error: "RATE_LIMIT_EXCEEDED" }),
          });
          return;
        }
        if (checkoutInterceptorMode === "503") {
          req.respond({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ error: "SERVICE_UNAVAILABLE" }),
          });
          return;
        }
        if (checkoutInterceptorMode === "network_error") {
          req.abort("failed");
          return;
        }
        if (checkoutInterceptorMode === "invalid_url") {
          req.respond({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ orderId: "ord_gate_invalid", checkoutUrl: "http://insecure-domain.com/pay" }),
          });
          return;
        }
      }

      req.continue();
    });

    // =========================================================================
    // Test 1: Desktop User Menu Navigation & Localized Href Contract
    // =========================================================================
    log("Test 1: Desktop User Menu & Navigation -> checking My Readings / My Account / Settings parity");
    await page.goto(`${BASE}/zh`, { waitUntil: "networkidle0" });

    // Verify all header navigation links retain /zh prefix
    const navHrefs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("header nav a[href]"))
        .map((a) => a.getAttribute("href"))
        .filter((href) => href && !href.startsWith("http") && !href.startsWith("#"));
    });
    for (const href of navHrefs) {
      if (href === "/" || href.startsWith("/?")) continue; // Language switcher to English
      assert(href.startsWith("/zh"), `Header navigation on /zh contains non-zh link: ${href}`);
    }

    const userMenuButton = await page.$('[data-user-nav-menu-button]');
    if (userMenuButton) {
      await userMenuButton.click();
      const menuLinks = await page.evaluate(() => {
        const btn = document.querySelector('[data-user-nav-menu-button]');
        const menu = btn?.parentElement?.querySelector('[role="menu"]');
        if (!menu) return [];
        const items = Array.from(menu.querySelectorAll("a, button"));
        return items.map((el) => ({
          text: el.textContent?.trim() || "",
          href: el.getAttribute("href") || "",
        }));
      });

      assert.equal(menuLinks.length, 3, `Desktop user menu must expose exactly 3 formal entries, got: ${menuLinks.length}`);

      const readingsLink = menuLinks.find((l) => l.text.includes("我的解读"));
      assert(readingsLink, "Dropdown menu must contain '我的解读'");
      assert.equal(
        readingsLink.href,
        "/zh/my-readings",
        `Desktop user menu '我的解读' MUST link to '/zh/my-readings', got: ${readingsLink.href}`,
      );

      const accountItem = menuLinks.find((l) => l.text.includes("我的账户"));
      assert(accountItem, "Dropdown menu must contain '我的账户'");
      assert.equal(accountItem.href, "", "'我的账户' must open the Account modal instead of a second page link");

      const settingsItem = menuLinks.find((l) => l.text.includes("设置"));
      assert(settingsItem, "Dropdown menu must contain '设置'");
      assert.equal(settingsItem.href, "", "'设置' must open the Settings modal instead of a standalone page link");

      await assertPurity(page, "Desktop Authenticated User Menu Dropdown");
      log("Test 1 PASS: User menu exposes only 我的解读 / 我的账户 / 设置 with 100% Chinese purity.");
    } else {
      log("Test 1 NOTE: Auth capability is closed in current server env; UserNavControl parity verified via unit tests and header nav checked.");
    }

    // Turn off mock user for unauthenticated checks
    mockUser = { user: null };

    // =========================================================================
    // Test 3: Unauthenticated /zh/account Redirect Route Guard
    // =========================================================================
    log("Test 3: /zh/account auth guard -> redirect when Auth is open, 410 when capability is closed");
    const accountResponse = await page.goto(`${BASE}/zh/account`, { waitUntil: "networkidle0" });
    const finalUrl = page.url();
    if (finalUrl.includes("/zh/signin")) {
      assert(
        finalUrl.includes("callbackURL=%2Fzh%2Faccount"),
        `Callback URL must preserve /zh/account, got: ${finalUrl}`,
      );
      log("Test 3 PASS: Unauthenticated account access correctly redirects to /zh/signin.");
    } else {
      assert.equal(
        accountResponse?.status(),
        410,
        `Closed Auth capability must return 410 for /zh/account, got status ${accountResponse?.status()} at ${finalUrl}`,
      );
      assert(
        finalUrl.includes("/zh/account"),
        `Closed Auth capability must keep the localized account URL, got: ${finalUrl}`,
      );
      log("Test 3 PASS: Closed Auth capability blocks /zh/account with the same 410 boundary as /account.");
    }

    // =========================================================================
    // Test 4: Pricing Failure Presentation & Real API Interception
    // =========================================================================
    log("Test 4: Pricing Page (/zh/pricing) Real Failure Interceptions & DOM Assertions");

    // 4.0 Static View Purity (both unenabled default and preview mode)
    await page.goto(`${BASE}/zh/pricing`, { waitUntil: "networkidle0" });
    const defaultCheckoutBtn = await page.$('button[data-checkout-button="true"]');
    assert(!defaultCheckoutBtn, "Default /zh/pricing must not render PurchaseButton when commercial capability is closed");
    await assertPurity(page, "Pricing Page Static Unenabled View");

    await page.goto(`${BASE}/zh/pricing?preview=1&returnUrl=%2Fzh%2Freadings%2Fgate-test`, { waitUntil: "networkidle0" });
    await assertPurity(page, "Pricing Page Static Preview View");

    // 4.a: 401 Unauthenticated redirect via real PurchaseButton click & real navigation
    checkoutInterceptorMode = "401";
    await page.goto(`${BASE}/zh/pricing?preview=1&returnUrl=%2Fzh%2Freadings%2Fgate-test`, { waitUntil: "networkidle0" });
    const authBtn = await page.waitForSelector('button[data-checkout-button="true"]', { timeout: 5000 });
    assert(authBtn, "PurchaseButton with data-checkout-button='true' not found in preview mode");
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0" }),
      authBtn.click(),
    ]);
    const redirectUrl = page.url();
    assert(redirectUrl.includes("/zh/signin"), `401 redirect URL must lead to /zh/signin, got: ${redirectUrl}`);
    assert(redirectUrl.includes("callbackURL="), `401 redirect URL missing callbackURL: ${redirectUrl}`);
    const decodedUrl = decodeURIComponent(decodeURIComponent(redirectUrl));
    assert(decodedUrl.includes("/zh/pricing"), `401 redirect callbackURL must retain /zh/pricing, got: ${decodedUrl}`);
    assert(decodedUrl.includes("/zh/readings/gate-test"), `401 redirect callbackURL must retain Chinese reading returnUrl, got: ${decodedUrl}`);
    await assertPurity(page, "Pricing 401 Redirect Signin View");
    log("Pricing real button click PASS: 401 unauthenticated redirect");

    async function testRealButtonCheckoutFailure(mode, expectedSnippet, passLog) {
      checkoutInterceptorMode = mode;
      await page.goto(`${BASE}/zh/pricing?preview=1&returnUrl=%2Fzh%2Freadings%2Fgate-test`, { waitUntil: "networkidle0" });
      const purchaseBtn = await page.waitForSelector('button[data-checkout-button="true"]', { timeout: 5000 });
      assert(purchaseBtn, "PurchaseButton with data-checkout-button='true' not found in preview mode");

      await purchaseBtn.click();

      const errorEl = await page.waitForSelector('p[data-checkout-error="true"][role="alert"]', { timeout: 5000 });
      assert(errorEl, `Expected p[data-checkout-error="true"][role="alert"] to appear for mode ${mode}`);

      const errorText = await errorEl.evaluate((el) => el.textContent?.trim() || "");
      assert(
        errorText.includes(expectedSnippet),
        `Expected error text to include '${expectedSnippet}', but got: '${errorText}' (mode: ${mode})`,
      );

      await assertPurity(page, `Pricing Real Button Checkout Failure: ${mode}`);
      log(passLog);
    }

    // 4.b: 409 Concurrent transaction
    await testRealButtonCheckoutFailure("409", "当前支付正在处理中", "Pricing real button click PASS: 409 concurrent checkout");

    // 4.c: 429 Rate limit
    await testRealButtonCheckoutFailure("429", "尝试支付过于频繁", "Pricing real button click PASS: 429 rate limit");

    // 4.d: 503 Service unavailable
    await testRealButtonCheckoutFailure("503", "暂时无法发起支付", "Pricing real button click PASS: 503 service unavailable");

    // 4.e: Network failure
    await testRealButtonCheckoutFailure("network_error", "暂时无法发起支付", "Pricing real button click PASS: network failure");

    // 4.f: Invalid Checkout URL (insecure scheme)
    await testRealButtonCheckoutFailure("invalid_url", "暂时无法发起支付", "Pricing real button click PASS: invalid checkout URL");

    // Reset checkout mode
    checkoutInterceptorMode = "pass";

    // =========================================================================
    // Test 5: Four Casting Methods Interactive Result Generation & Purity
    // =========================================================================
    log("Test 5: Four Casting Methods -> current result handoff, auth gate, and unified manual result");


    // 5.a-5.c: Current shared Reading auth gate for the three persisted casting methods.
    // Use the canonical completed-reading seam instead of retired per-method result-route recovery.
    for (const fixture of [
      { label: "Three-Coin", method: "three-coin", id: "550e8400-e29b-41d4-a716-446655440101" },
      { label: "Yarrow Stalk", method: "yarrow-stalks", id: "550e8400-e29b-41d4-a716-446655440102" },
      { label: "Mei Hua Yi Shu", method: "mei-hua-yi-shu", id: "550e8400-e29b-41d4-a716-446655440103" },
    ]) {
      await page.goto(`${BASE}/zh`, { waitUntil: "networkidle0" });
      await page.evaluate(() => sessionStorage.clear());
      await seedCompletedReading(page, fixture);
      await page.goto(`${BASE}/zh/readings/result?session=${fixture.id}`, { waitUntil: "networkidle0" });
      await page.waitForSelector("[data-completed-cast-gate='auth-required']", { timeout: 10_000 });
      assert.equal(await page.$("[data-public-reading-result]"), null, `Unsigned ${fixture.label} result must stay behind the current save/auth gate`);
      await assertPurity(page, `${fixture.label} Current Result Auth Gate`);
      log(`Method simulation PASS: ${fixture.method} canonical completed-reading auth gate`);
    }

    // 5.d: Manual Cast (/zh/methods/manual-cast)
    await page.goto(`${BASE}/zh/methods/manual-cast`, { waitUntil: "networkidle0" });
    await page.evaluate(() => {
      sessionStorage.setItem("quickiching:public-v1:manual-cast", JSON.stringify({
        schemaVersion: 1,
        started: true,
        id: "550e8400-e29b-41d4-a716-446655440104",
        createdAt: new Date().toISOString(),
        data: {},
      }));
    });
    await page.reload({ waitUntil: "networkidle0" });
    const castManualBtn = await page.waitForSelector("section[aria-labelledby='manual-cast-tool-title'] button:not([role='tab']).mystic-button", { timeout: 5000 });
    await castManualBtn.click();
    await page.waitForSelector("[data-public-reading-result]:not([data-reading-localization-loading]) [data-free-reading-ritual]", { timeout: 5000 });
    const manualMethod = await page.$eval("[data-free-reading-ritual]", (el) => el.getAttribute("data-reading-method"));
    assert.equal(manualMethod, "manual", `Manual cast result method mismatch: ${manualMethod}`);
    await assertPurity(page, "Manual Cast Complete Reading View");
    log("Method simulation PASS: manual-cast complete reading");

    // =========================================================================
    // Test 6: Result Route (/zh/readings/three-coin/result) States
    // =========================================================================
    log("Test 6: Three-Coin Result Route (/zh/readings/three-coin/result) -> empty, ready, and error states");

    // 6.a: Empty state
    await page.goto(`${BASE}/zh/methods/three-coin`, { waitUntil: "networkidle0" });
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
    await page.goto(`${BASE}/zh/readings/three-coin/result`, { waitUntil: "networkidle0" });
    await page.waitForSelector("h1#empty-reading-title", { timeout: 5000 });
    const emptyResultText = await page.evaluate(() => document.body.innerText || "");
    assert(emptyResultText.includes("没有找到已完成的起卦"), "Result empty state missing Chinese heading");
    const emptyCtaHref = await page.$eval("a[class*='newReadingButton']", (el) => el.getAttribute("href"));
    assert.equal(emptyCtaHref, "/zh/methods/three-coin", `Empty state CTA must point to /zh/methods/three-coin, got: ${emptyCtaHref}`);
    await assertPurity(page, "Three-Coin Result Page Empty State");
    log("Three-coin result PASS: empty state");

    // 6.b: Completed cast / auth-before-reveal state on the canonical shared Reading route
    await page.goto(`${BASE}/zh`, { waitUntil: "networkidle0" });
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
    const completedThreeCoinId = "550e8400-e29b-41d4-a716-446655440105";
    await seedCompletedReading(page, { id: completedThreeCoinId, method: "three-coin" });
    await page.goto(`${BASE}/zh/readings/result?session=${completedThreeCoinId}`, { waitUntil: "networkidle0" });
    await page.waitForSelector("[data-completed-cast-gate='auth-required']", { timeout: 5000 });
    const completedState = await page.evaluate(() => ({
      heading: document.querySelector("h1")?.textContent?.trim() ?? "",
      completionCopy: document.querySelector(".ritual-gate-complete")?.textContent?.trim() ?? "",
      authGate: document.querySelector("[data-auth-required-before-reveal]") !== null,
      sixLines: document.querySelector("[data-completed-six-lines]") !== null,
      primaryCard: document.querySelector("[data-primary-card]") !== null,
      deepEntry: document.querySelector("[data-deep-reading-entry]") !== null,
    }));
    assert.equal(completedState.heading, "保存本次起卦", `Completed-cast heading mismatch: ${completedState.heading}`);
    assert.equal(completedState.completionCopy, "六爻已经完成", "The formal gate must confirm six-line completion");
    assert(completedState.authGate, "Completed Chinese Three-Coin cast must require sign-in before reveal");
    assert(completedState.sixLines, "Completed Chinese Three-Coin cast must preserve all six lines");
    assert.equal(completedState.primaryCard, false, "Primary result must remain hidden before sign-in and account persistence");
    assert.equal(completedState.deepEntry, false, "Deep Reading must remain hidden before result reveal");
    await assertPurity(page, "Three-Coin Completed Cast Auth Gate");
    log("Three-coin result PASS: canonical completed cast auth-before-reveal state");

    // 6.c: Error state (in isolated test tab)
    const errPage = await browser.newPage();
    try {
      await errPage.evaluateOnNewDocument(() => {
        Object.defineProperty(window, "sessionStorage", {
          get() {
            throw new Error("PUBLIC_READING_SESSION_UNAVAILABLE");
          },
        });
      });
      await errPage.goto(`${BASE}/zh/readings/three-coin/result`, { waitUntil: "networkidle0" });
      await errPage.waitForSelector("h1#reading-error-title", { timeout: 5000 });
      const errorResultText = await errPage.evaluate(() => document.body.innerText || "");
      assert(errorResultText.includes("无法恢复这次已落定的起卦结果"), "Result error state missing Chinese heading");
      const errorCtaHref = await errPage.$eval("a[class*='newReadingButton']", (el) => el.getAttribute("href"));
      assert.equal(errorCtaHref, "/zh/methods/three-coin", `Error state CTA must point to /zh/methods/three-coin, got: ${errorCtaHref}`);
      await assertPurity(errPage, "Three-Coin Result Page Error State");
      log("Three-coin result PASS: error state");
    } finally {
      await errPage.close();
    }

    // =========================================================================
    // Test 7: Full Chinese Interactive Inventory Purity Audit (16 Pages)
    // =========================================================================
    log("Test 7: Full-site Chinese interactive page language and accessibility purity scan");
    const pathsToAudit = [
      "/zh",
      "/zh/methods/three-coin",
      "/zh/methods/yarrow-stalks",
      "/zh/methods/mei-hua-yi-shu",
      "/zh/methods/manual-cast",
      "/zh/guides/how-to-ask-the-i-ching",
      "/zh/guides/changing-lines",
      "/zh/guides/primary-relating-hexagrams",
      "/zh/hexagrams",
      "/zh/pricing",
      "/zh/privacy",
      "/zh/terms",
      "/zh/help",
      "/zh/acceptable-use",
      "/zh/signin",
      "/zh/signup",
    ];

    for (const path of pathsToAudit) {
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0" });
      await assertPurity(page, `Full Audit: ${path}`);
    }
    log(`Test 7 PASS: All ${pathsToAudit.length} Chinese pages passed purity audit with 0 unauthorized Latin words.`);

  } finally {
    await browser.close();
  }

  log("ALL CHINESE INTERACTIVE LANGUAGE GATES PASSED CLEANLY.");
}

await main();
