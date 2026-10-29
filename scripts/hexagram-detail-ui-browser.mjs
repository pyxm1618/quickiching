/** Read-only UI QA against the real page data, using the repository's existing browser tooling.
 * Start the production server first. Outputs are evidence, not a pixel-parity verdict.
 * HEXAGRAM_DETAIL_UI_BASE_URL=http://localhost:3217 bun scripts/hexagram-detail-ui-browser.mjs
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer-core";
import { resolveChromeExecutable } from "./browser-runtime.mjs";
import { CLASSICAL_HEXAGRAMS } from "../src/domain/public-reading/classical.ts";
import { loadPublicHexagramKnowledge } from "../src/domain/public-reading/knowledge.ts";

const base = new URL(process.env.HEXAGRAM_DETAIL_UI_BASE_URL || "http://localhost:3217");
const output = new URL("../outputs/hexagram-detail/final/", import.meta.url);
const sourceLedger = JSON.parse(await readFile(new URL("../docs/design/hexagram-detail/assets.json", import.meta.url), "utf8"));
assert.equal(sourceLedger.originalTotal, sourceLedger.assets.length);
assert.equal(Object.values(sourceLedger.states).reduce((sum, value) => sum + value, 0), sourceLedger.originalTotal);
assert.equal(sourceLedger.states.unknown, 0);
await mkdir(output, { recursive: true });
const runtime = await resolveChromeExecutable({ executablePath: async () => { throw new Error("Install Chrome or set CHROME_PATH to run the existing browser tooling."); } });
const browser = await puppeteer.launch({ executablePath: runtime.executablePath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const report = { base: base.origin, browser: await browser.version(), viewportChecks: [], navigation: [], assetChecks: [], visualFidelity: "REQUIRES HUMAN REVIEW; not asserted by this script" };
try {
  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  for (const viewport of [{ width: 1024, height: 900 }, { width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 812 }, { width: 801, height: 900 }]) {
    await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
    for (const number of [1, 3, 5, 62, 64]) {
      const knowledge = await loadPublicHexagramKnowledge(number);
      const entry = CLASSICAL_HEXAGRAMS[number - 1];
      const response = await page.goto(new URL(`/hexagrams/${entry.slug}`, base).href, { waitUntil: "networkidle0" });
      assert.equal(response.status(), 200);
      await page.waitForSelector("[data-basic-identity]");
      await page.evaluate(() => document.fonts.ready);
      if (number === 1 && viewport.width === 1024) {
        await page.waitForSelector('[aria-label="Analytics Consent"] button');
        await page.click('[aria-label="Analytics Consent"] button');
        await page.waitForSelector('[aria-label="Analytics Consent"]', { hidden: true });
        report.consentForCapture = "Declined through the existing banner in this isolated browser; product consent behavior unchanged";
      }
      const state = await page.evaluate(() => {
        const article = document.querySelector("[data-hexagram-detail]");
        const clipped = [...article.querySelectorAll("h1, h2, h3, h4, p")].filter((element) => {
          const style = getComputedStyle(element);
          // Glyphs may paint outside a line box with overflow:visible; that is not clipping.
          return element.scrollWidth > element.clientWidth + 1 || (["hidden", "clip"].includes(style.overflowY) && element.scrollHeight > element.clientHeight + 1);
        }).map((element) => element.textContent.slice(0, 70));
        const rows = [...article.querySelectorAll('[role="row"]')].slice(1);
        const meanings = rows.map((row) => row.querySelector('[role="cell"] p').textContent);
        const auxiliary = article.querySelector("[data-auxiliary-navigation]");
        const sideFrames = [...article.querySelectorAll("[data-scroll-side]")].map((side) => {
          const pieces = [...side.children].map((piece) => ({ y: piece.getBoundingClientRect().top, height: piece.getBoundingClientRect().height, width: piece.getBoundingClientRect().width, repeat: getComputedStyle(piece).backgroundRepeat, size: getComputedStyle(piece).backgroundSize }));
          return { side: side.getAttribute("data-scroll-side"), pieces };
        });
        return { url: location.href, title: document.title, viewport: { width: innerWidth, height: innerHeight }, dpr: devicePixelRatio, documentWidth: document.documentElement.scrollWidth, documentHeight: document.documentElement.scrollHeight, h1: article.querySelector("h1").textContent, h1Count: article.querySelectorAll("h1").length, sideFrames, lineCount: article.querySelectorAll("[data-hexagram-line]").length, meanings, clipped, optionalSections: article.querySelectorAll("[data-reading-cases], [data-hexagram-relations]").length, auxiliaryLinks: [...auxiliary.querySelectorAll("a")].map((a) => a.getAttribute("href")), topLevelHeaderVisible: document.body.querySelector(":scope > header").getBoundingClientRect().height > 0 };
      });
      assert.equal(state.h1, knowledge.englishName);
      assert.equal(state.h1Count, 1);
      assert.equal(state.lineCount, 6);
      assert.equal(state.optionalSections, 0);
      assert.equal(state.sideFrames.length, 2);
      for (const side of state.sideFrames) {
        assert.equal(side.pieces.length, 3);
        const [top, middle, bottom] = side.pieces;
        assert.equal(middle.repeat, "repeat-y");
        assert.match(middle.size, /^100%(?: auto)?$/u);
        assert.ok(Math.abs(top.height / top.width - 354 / (side.side === "left" ? 160 : 162)) < .02);
        assert.ok(Math.abs(bottom.height / bottom.width - 267 / (side.side === "left" ? 160 : 162)) < .02);
        assert.ok(Math.abs(top.y + top.height - middle.y) < 1);
        assert.ok(Math.abs(middle.y + middle.height - bottom.y) < 1);
      }
      assert.equal(state.documentWidth, viewport.width, `${number} at ${viewport.width}: horizontal scroll`);
      assert.deepEqual(state.clipped, [], `${number} at ${viewport.width}: clipped text`);
      assert.deepEqual(state.meanings, knowledge.lines.slice().reverse().map((line) => line.meaning));
      assert.equal(state.topLevelHeaderVisible, false);
      const expectedLinks = [...(number > 1 ? [`/hexagrams/${CLASSICAL_HEXAGRAMS[number - 2].slug}`] : []), "/hexagrams", ...(number < 64 ? [`/hexagrams/${CLASSICAL_HEXAGRAMS[number].slug}`] : [])];
      assert.deepEqual(state.auxiliaryLinks, expectedLinks);
      const name = `hexagram-${number}-${viewport.width}`;
      await page.screenshot({ path: new URL(`${name}.png`, output).pathname, fullPage: true });
      if (number === 1 || number === 62) await page.screenshot({ path: new URL(`${name}-viewport.png`, output).pathname, fullPage: false });
      report.viewportChecks.push({ ...state, screenshot: `${name}.png`, status: "PASS (structural checks only)" });
    }
  }
  // The real catalog names #62 "Small Exceeding". The user-specified longer alias
  // is a display-only stress test, never a catalog mutation or production fallback.
  report.longNameStress = [];
  for (const width of [1024, 390, 320]) {
    await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
    await page.goto(new URL(`/hexagrams/${CLASSICAL_HEXAGRAMS[61].slug}`, base).href, { waitUntil: "networkidle0" });
    const layout = await page.evaluate(() => {
      const h1 = document.querySelector("[data-basic-identity] h1");
      h1.textContent = "Preponderance of the Small";
      return { text: h1.textContent, scrollWidth: h1.scrollWidth, width: h1.clientWidth, documentWidth: document.documentElement.scrollWidth, viewport: innerWidth };
    });
    assert.equal(layout.documentWidth, width);
    assert.ok(layout.scrollWidth <= layout.width + 1);
    await page.screenshot({ path: new URL(`test-only-long-name-${width}.png`, output).pathname, fullPage: false });
    report.longNameStress.push({ ...layout, provenance: "User-specified alternate name injected into temporary DOM for layout testing only; real catalog unchanged", status: "PASS" });
  }
  // Exercise real local section links and sequence/hub navigation, beyond href assertions.
  await page.setViewport({ width: 1024, height: 900, deviceScaleFactor: 1 });
  await page.goto(new URL("/hexagrams/5-waiting", base).href, { waitUntil: "networkidle0" });
  for (const anchor of ["#basic-identity", "#hexagram-meaning-title", "#hexagram-classical-title", "#hexagram-lines-title"]) {
    await page.click(`nav[aria-label="On this page"] a[href="${anchor}"]`);
    assert.equal(await page.evaluate(() => location.hash), anchor);
  }
  for (const [label, expectedPath] of [["Previous", "/hexagrams/4-youthful-folly"], ["Next", "/hexagrams/5-waiting"], ["Back to 64 Hexagrams", "/hexagrams"]]) {
    const link = await page.$(`[data-auxiliary-navigation] a[${label === "Back to 64 Hexagrams" ? 'href="/hexagrams"' : `aria-label^="${label}:"`}]`);
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), link.click()]);
    const actualPath = new URL(page.url()).pathname;
    assert.equal(actualPath, expectedPath);
    report.navigation.push({ label, path: actualPath, status: "PASS" });
  }
  // Styles remain scoped: the Chinese page still has its original visible site header.
  await page.goto(new URL("/zh/hexagrams/1-the-creative", base).href, { waitUntil: "networkidle0" });
  assert.equal(await page.$('[data-basic-identity]'), null);
  assert.ok(await page.$eval("body > header", (element) => element.getBoundingClientRect().height > 0));
  report.chineseStyleIsolation = "PASS";
  for (const asset of sourceLedger.assets) {
    const response = await page.goto(new URL(asset.path.replace(/^public/, ""), base).href);
    assert.equal(response.status(), 200, asset.path);
    const hash = createHash("sha256").update(await response.buffer()).digest("hex");
    assert.equal(hash, asset.sha256, asset.path);
    report.assetChecks.push({ path: asset.path, sha256: hash, status: "PASS" });
  }
  assert.deepEqual(pageErrors, []);
  report.pageErrors = pageErrors;
  await writeFile(new URL("report.json", output), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ viewportChecks: report.viewportChecks.length, assets: report.assetChecks.length, navigation: report.navigation, report: new URL("report.json", output).pathname, status: "PASS (structural UI checks; visual review separate)" }, null, 2));
} finally {
  await browser.close();
}
