import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { resolveChromeExecutable } from "./browser-runtime.mjs";

const BASE = process.env.PUBLIC_V1_TEST_BASE_URL || "http://127.0.0.1:3000";
const OUTPUT_DIR = "outputs/navigation-audit";

function log(message) {
  console.log(`[Navigation Audit Gate] ${message}`);
}

async function assertNoOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert(dimensions.scrollWidth <= dimensions.clientWidth + 1, `${label}: horizontal overflow ${dimensions.scrollWidth} > ${dimensions.clientWidth}`);
}

async function assertAriaUniqueness(page, label) {
  const issues = await page.evaluate(() => {
    const references = [];
    document.querySelectorAll("[aria-controls]").forEach((node) => {
      const controls = (node.getAttribute("aria-controls") || "").split(/\s+/).filter(Boolean);
      references.push(...controls);
    });
    document.querySelectorAll("[aria-labelledby]").forEach((node) => {
      const labelled = (node.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean);
      references.push(...labelled);
    });

    const result = [];
    const idCounts = new Map();
    document.querySelectorAll("[id]").forEach((node) => {
      const id = node.id;
      if (!id) return;
      idCounts.set(id, (idCounts.get(id) || 0) + 1);
    });
    for (const [id, count] of idCounts) {
      if (count !== 1) result.push({ type: "duplicate-id", id, count });
    }

    for (const id of new Set(references)) {
      const count = document.querySelectorAll(`#${CSS.escape(id)}`).length;
      if (count !== 1) {
        result.push({ type: "aria-reference", id, count });
      }
    }
    return result;
  });

  assert.deepEqual(issues, [], `${label}: duplicate IDs or invalid ARIA references: ${JSON.stringify(issues)}`);
}

async function assertBrandCount(page, label) {
  const counts = await page.evaluate(() => {
    const header = document.querySelector("header");
    const footer = document.querySelector("footer");

    function countMatches(str, term) {
      if (!str) return 0;
      const regex = new RegExp(term, "gi");
      return (str.match(regex) || []).length;
    }

    const headerText = header?.innerText || "";
    const footerText = footer?.innerText || "";
    return {
      headerMatches: countMatches(headerText, "Quick I Ching"),
      footerMatches: countMatches(footerText, "Quick I Ching"),
    };
  });

  assert.equal(counts.headerMatches, 1, `${label}: visible brand in Header must be exactly 1, got ${counts.headerMatches}`);
  assert.equal(counts.footerMatches, 1, `${label}: visible brand in Footer must be exactly 1, got ${counts.footerMatches}`);
  return counts;
}

async function waitForExpanded(page, triggerId, expanded) {
  await page.waitForFunction(
    (id, expected) => document.getElementById(id)?.getAttribute("aria-expanded") === String(expected),
    { timeout: 3000 },
    triggerId,
    expanded,
  );
}

async function activeElementSnapshot(page) {
  return page.evaluate(() => ({
    id: document.activeElement?.id || "",
    text: document.activeElement?.textContent?.trim() || "",
    role: document.activeElement?.getAttribute("role") || "",
  }));
}

async function verifyDesktopMenu(page, label, selector, expectedItems) {
  const trigger = await page.$(selector);
  assert(trigger, `${label}: required menu trigger missing: ${selector}`);
  const triggerId = await page.evaluate((node) => node.id, trigger);
  const menuId = await page.evaluate((node) => node.getAttribute("aria-controls"), trigger);
  assert(menuId, `${label}: menu trigger lacks aria-controls: ${selector}`);

  await trigger.focus();
  await page.keyboard.press("Enter");
  await waitForExpanded(page, triggerId, true);
  await page.waitForFunction((id) => document.activeElement?.closest(`#${CSS.escape(id)}`) !== null, { timeout: 3000 }, menuId);
  const itemCount = await page.$$eval(`#${menuId} [role^="menuitem"]`, (items) => items.length);
  assert.equal(itemCount, expectedItems, `${label}: unexpected item count for ${selector}`);

  const first = await activeElementSnapshot(page);
  await page.keyboard.press("ArrowDown");
  const second = await activeElementSnapshot(page);
  assert.notEqual(second.text, first.text, `${label}: ArrowDown did not move focus for ${selector}`);
  await page.keyboard.press("ArrowUp");
  assert.equal((await activeElementSnapshot(page)).text, first.text, `${label}: ArrowUp did not restore focus for ${selector}`);
  await page.keyboard.press("Escape");
  await waitForExpanded(page, triggerId, false);
  assert.equal((await activeElementSnapshot(page)).id, triggerId, `${label}: Escape did not return focus for ${selector}`);

  await trigger.focus();
  await page.keyboard.press(" ");
  await waitForExpanded(page, triggerId, true);
  await page.keyboard.press("Escape");
  await waitForExpanded(page, triggerId, false);

  await trigger.focus();
  await page.keyboard.press("ArrowUp");
  await waitForExpanded(page, triggerId, true);
  await page.waitForFunction((id) => document.activeElement?.closest(`#${CSS.escape(id)}`) !== null, { timeout: 3000 }, menuId);
  const last = await activeElementSnapshot(page);
  await page.keyboard.press("ArrowDown");
  assert.equal((await activeElementSnapshot(page)).text, first.text, `${label}: last-to-first focus loop failed for ${selector}`);
  assert.notEqual(last.text, first.text, `${label}: ArrowUp did not open on the last item for ${selector}`);
  await page.keyboard.press("Escape");

  await trigger.click();
  await waitForExpanded(page, triggerId, true);
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction((id) => document.activeElement?.closest(`#${CSS.escape(id)}`) !== null, { timeout: 3000 }, menuId);
  await page.evaluate(() => document.querySelector("main")?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })));
  await waitForExpanded(page, triggerId, false);
}

async function verifyDesktopDropdowns(page, label) {
  await verifyDesktopMenu(page, label, 'header button[aria-controls^="methods-menu-"]', 4);
  await verifyDesktopMenu(page, label, 'header button[aria-controls^="guides-menu-"]', 3);
  await verifyDesktopMenu(page, label, 'header [data-language-switcher] button[aria-haspopup="menu"]', 2);
}

async function visibleFocusableSnapshots(page) {
  return page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    if (!dialog) return [];
    const selector = 'a[href]:not([tabindex="-1"]), button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(dialog.querySelectorAll(selector))
      .filter((node) => {
        const style = getComputedStyle(node);
        return style.display !== "none" && style.visibility !== "hidden" && node.getClientRects().length > 0;
      })
      .map((node) => ({ id: node.id || "", text: node.textContent?.trim() || "", ariaLabel: node.getAttribute("aria-label") || "" }));
  });
}

async function openMobileDrawer(page, label) {
  const hamburger = await page.$('header button[aria-controls^="nav-drawer-"]');
  assert(hamburger, `${label}: mobile hamburger button missing`);
  const hamburgerId = await page.evaluate((el) => el.id, hamburger);

  await hamburger.click();
  await page.waitForSelector('[role="dialog"][aria-modal="true"]', { timeout: 5000 });
  return { hamburger, hamburgerId };
}

async function verifyMobileDrawer(page, label, screenshotPath) {
  const originalOverflow = await page.evaluate(() => {
    document.body.style.overflow = "clip";
    return document.body.style.overflow;
  });
  const { hamburgerId } = await openMobileDrawer(page, label);

  const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
  assert.equal(bodyOverflow, "hidden", `${label}: body scroll not locked when drawer is open`);

  await page.waitForFunction(() => {
    const labelText = document.activeElement?.getAttribute("aria-label") || "";
    return labelText.includes("Close") || labelText.includes("关闭");
  }, { timeout: 3000 });

  const geometry = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const backdrop = document.querySelector("[data-drawer-backdrop]");
    const dialogRect = dialog?.getBoundingClientRect();
    const backdropRect = backdrop?.getBoundingClientRect();
    const centerHit = document.elementFromPoint(innerWidth / 2, innerHeight * 0.75);
    return {
      viewport: { width: innerWidth, height: innerHeight },
      dialog: dialogRect ? { top: dialogRect.top, bottom: dialogRect.bottom, height: dialogRect.height } : null,
      backdrop: backdropRect ? { top: backdropRect.top, left: backdropRect.left, width: backdropRect.width, height: backdropRect.height } : null,
      centerCovered: Boolean(centerHit?.closest("[data-drawer-backdrop], [role=dialog]")),
      backdropExposed: Boolean(document.elementFromPoint(8, innerHeight / 2)?.closest("[data-drawer-backdrop]")),
      visibleLinks: Array.from(dialog?.querySelectorAll("nav a") || []).filter((node) => node.getClientRects().length > 0).length,
      oversizedLinks: Array.from(dialog?.querySelectorAll("nav a") || [])
        .filter((node) => node.getClientRects().length > 0 && node.getBoundingClientRect().height > 52)
        .map((node) => ({ text: node.textContent?.trim() || "", height: node.getBoundingClientRect().height })),
      dialogText: dialog?.textContent || "",
    };
  });
  assert(geometry.dialog, `${label}: dialog geometry unavailable`);
  assert.equal(geometry.dialog.top, 0, `${label}: dialog does not start at viewport top`);
  assert.equal(geometry.dialog.height, geometry.viewport.height, `${label}: dialog height does not cover viewport`);
  assert(geometry.backdrop, `${label}: backdrop missing`);
  assert.deepEqual(geometry.backdrop, { top: 0, left: 0, width: geometry.viewport.width, height: geometry.viewport.height }, `${label}: backdrop does not cover viewport`);
  assert(geometry.centerCovered, `${label}: page remains pointer-accessible behind drawer`);
  assert(geometry.backdropExposed, `${label}: no exposed backdrop area is available for pointer dismissal`);
  assert(geometry.visibleLinks > 0, `${label}: drawer navigation links are not visible`);
  assert.deepEqual(geometry.oversizedLinks, [], `${label}: drawer links wrap or exceed the expected touch-target height: ${JSON.stringify(geometry.oversizedLinks)}`);
  if (label.includes("/zh")) {
    assert(!/\bMenu\b|\bLanguage\b/.test(geometry.dialogText), `${label}: Chinese drawer contains hard-coded English UI labels`);
  }

  await assertAriaUniqueness(page, `${label} open drawer`);
  if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: false });

  const focusables = await visibleFocusableSnapshots(page);
  assert(focusables.length >= 2, `${label}: drawer needs at least two visible focusable elements`);
  await page.keyboard.down("Shift");
  await page.keyboard.press("Tab");
  await page.keyboard.up("Shift");
  const afterShiftTab = await activeElementSnapshot(page);
  const last = focusables.at(-1);
  assert(last, `${label}: last focusable missing`);
  assert(afterShiftTab.id === last.id || afterShiftTab.text === last.text, `${label}: Shift+Tab did not wrap to the final visible control`);

  await page.keyboard.press("Tab");
  const afterTab = await activeElementSnapshot(page);
  const first = focusables[0];
  assert(afterTab.id === first.id || afterTab.text === first.text, `${label}: Tab did not wrap to the first visible control`);

  const languageTrigger = await page.$('[role="dialog"] [data-language-switcher] button[aria-haspopup="menu"]');
  assert(languageTrigger, `${label}: drawer language trigger missing`);
  await languageTrigger.click();
  const languageMenu = await page.$eval('[role="dialog"] [data-language-switcher] [role="menu"]', (node) => {
    const rect = node.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height, viewportWidth: innerWidth, viewportHeight: innerHeight };
  });
  assert(languageMenu.top >= 0 && languageMenu.bottom <= languageMenu.viewportHeight, `${label}: language menu escapes the vertical viewport: ${JSON.stringify(languageMenu)}`);
  assert(languageMenu.left >= 0 && languageMenu.right <= languageMenu.viewportWidth, `${label}: language menu escapes the horizontal viewport: ${JSON.stringify(languageMenu)}`);
  await languageTrigger.click();
  await page.waitForFunction(() => document.querySelector('[role="dialog"] [data-language-switcher] button[aria-haspopup="menu"]')?.getAttribute("aria-expanded") === "false", { timeout: 3000 });

  for (const direction of ["forward", "backward"]) {
    for (const itemIndex of [0, 1]) {
      await languageTrigger.click();
      await page.waitForFunction(() => document.querySelector('[role="dialog"] [data-language-switcher] button[aria-haspopup="menu"]')?.getAttribute("aria-expanded") === "true", { timeout: 3000 });
      await page.focus(`[role="dialog"] [data-language-switcher] [role="menu"] [role="menuitemradio"]:nth-child(${itemIndex + 1})`);
      if (direction === "backward") {
        await page.keyboard.down("Shift");
      }
      await page.keyboard.press("Tab");
      if (direction === "backward") {
        await page.keyboard.up("Shift");
      }
      await page.waitForFunction(() => document.querySelector('[role="dialog"] [data-language-switcher] button[aria-haspopup="menu"]')?.getAttribute("aria-expanded") === "false", { timeout: 3000 });
      assert(await page.$eval('[role="dialog"][aria-modal="true"]', (dialog) => dialog.contains(document.activeElement)), `${label}: ${direction} Tab from language item ${itemIndex} escaped the drawer focus trap`);
    }
  }

  await languageTrigger.click();
  await page.keyboard.press("Escape");
  assert(await page.$('[role="dialog"][aria-modal="true"]'), `${label}: Escape in language menu closed the entire drawer`);

  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector('[role="dialog"][aria-modal="true"]'), { timeout: 5000 });

  const restoredOverflow = await page.evaluate(() => document.body.style.overflow);
  assert.equal(restoredOverflow, originalOverflow, `${label}: body scroll value not restored after drawer closed`);
  await page.waitForFunction((id) => document.activeElement?.id === id, { timeout: 3000 }, hamburgerId);

  await openMobileDrawer(page, `${label} close button`);
  await page.click('[role="dialog"] button[aria-label*="Close"], [role="dialog"] button[aria-label*="关闭"]');
  await page.waitForFunction(() => !document.querySelector('[role="dialog"][aria-modal="true"]'), { timeout: 5000 });
  assert.equal(await page.evaluate(() => document.body.style.overflow), originalOverflow, `${label}: close button did not restore body overflow`);

  await openMobileDrawer(page, `${label} backdrop`);
  const viewport = page.viewport();
  assert(viewport, `${label}: viewport unavailable for backdrop test`);
  await page.mouse.click(8, viewport.height / 2);
  await page.waitForFunction(() => !document.querySelector('[role="dialog"][aria-modal="true"]'), { timeout: 5000 });
  assert.equal(await page.evaluate(() => document.body.style.overflow), originalOverflow, `${label}: backdrop did not restore body overflow`);
  await page.evaluate(() => { document.body.style.overflow = ""; });
}

async function verifyResizeClosesDrawer(page, label) {
  await page.setViewport({ width: 768, height: 1024 });
  await openMobileDrawer(page, label);
  await page.setViewport({ width: 1024, height: 768 });
  await page.waitForFunction(() => !document.querySelector('[role="dialog"][aria-modal="true"]'), { timeout: 5000 });
  assert.notEqual(await page.evaluate(() => document.body.style.overflow), "hidden", `${label}: body remained scroll-locked after crossing desktop breakpoint`);
  const focusVisible = await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.getClientRects().length > 0);
  assert(focusVisible, `${label}: focus remained on a hidden element after crossing desktop breakpoint`);
}

async function verifyFallbackLabel(page) {
  await page.setViewport({ width: 1440, height: 900 });
  const response = await page.goto(`${BASE}/guides/how-to-ask-the-i-ching`, { waitUntil: "networkidle0", timeout: 30000 });
  assert.equal(response?.status(), 200, "Fallback label page did not return HTTP 200");
  await page.click('header [data-language-switcher] button[aria-haspopup="menu"]');
  const target = await page.$eval("header [data-language-switch]", (node) => ({
    text: node.textContent?.trim(),
    href: node.getAttribute("href"),
    equivalent: node.getAttribute("data-equivalent"),
  }));
  assert.deepEqual(target, { text: "中文首页", href: "/zh", equivalent: "false" }, "English-only route must disclose Chinese-home fallback");
  await page.focus("header [data-language-switch]");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => location.pathname === "/zh", { timeout: 5000 });
}

async function runAudit() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const { executablePath, usingSystemChrome } = await resolveChromeExecutable(chromium);
  log(`Launching Chrome at ${executablePath} (${usingSystemChrome ? "system" : "serverless"})`);

  const browser = await puppeteer.launch({
    args: usingSystemChrome ? ["--no-sandbox", "--disable-dev-shm-usage"] : [...chromium.args, "--disable-dev-shm-usage"],
    executablePath,
    headless: true,
  });

  try {
    const viewports = [
      { name: "desktop-1440", width: 1440, height: 1000, isMobile: false },
      { name: "tablet-768", width: 768, height: 1024, isMobile: true },
      { name: "mobile-390", width: 390, height: 844, isMobile: true },
      { name: "mobile-375", width: 375, height: 812, isMobile: true },
      { name: "mobile-320", width: 320, height: 568, isMobile: true },
    ];

    const pagesToAudit = [
      { path: "/", lang: "en" },
      { path: "/zh", lang: "zh" },
      { path: "/hexagrams", lang: "en" },
      { path: "/zh/hexagrams", lang: "zh" },
      { path: "/hexagrams/1-the-creative", lang: "en" },
      { path: "/zh/hexagrams/1-the-creative", lang: "zh" },
    ];

    for (const vp of viewports) {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      await page.setViewport({ width: vp.width, height: vp.height });

      for (const p of pagesToAudit) {
        const label = `${vp.name} (${p.path})`;
        const response = await page.goto(`${BASE}${p.path}`, { waitUntil: "networkidle0", timeout: 30000 });
        assert([200, 304].includes(response?.status()), `${label}: expected HTTP 200/304, received ${response?.status()}`);
        await assertNoOverflow(page, label);
        await assertAriaUniqueness(page, label);
        await assertBrandCount(page, label);

        if (p.path === "/" || p.path === "/zh") {
          const screenshotPath = `${OUTPUT_DIR}/${vp.name}-${p.lang}.png`;
          await page.screenshot({ path: screenshotPath, fullPage: false });
          log(`Captured screenshot: ${screenshotPath}`);
        }

        if (!vp.isMobile && p.path === "/") {
          await verifyDesktopDropdowns(page, label);
        } else if (vp.isMobile && (p.path === "/" || p.path === "/zh")) {
          const drawerScreenshotPath = `${OUTPUT_DIR}/${vp.name}-${p.lang}-drawer.png`;
          await verifyMobileDrawer(page, label, drawerScreenshotPath);
        }
      }
      if (vp.width === 768) {
        await page.goto(`${BASE}/`, { waitUntil: "networkidle0", timeout: 30000 });
        await verifyResizeClosesDrawer(page, "tablet breakpoint transition");
      }
      await context.close();
    }

    const fallbackPage = await browser.newPage();
    await verifyFallbackLabel(fallbackPage);
    await fallbackPage.close();

    log("ALL NAVIGATION & MULTI-VIEWPORT AUDIT CHECKS PASS");
  } finally {
    await browser.close();
  }
}

await runAudit();
