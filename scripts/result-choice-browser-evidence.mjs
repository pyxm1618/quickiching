import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { resolveChromeExecutable } from "./browser-runtime.mjs";

const BASE = process.env.RESULT_CHOICE_QA_BASE_URL || "http://127.0.0.1:3036";
const OUT = path.resolve(".artifacts/result-choice-visual");
const STORAGE_KEY = "quickiching:public-v1:completed-reading";
const CONSENT_KEY = "quickiching:analytics-consent:v1";
const ID = "950e8400-e29b-41d4-a716-446655440001";

const moving = {
  schemaVersion: 1,
  id: ID,
  createdAt: "2026-11-12T00:00:00.000Z",
  method: "manual",
  methodVersion: "manual-cast-v1",
  question: "Should I change to a new job?",
  lineValuesBottomUp: [7, 6, 7, 9, 7, 7],
  evidence: { kind: "manual", mode: "line-values" },
};

const unchanged = {
  ...moving,
  id: "950e8400-e29b-41d4-a716-446655440002",
  question: "What should I understand about this situation?",
  lineValuesBottomUp: [7, 8, 7, 8, 7, 8],
};

async function seed(page, reading, locale = "en") {
  await page.goto(BASE + "/robots.txt", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.evaluate(({ key, consent, reading }) => {
    sessionStorage.clear();
    sessionStorage.setItem(key, JSON.stringify(reading));
    localStorage.setItem(consent, "denied");
  }, { key: STORAGE_KEY, consent: CONSENT_KEY, reading });
  const prefix = locale === "zh" ? "/zh" : "";
  await page.goto(BASE + prefix + "/readings/choice?session=" + encodeURIComponent(reading.id), {
    waitUntil: "networkidle0",
    timeout: 30000,
  });
  await page.waitForSelector("[data-result-choice]", { timeout: 10000 });
  await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0), { timeout: 15000 });
}

async function metrics(page) {
  return await page.evaluate(() => {
    const rect = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x:r.x, y:r.y, width:r.width, height:r.height, bottom:r.bottom, right:r.right };
    };
    return {
      viewport: { width:innerWidth, height:innerHeight },
      scroll: { width:document.documentElement.scrollWidth, height:document.documentElement.scrollHeight },
      question: rect("[data-result-choice-question]"),
      primary: rect("[data-result-choice-primary]"),
      taiji: rect("[data-result-choice-changing]"),
      changing: rect("[data-result-choice-relating]"),
      deep: rect("[data-result-choice-deep]"),
      free: rect("[data-result-choice-free]"),
      text: document.querySelector("[data-result-choice]")?.textContent || "",
    };
  });
}

async function verifyNoOcclusion(page, selector, label) {
  await page.$eval(selector, el => el.scrollIntoView({ block:"center", inline:"center", behavior:"instant" }));
  const hit = await page.$eval(selector, el => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const top = document.elementFromPoint(x, y);
    return top === el || Boolean(top && el.contains(top));
  });
  assert.equal(hit, true, label + " center must be clickable and unobscured");
}

async function capture(page, name, width, height, locale = "en", reading = moving) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await seed(page, reading, locale);
  const m = await metrics(page);
  assert(m.scroll.width <= width + 1, name + ": horizontal overflow " + m.scroll.width + " > " + width);
  assert(m.deep && m.free && m.primary && m.taiji && m.changing && m.question, name + ": required visual selectors missing");
  assert(m.deep.width <= width + 1, name + ": Deep CTA exceeds viewport");
  await verifyNoOcclusion(page, "[data-result-choice-deep]", name + "/deep");
  await verifyNoOcclusion(page, "[data-result-choice-free]", name + "/free");
  await page.screenshot({ path:path.join(OUT, name + ".png"), fullPage:true });
  return m;
}

async function main() {
  await mkdir(OUT, { recursive:true });
  const runtime = await resolveChromeExecutable(chromium);
  const browser = await puppeteer.launch({
    args: runtime.usingSystemChrome ? ["--no-sandbox","--disable-dev-shm-usage"] : [...chromium.args,"--disable-dev-shm-usage"],
    executablePath: runtime.executablePath,
    headless: true,
  });
  try {
    const page = await browser.newPage();
    const evidence = {};
    for (const [name,w,h] of [
      ["reference-1983x793",1983,793],
      ["desktop-2048x768",2048,768],
      ["desktop-1672x941",1672,941],
      ["tablet-1024x900",1024,900],
      ["tablet-768x900",768,900],
      ["mobile-430x932",430,932],
      ["mobile-390x844",390,844],
      ["mobile-375x812",375,812],
    ]) evidence[name] = await capture(page,name,w,h,"en",moving);

    evidence["zh-desktop-2048x768"] = await capture(page,"zh-desktop-2048x768",2048,768,"zh",moving);
    evidence["zh-mobile-390x844"] = await capture(page,"zh-mobile-390x844",390,844,"zh",moving);
    evidence["unchanged-1672x941"] = await capture(page,"unchanged-1672x941",1672,941,"en",unchanged);
    assert(evidence["unchanged-1672x941"].text.includes("Unchanged"), "unchanged state label missing");
    assert(evidence["unchanged-1672x941"].text.includes("No changing lines"), "no-changing-lines annotation missing");

    await writeFile(path.join(OUT,"measurements.json"), JSON.stringify(evidence,null,2));
    console.log("RESULT_CHOICE_VISUAL_QA_PASS");
    console.log(JSON.stringify(evidence,null,2));
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
