import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { ZH_INDEXABLE_PAGE_SEO } from "../src/content/seo/zh-pages.ts";
import { evaluateKeywordQuality, countExactPhrase } from "../src/content/hexagrams/seo-quality.ts";
import { ROUTE_REGISTRY, indexablePathInventory, routeForPath } from "../src/i18n/routes.ts";
import { resolveChromeExecutable } from "./browser-runtime.mjs";

const BASE = process.env.CHINESE_SEO_AUDIT_BASE_URL || process.env.PUBLIC_V1_TEST_BASE_URL || "http://127.0.0.1:3000";
const CANONICAL_ORIGIN = "https://www.quickiching.com";
const OUTPUT_DIR = process.env.CHINESE_SEO_AUDIT_OUTPUT_DIR || "/tmp/quickiching-chinese-seo-quality";

const NON_HEX_BY_PATH = new Map(Object.values(ZH_INDEXABLE_PAGE_SEO).map((entry) => [entry.canonicalUrl, entry]));
const ZH_PATHS = indexablePathInventory().filter((path) => path.startsWith("/zh"));
const ENGLISH_EQUIVALENT_PATHS = new Set(
  ROUTE_REGISTRY.flatMap((route) => route.paths.en && route.paths["zh-Hans"] ? [route.paths.en] : []),
);

const ALLOWED_LATIN = [
  "Quick I Ching",
  "Google",
  "Microsoft",
  "Waffo",
  "IANA",
  "Adsterra",
  "Vercel AI Gateway",
  "localStorage",
  "sessionStorage",
  "effectivecpmnetwork.com",
];

function normalize(value) {
  return String(value ?? "").normalize("NFKC");
}

function canonical(path) {
  return new URL(path, CANONICAL_ORIGIN).toString();
}

function stripAllowedLatin(value) {
  let text = normalize(value);
  text = text.replace(/https?:\/\/\S+/giu, " ");
  text = text.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gu, " ");
  for (const allowed of [...ALLOWED_LATIN].sort((a, b) => b.length - a.length)) {
    text = text.split(allowed).join(" ");
  }
  return text;
}

function latinContamination(value) {
  const matches = stripAllowedLatin(value).match(/\p{Script=Latin}[\p{Script=Latin}\p{M}'’\-]*/gu) ?? [];
  const words = matches.filter((word) => [...word].length >= 2);
  return { count: words.length, samples: [...new Set(words)].slice(0, 20) };
}

function unique(values) {
  return [...new Set(values)];
}

function mechanicalPrimaryRepetition(text, primary) {
  const normalizedText = normalize(text);
  const normalizedPrimary = normalize(primary);
  return ["", " ", " · ", "，", "。", "、", " / ", " | "]
    .some((separator) => normalizedText.includes(normalizedPrimary + separator + normalizedPrimary + separator + normalizedPrimary));
}

function csvEscape(value) {
  const str = typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "");
  return /[",\n]/u.test(str) ? '"' + str.replaceAll('"', '""') + '"' : str;
}

async function snapshot(page, path) {
  const response = await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 30_000 });
  assert([200, 304].includes(response?.status()), path + ": expected 200/304, got " + response?.status());
  return page.evaluate(() => {
    function attr(selector, name) {
      return document.querySelector(selector)?.getAttribute(name) ?? "";
    }
    const visibleClone = document.body.cloneNode(true);
    if (!(visibleClone instanceof HTMLElement)) throw new Error("BODY_CLONE_FAILED");
    visibleClone.querySelectorAll("script, style, noscript, template, [hidden], [aria-hidden='true']").forEach((node) => node.remove());

    const main = document.querySelector("main");
    const article = main?.querySelector("article[data-seo-primary]") ?? null;
    let eligibleText = "";
    if (article instanceof HTMLElement) {
      const copy = article.cloneNode(true);
      if (copy instanceof HTMLElement) {
        copy.querySelectorAll("nav, button, script, style, noscript, template, [hidden], [aria-hidden='true'], [data-seo-exclude], [data-legal-disclaimer], [data-cookie]").forEach((node) => node.remove());
        copy.querySelectorAll("a").forEach((node) => node.replaceWith(...node.childNodes));
        eligibleText = copy.innerText.replace(/\s+/gu, " ").trim();
      }
    }

    const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')].map((node) => {
      try { return JSON.parse(node.textContent ?? "null"); } catch { return { __parseError: true }; }
    });

    return {
      title: document.title,
      description: attr('meta[name="description"]', "content"),
      robots: attr('meta[name="robots"]', "content"),
      canonical: attr('link[rel="canonical"]', "href"),
      htmlLang: document.documentElement.lang,
      h1: [...(main?.querySelectorAll("h1") ?? [])].map((node) => node.textContent?.replace(/\s+/gu, " ").trim() ?? ""),
      h2: [...(main?.querySelectorAll("h2") ?? [])].map((node) => node.textContent?.replace(/\s+/gu, " ").trim() ?? ""),
      earlyCopy: main?.querySelector("[data-seo-early-copy]")?.textContent?.replace(/\s+/gu, " ").trim() ?? "",
      visibleText: visibleClone.innerText.replace(/\s+/gu, " ").trim(),
      eligibleText,
      alternates: [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((node) => ({
        hreflang: node.getAttribute("hreflang") ?? "",
        href: node.getAttribute("href") ?? "",
      })),
      jsonLd,
      links: [...document.querySelectorAll("a[href]")].map((node) => ({
        href: node.getAttribute("href") ?? "",
        text: node.textContent?.replace(/\s+/gu, " ").trim() ?? "",
        languageSwitch: Boolean(node.closest("[data-language-switcher]")) || node.hasAttribute("data-language-switch"),
      })),
    };
  });
}

function jsonLdLanguageAndUrlOk(entries, expectedUrl) {
  const nodes = entries.flatMap((entry) => Array.isArray(entry?.["@graph"]) ? [entry, ...entry["@graph"]] : [entry]);
  const parseable = entries.length > 0 && entries.every((entry) => !entry?.__parseError);
  const urlOk = nodes.some((entry) => entry?.url === expectedUrl || entry?.["@id"] === expectedUrl || entry?.mainEntityOfPage === expectedUrl);
  const languageOk = nodes.some((entry) => entry?.inLanguage === "zh-Hans");
  return { parseable, urlOk, languageOk };
}

function ordinaryEnglishLinks(snapshot, currentPath) {
  return snapshot.links.filter((link) => {
    if (link.languageSwitch || !link.href) return false;
    let url;
    try { url = new URL(link.href, CANONICAL_ORIGIN); } catch { return false; }
    if (url.origin !== CANONICAL_ORIGIN) return false;
    if (url.pathname === currentPath) return false;
    return ENGLISH_EQUIVALENT_PATHS.has(url.pathname);
  });
}

function alternatesFor(snapshot) {
  return Object.fromEntries(snapshot.alternates.map((entry) => [entry.hreflang, entry.href]));
}

function auditBase(path, snapshot) {
  const route = routeForPath(path);
  assert(route, path + ": route registry entry missing");
  const expectedCanonical = canonical(path);
  const englishPath = route.paths.en;
  const alt = alternatesFor(snapshot);
  const jsonLd = jsonLdLanguageAndUrlOk(snapshot.jsonLd, expectedCanonical);
  const contamination = latinContamination(snapshot.visibleText);
  const wrongInternalLinks = ordinaryEnglishLinks(snapshot, path);
  const failures = [
    snapshot.title ? null : "title:missing",
    snapshot.description ? null : "description:missing",
    snapshot.h1.length === 1 ? null : "h1:count-" + snapshot.h1.length,
    snapshot.htmlLang === "zh-Hans" ? null : "html-lang:" + snapshot.htmlLang,
    new URL(snapshot.canonical, CANONICAL_ORIGIN).toString() === expectedCanonical ? null : "canonical",
    /\bindex\b/iu.test(snapshot.robots) && !/\bnoindex\b/iu.test(snapshot.robots) ? null : "robots:index",
    /\bfollow\b/iu.test(snapshot.robots) ? null : "robots:follow",
    englishPath && alt.en === canonical(englishPath) ? null : "hreflang:en",
    alt["zh-Hans"] === expectedCanonical ? null : "hreflang:zh-Hans",
    englishPath && alt["x-default"] === canonical(englishPath) ? null : "hreflang:x-default",
    jsonLd.parseable ? null : "json-ld:parseable",
    jsonLd.urlOk ? null : "json-ld:url",
    jsonLd.languageOk ? null : "json-ld:language",
    contamination.count === 0 ? null : "english-contamination:" + contamination.count,
    wrongInternalLinks.length === 0 ? null : "internal-links-to-english:" + wrongInternalLinks.length,
  ].filter(Boolean);

  return {
    path,
    url: expectedCanonical,
    httpStatus: 200,
    title: snapshot.title,
    description: snapshot.description,
    h1: snapshot.h1,
    canonical: snapshot.canonical,
    hreflang: alt,
    htmlLang: snapshot.htmlLang,
    robots: snapshot.robots,
    jsonLd,
    englishContamination: contamination,
    wrongInternalLinks,
    failures,
  };
}

function auditNonHex(path, snapshot, baseRow, homeLinks) {
  const entry = NON_HEX_BY_PATH.get(path);
  if (!entry) return baseRow;
  const approvedFamily = unique([entry.primaryKeyword, ...entry.secondaryCore, ...entry.secondaryVariantFamily]);
  const quality = evaluateKeywordQuality({
    text: snapshot.eligibleText,
    locale: "zh-Hans",
    primary: entry.primaryKeyword,
    approvedFamily,
  });
  const primaryMin = entry.primaryDensityMin / 100;
  const primaryMax = entry.primaryDensityMax / 100;
  const familyMin = entry.familyDensityMin / 100;
  const familyMax = entry.familyDensityMax / 100;
  const primaryDensityPass = quality.measurement.primaryDensity >= primaryMin && quality.measurement.primaryDensity <= primaryMax;
  const familyDensityPass = quality.measurement.familyDensity >= familyMin && quality.measurement.familyDensity <= familyMax;
  const inbound = path === "/zh" ? null : homeLinks.find((link) => {
    let target;
    try { target = new URL(link.href, CANONICAL_ORIGIN).pathname; } catch { return false; }
    return target === path && countExactPhrase(link.text, entry.primaryKeyword, "zh-Hans") > 0;
  }) ?? null;

  const placement = {
    titleExact: snapshot.title === entry.finalTitle,
    descriptionExact: snapshot.description === entry.finalDescription,
    h1Exact: snapshot.h1.length === 1 && snapshot.h1[0] === entry.finalH1,
    primaryInTitle: countExactPhrase(snapshot.title, entry.primaryKeyword, "zh-Hans") > 0,
    primaryInDescription: countExactPhrase(snapshot.description, entry.primaryKeyword, "zh-Hans") > 0,
    primaryInH1: snapshot.h1.some((value) => countExactPhrase(value, entry.primaryKeyword, "zh-Hans") > 0),
    primaryInEarlyCopy: countExactPhrase(snapshot.earlyCopy, entry.primaryKeyword, "zh-Hans") > 0,
    primaryInH2: snapshot.h2.some((value) => countExactPhrase(value, entry.primaryKeyword, "zh-Hans") > 0),
    primaryInboundAnchor: path === "/zh" ? true : Boolean(inbound),
  };
  const extraFailures = [
    primaryDensityPass ? null : "primary-density:" + quality.measurement.primaryDensity.toFixed(6),
    familyDensityPass ? null : "family-density:" + quality.measurement.familyDensity.toFixed(6),
    quality.contamination.count === 0 ? null : "eligible-copy-language-contamination:" + quality.contamination.count,
    mechanicalPrimaryRepetition(snapshot.eligibleText, entry.primaryKeyword) ? "stuffing:mechanical-primary-repetition" : null,
    ...Object.entries(placement).filter(([, passed]) => !passed).map(([key]) => "placement:" + key),
  ].filter(Boolean);

  return {
    ...baseRow,
    routeId: entry.routeId,
    primary: entry.primaryKeyword,
    primaryCount: quality.measurement.primaryOccurrences,
    tokenCount: quality.measurement.tokenCount,
    primaryDensity: Number(quality.measurement.primaryDensity.toFixed(6)),
    familyDensity: Number(quality.measurement.familyDensity.toFixed(6)),
    familyDensityBasis: quality.measurement.familyDensityBasis,
    researchStatus: entry.researchStatus,
    placement,
    inboundAnchor: inbound,
    failures: [...baseRow.failures, ...extraFailures],
  };
}

async function writeReports(rows) {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const normalized = rows.map((row) => ({ ...row, status: row.failures.length === 0 ? "PASS" : "FAIL" }));
  const summary = {
    total: normalized.length,
    expected: 73,
    pass: normalized.filter((row) => row.status === "PASS").length,
    fail: normalized.filter((row) => row.status === "FAIL").length,
    nonHexSeoPages: normalized.filter((row) => row.primary).length,
    failures: normalized.flatMap((row) => row.failures.map((failure) => ({ path: row.path, failure }))),
  };
  const jsonPath = OUTPUT_DIR + "/chinese-seo-quality.json";
  const csvPath = OUTPUT_DIR + "/chinese-seo-quality.csv";
  await writeFile(jsonPath, JSON.stringify({ summary, rows: normalized }, null, 2) + "\n");
  const columns = [
    "url", "path", "httpStatus", "title", "description", "h1", "primary", "primaryCount", "tokenCount",
    "primaryDensity", "familyDensity", "canonical", "hreflang", "htmlLang", "robots", "jsonLd",
    "englishContamination", "wrongInternalLinks", "researchStatus", "placement", "status", "failures",
  ];
  const csv = [columns.join(","), ...normalized.map((row) => columns.map((key) => csvEscape(row[key])).join(","))].join("\n") + "\n";
  await writeFile(csvPath, csv);
  console.log(JSON.stringify({ ...summary, outputJson: jsonPath, outputCsv: csvPath }, null, 2));
  if (summary.total !== 73 || summary.fail > 0) process.exitCode = 1;
}

assert.equal(ZH_PATHS.length, 73, "Chinese canonical inventory must contain exactly 73 pages");

const { executablePath, usingSystemChrome } = await resolveChromeExecutable(chromium);
const browser = await puppeteer.launch({
  args: usingSystemChrome ? ["--no-sandbox", "--disable-dev-shm-usage"] : [...chromium.args, "--disable-dev-shm-usage"],
  executablePath,
  headless: true,
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  await page.setJavaScriptEnabled(false);
  const homeSnapshot = await snapshot(page, "/zh");
  const homeLinks = homeSnapshot.links;
  const rows = [];
  for (const path of ZH_PATHS) {
    const pageSnapshot = path === "/zh" ? homeSnapshot : await snapshot(page, path);
    const baseRow = auditBase(path, pageSnapshot);
    rows.push(auditNonHex(path, pageSnapshot, baseRow, homeLinks));
  }
  await page.close();
  await writeReports(rows);
} finally {
  let closed = false;
  await Promise.race([
    browser.close().then(() => { closed = true; }).catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  if (!closed) browser.process()?.kill("SIGKILL");
}
