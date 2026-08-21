import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { HEXAGRAM_SEO_REGISTRY } from "../src/content/hexagrams/seo.ts";
import { resolveChromeExecutable } from "./browser-runtime.mjs";

const BASE = process.env.HEXAGRAM_SEO_AUDIT_BASE_URL || process.env.PUBLIC_V1_TEST_BASE_URL || "http://127.0.0.1:3000";
const STATIC_BUILD_DIR = process.env.HEXAGRAM_SEO_AUDIT_STATIC_DIR || "";
const OUTPUT_DIR = process.env.HEXAGRAM_SEO_AUDIT_OUTPUT_DIR || "/tmp/quickiching-hexagram-seo-quality";
const CANONICAL_ORIGIN = "https://www.quickiching.com";

function normalize(value) {
  return value.normalize("NFKC");
}

function normalizeForMatch(value) {
  return normalize(value).toLocaleLowerCase("en-US");
}

function splitPhrases(value) {
  return value
    .split(/[;；]/u)
    .map((phrase) => normalize(phrase.trim()))
    .filter(Boolean);
}

function unique(values) {
  return [...new Set(values)];
}

function countPhraseOccurrences(text, phrase) {
  const haystack = normalizeForMatch(text);
  const needle = normalizeForMatch(phrase);
  if (!needle) return 0;
  let count = 0;
  let cursor = 0;
  while (cursor <= haystack.length - needle.length) {
    const foundAt = haystack.indexOf(needle, cursor);
    if (foundAt < 0) break;
    count += 1;
    cursor = foundAt + needle.length;
  }
  return count;
}

function containsPhrase(text, phrase) {
  return normalizeForMatch(text).includes(normalizeForMatch(phrase));
}

function unicodeWordTokens(text) {
  return normalize(text).match(/[\p{L}\p{N}]+/gu) ?? [];
}

function bodyTokenCount(text, locale) {
  if (locale !== "zh-Hans") return unicodeWordTokens(text).length;
  const segmenter = new Intl.Segmenter("zh-Hans", { granularity: "word" });
  return [...segmenter.segment(normalize(text))].filter((segment) => segment.isWordLike).length;
}

function coverage(text, phrases) {
  const candidates = unique(phrases.map((phrase) => normalize(phrase.trim())).filter(Boolean));
  const matched = candidates.filter((phrase) => containsPhrase(text, phrase));
  return {
    total: candidates.length,
    matchedCount: matched.length,
    ratio: candidates.length === 0 ? 1 : Number((matched.length / candidates.length).toFixed(4)),
    matched,
    missing: candidates.filter((phrase) => !matched.includes(phrase)),
  };
}

function mechanicalPrimaryRepetition(text, primary) {
  const normalizedText = normalizeForMatch(text);
  const normalizedPrimary = normalizeForMatch(primary);
  if (!normalizedPrimary) return false;
  const separators = ["", " ", " · ", "，", ", ", "。", " / ", " | "];
  return separators.some((separator) => normalizedText.includes(`${normalizedPrimary}${separator}${normalizedPrimary}${separator}${normalizedPrimary}`));
}

function csvEscape(value) {
  const stringValue = typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "");
  return /[",\n]/u.test(stringValue) ? `"${stringValue.replaceAll('"', '""')}"` : stringValue;
}

function pagePath(entry) {
  return new URL(entry.canonicalUrl).pathname;
}

function pageUrl(entry) {
  if (!STATIC_BUILD_DIR) return `${BASE}${pagePath(entry)}`;
  return pathToFileURL(resolve(STATIC_BUILD_DIR, `.${pagePath(entry)}.html`)).href;
}

function htmlAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "iu"));
  return decodeHtmlEntities(match?.[2] ?? "");
}

function decodeHtmlEntities(value) {
  return value.replace(/&(?:amp|lt|gt|quot|apos|nbsp);|&#x[0-9a-f]+;|&#[0-9]+;/giu, (entity) => {
    const named = {
      "&amp;": "&",
      "&lt;": "<",
      "&gt;": ">",
      "&quot;": '"',
      "&apos;": "'",
      "&nbsp;": " ",
    }[entity.toLocaleLowerCase("en-US")];
    if (named) return named;
    const codePoint = entity.toLocaleLowerCase("en-US").startsWith("&#x")
      ? Number.parseInt(entity.slice(3, -1), 16)
      : Number.parseInt(entity.slice(2, -1), 10);
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
  });
}

function htmlText(fragment) {
  return decodeHtmlEntities(fragment
    .replace(/<!--[\s\S]*?-->/gu, "")
    .replace(/<[^>]*>/gu, " "))
    .replace(/\s+/gu, " ")
    .trim();
}

function elementMatches(fragment, tagName) {
  return [...fragment.matchAll(new RegExp(`<${tagName}\\b[^>]*>[\\s\\S]*?<\\/${tagName}>`, "giu"))].map((match) => match[0]);
}

function hubPathForLocale(locale) {
  return locale === "zh-Hans" ? "/zh/hexagrams" : "/hexagrams";
}

function inboundAnchorsFromHtml(html, sourceUrl) {
  return elementMatches(html, "a")
    .map((anchor) => {
      const openingTag = anchor.match(/^<a\b[^>]*>/iu)?.[0] ?? "";
      return {
        sourceUrl,
        sourcePath: new URL(sourceUrl).pathname,
        href: htmlAttribute(openingTag, "href"),
        primary: htmlAttribute(openingTag, "data-seo-inbound-anchor"),
        text: htmlText(anchor),
      };
    })
    .filter((anchor) => anchor.href && anchor.primary);
}

function inboundAnchorFor(entry, hubAnchors) {
  const targetPath = pagePath(entry);
  return hubAnchors.find((anchor) => {
    const hrefPath = new URL(anchor.href, CANONICAL_ORIGIN).pathname;
    return hrefPath === targetPath && normalizeForMatch(anchor.text).includes(normalizeForMatch(entry.primaryKeyword));
  }) ?? null;
}

async function snapshotPage(page, entry) {
  const response = await page.goto(pageUrl(entry), {
    waitUntil: STATIC_BUILD_DIR ? "load" : "networkidle0",
    timeout: 30_000,
  });
  if (!STATIC_BUILD_DIR) {
    assert([200, 304].includes(response?.status()), `${entry.canonicalUrl}: expected 200 or 304, received ${response?.status()}`);
  }
  return page.evaluate(() => {
    const root = document.querySelector("main article[data-hexagram-detail]");
    if (!root) return null;
    const clone = root.cloneNode(true);
    if (!(clone instanceof HTMLElement)) return null;
    clone.querySelectorAll("nav, button, script, style, [data-legal-disclaimer], [data-cookie], [aria-hidden=\"true\"]").forEach((node) => node.remove());
    return {
      bodyText: clone.textContent?.replace(/\s+/gu, " ").trim() ?? "",
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
      robots: document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? "",
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? "",
      ogUrl: document.querySelector('meta[property="og:url"]')?.getAttribute("content") ?? "",
      ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute("content") ?? "",
      ogDescription: document.querySelector('meta[property="og:description"]')?.getAttribute("content") ?? "",
      h1: [...root.querySelectorAll("h1")].map((node) => node.textContent?.replace(/\s+/gu, " ").trim() ?? ""),
      earlyCopy: root.querySelector("[data-seo-early-copy]")?.textContent?.replace(/\s+/gu, " ").trim() ?? "",
      h2: [...root.querySelectorAll("h2")].map((node) => node.textContent?.replace(/\s+/gu, " ").trim() ?? ""),
      breadcrumb: root.querySelector('nav[aria-label]')?.textContent?.replace(/\s+/gu, " ").trim() ?? "",
      lineAnchors: Array.from({ length: 6 }, (_, index) => root.querySelector(`#line-${index + 1}`) !== null),
      alternates: [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((node) => ({
        hreflang: node.getAttribute("hreflang") ?? "",
        href: node.getAttribute("href") ?? "",
      })),
      htmlLang: document.documentElement.lang,
      jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].map((node) => {
        try { return JSON.parse(node.textContent ?? "null"); } catch { return { __parseError: true }; }
      }),
      hiddenCount: root.querySelectorAll("[hidden], [style*='display:none'], [style*='visibility:hidden']").length,
      keywordListCount: root.querySelectorAll("[data-keyword-list], [data-seo-keywords]").length,
    };
  });
}

async function snapshotHub(page, locale) {
  const sourcePath = hubPathForLocale(locale);
  const response = await page.goto(`${BASE}${sourcePath}`, {
    waitUntil: "networkidle0",
    timeout: 30_000,
  });
  assert([200, 304].includes(response?.status()), `${sourcePath}: expected 200 or 304, received ${response?.status()}`);
  return page.evaluate((path) => [...document.querySelectorAll("main a[data-seo-inbound-anchor][href]")].map((node) => ({
    sourceUrl: location.href,
    sourcePath: path,
    href: node.getAttribute("href") ?? "",
    primary: node.getAttribute("data-seo-inbound-anchor") ?? "",
    text: node.textContent?.replace(/\s+/gu, " ").trim() ?? "",
  })), sourcePath);
}

function staticHubAnchors(locale) {
  const sourcePath = hubPathForLocale(locale);
  const html = readFileSync(resolve(STATIC_BUILD_DIR, `.${sourcePath}.html`), "utf8");
  return inboundAnchorsFromHtml(html, CANONICAL_ORIGIN + sourcePath);
}

function auditSnapshot(entry, snapshot, inboundAnchor) {
  assert(snapshot, `${entry.canonicalUrl}: detail root missing from initial HTML`);
  const bodyText = normalize(snapshot.bodyText);
  const tokens = bodyTokenCount(bodyText, entry.locale);
  const primaryOccurrences = countPhraseOccurrences(bodyText, entry.primaryKeyword);
  const primaryDensityDiagnostic = primaryOccurrences / Math.max(tokens, 1);
  const secondaryPhrases = splitPhrases(entry.secondaryCore);
  const secondaryCoverage = coverage(bodyText, secondaryPhrases);
  const secondaryEarlyMatched = secondaryPhrases.filter((phrase) => containsPhrase(snapshot.earlyCopy, phrase));
  const variantCoverage = coverage(
    [bodyText, snapshot.title, snapshot.description, ...snapshot.h1, ...snapshot.h2].join(" "),
    splitPhrases(entry.secondaryVariantFamily).filter((phrase) => normalizeForMatch(phrase) !== normalizeForMatch(entry.primaryKeyword)),
  );
  const semanticCoverage = coverage(bodyText, splitPhrases(entry.semanticEntityTerms));
  const brandOccurrences = countPhraseOccurrences(bodyText, "Quick I Ching") + countPhraseOccurrences(bodyText, "QuickIChing");
  const sourceNoise = {
    wikisource: countPhraseOccurrences(bodyText, "Wikisource"),
    oldid: countPhraseOccurrences(bodyText, "oldid"),
    fixedRevision: countPhraseOccurrences(bodyText, "fixed revision"),
    fixedRevisionZh: countPhraseOccurrences(bodyText, "固定修订版"),
    visibleLineSlug: countPhraseOccurrences(bodyText, "#line-"),
  };
  const expectedCanonical = entry.canonicalUrl;
  const alternateMap = Object.fromEntries(snapshot.alternates.map((alternate) => [alternate.hreflang, alternate.href]));
  const inboundAnchorValid = Boolean(inboundAnchor
    && inboundAnchor.sourcePath === hubPathForLocale(entry.locale)
    && new URL(inboundAnchor.href, CANONICAL_ORIGIN).pathname === pagePath(entry)
    && normalizeForMatch(inboundAnchor.text).includes(normalizeForMatch(entry.primaryKeyword)));
  const placement = {
    titleExact: snapshot.title === entry.finalTitle,
    descriptionExact: snapshot.description === entry.finalDescription,
    robots: /\bindex\b/iu.test(snapshot.robots) && /\bfollow\b/iu.test(snapshot.robots) && !/\bnoindex\b/iu.test(snapshot.robots),
    ogTitle: snapshot.ogTitle === entry.finalTitle,
    ogDescription: snapshot.ogDescription === entry.finalDescription,
    ogUrl: snapshot.ogUrl === expectedCanonical,
    h1Exact: snapshot.h1.length === 1 && snapshot.h1[0] === entry.finalH1,
    primaryInTitle: containsPhrase(snapshot.title, entry.primaryKeyword),
    primaryInDescription: containsPhrase(snapshot.description, entry.primaryKeyword),
    primaryInH1: snapshot.h1.some((value) => containsPhrase(value, entry.primaryKeyword)),
    primaryInEarlyCopy: containsPhrase(snapshot.earlyCopy, entry.primaryKeyword),
    primaryInH2: snapshot.h2.some((value) => containsPhrase(value, entry.primaryKeyword)),
    primaryInBreadcrumb: containsPhrase(snapshot.breadcrumb, entry.primaryKeyword),
    primaryInboundAnchor: inboundAnchorValid,
    secondaryInEarlyCopy: secondaryEarlyMatched.length > 0,
  };
  const structuredGraph = snapshot.jsonLd.flatMap((entryValue) => Array.isArray(entryValue?.["@graph"]) ? entryValue["@graph"] : []);
  const webPage = structuredGraph.find((entryValue) => entryValue?.["@type"] === "WebPage");
  const breadcrumb = structuredGraph.find((entryValue) => entryValue?.["@type"] === "BreadcrumbList");
  const jsonLd = {
    parseable: snapshot.jsonLd.length > 0 && snapshot.jsonLd.every((entryValue) => !entryValue?.__parseError),
    webPageUrl: webPage?.url === expectedCanonical,
    webPageLanguage: webPage?.inLanguage === (entry.locale === "zh-Hans" ? "zh-Hans" : "en"),
    breadcrumbUrl: breadcrumb?.itemListElement?.[1]?.item === expectedCanonical,
  };
  const hreflang = {
    en: alternateMap.en === CANONICAL_ORIGIN + "/hexagrams/" + entry.slug,
    zhHans: alternateMap["zh-Hans"] === CANONICAL_ORIGIN + "/zh/hexagrams/" + entry.slug,
    xDefault: alternateMap["x-default"] === CANONICAL_ORIGIN + "/hexagrams/" + entry.slug,
  };
  const repetition = {
    mechanicalPrimaryRepetition: mechanicalPrimaryRepetition(bodyText, entry.primaryKeyword),
    exactPrimaryOccurrences: primaryOccurrences,
    primaryDensityDiagnostic: Number(primaryDensityDiagnostic.toFixed(6)),
  };
  const failures = [
    ...Object.entries(placement).filter(([, passed]) => !passed).map(([name]) => `placement:${name}`),
    snapshot.canonical !== expectedCanonical ? "canonical" : null,
    snapshot.ogUrl !== expectedCanonical ? "og:url" : null,
    snapshot.htmlLang !== (entry.locale === "zh-Hans" ? "zh-Hans" : "en") ? "html-lang" : null,
    ...Object.entries(hreflang).filter(([, passed]) => !passed).map(([name]) => `hreflang:${name}`),
    ...Object.entries(jsonLd).filter(([, passed]) => !passed).map(([name]) => `json-ld:${name}`),
    ...(!snapshot.lineAnchors.every(Boolean) ? ["line-anchors"] : []),
    snapshot.hiddenCount > 0 ? `hidden-content:${snapshot.hiddenCount}` : null,
    snapshot.keywordListCount > 0 ? `keyword-list:${snapshot.keywordListCount}` : null,
    brandOccurrences > entry.brandMentionsInBodyMax ? `brand-body:${brandOccurrences}` : null,
    sourceNoise.wikisource > 2 ? `source-noise:wikisource:${sourceNoise.wikisource}` : null,
    sourceNoise.oldid > 1 ? `source-noise:oldid:${sourceNoise.oldid}` : null,
    sourceNoise.fixedRevision > 1 ? `source-noise:fixed-revision:${sourceNoise.fixedRevision}` : null,
    sourceNoise.fixedRevisionZh > 1 ? `source-noise:fixed-revision-zh:${sourceNoise.fixedRevisionZh}` : null,
    sourceNoise.visibleLineSlug > 0 ? `source-noise:visible-line-slug:${sourceNoise.visibleLineSlug}` : null,
    repetition.mechanicalPrimaryRepetition ? "stuffing:mechanical-primary-repetition" : null,
  ].filter(Boolean);
  return {
    url: expectedCanonical,
    path: pagePath(entry),
    locale: entry.locale,
    number: entry.number,
    primary: entry.primaryKeyword,
    secondaryCore: secondaryPhrases,
    bodyTokenCount: tokens,
    primaryOccurrenceCount: primaryOccurrences,
    primaryDensityDiagnostic: repetition.primaryDensityDiagnostic,
    densityPolicy: "diagnostic-only; no universal primary or keyword-family percentage gate",
    placements: placement,
    secondaryEarlyMatched,
    secondaryCoverage,
    variantCoverage,
    semanticCoverage,
    sourceNoise,
    repetition,
    brandBodyOccurrences: brandOccurrences,
    inboundAnchor: inboundAnchor ? {
      sourceUrl: inboundAnchor.sourceUrl,
      sourcePath: inboundAnchor.sourcePath,
      href: inboundAnchor.href,
      primary: inboundAnchor.primary,
      text: inboundAnchor.text,
    } : null,
    canonical: snapshot.canonical,
    hreflang,
    jsonLd,
    lineAnchors: snapshot.lineAnchors.every(Boolean),
    hiddenContentCount: snapshot.hiddenCount,
    status: failures.length === 0 ? "PASS" : "FAIL",
    failures,
  };
}

async function writeReport(rows) {
  const failures = rows.flatMap((row) => row.failures.map((failure) => ({ url: row.url, failure })));
  const summary = {
    base: BASE,
    staticBuildDir: STATIC_BUILD_DIR || null,
    algorithm: "Primary placement and preferred-secondary coverage are acceptance gates. Primary frequency, secondary/variant/entity coverage and token-normalized density are diagnostics only. English uses Unicode word tokens; zh-Hans uses Intl.Segmenter directly on visible body text. No keyword-family density target or waiver ledger is used.",
    total: rows.length,
    records: rows.length === 128,
    english: rows.filter((row) => row.locale === "en").length,
    zhHans: rows.filter((row) => row.locale === "zh-Hans").length,
    pass: rows.filter((row) => row.status === "PASS").length,
    fail: rows.filter((row) => row.status === "FAIL").length,
    primaryPlacementComplete: rows.filter((row) => Object.entries(row.placements).filter(([key]) => key.startsWith("primary")).every(([, passed]) => passed)).length,
    secondaryEarlyCoverageComplete: rows.filter((row) => row.placements.secondaryInEarlyCopy).length,
    sourceNoiseClean: rows.filter((row) => Object.values(row.sourceNoise).every((count) => count === 0) || (row.sourceNoise.wikisource <= 2 && row.sourceNoise.oldid <= 1 && row.sourceNoise.fixedRevision <= 1 && row.sourceNoise.fixedRevisionZh <= 1 && row.sourceNoise.visibleLineSlug === 0)).length,
    mechanicalStuffingFlags: rows.filter((row) => row.repetition.mechanicalPrimaryRepetition).map((row) => row.url),
    failures,
  };
  await mkdir(OUTPUT_DIR, { recursive: true });
  const jsonPath = `${OUTPUT_DIR}/hexagram-seo-quality.json`;
  const csvPath = `${OUTPUT_DIR}/hexagram-seo-quality.csv`;
  await writeFile(jsonPath, JSON.stringify({ summary, rows }, null, 2) + "\n");
  const columns = ["url", "path", "locale", "number", "primary", "secondaryCore", "bodyTokenCount", "primaryOccurrenceCount", "primaryDensityDiagnostic", "secondaryEarlyMatched", "secondaryCoverage", "variantCoverage", "semanticCoverage", "sourceNoise", "repetition", "brandBodyOccurrences", "status", "failures"];
  const csv = [columns.join(","), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))].join("\n") + "\n";
  await writeFile(csvPath, csv);
  console.log(JSON.stringify({ ...summary, outputJson: jsonPath, outputCsv: csvPath }));
  if (summary.total !== 128 || summary.english !== 64 || summary.zhHans !== 64 || summary.fail > 0) process.exitCode = 1;
}

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
  const hubAnchors = STATIC_BUILD_DIR
    ? [staticHubAnchors("en"), staticHubAnchors("zh-Hans")].flat()
    : [...await snapshotHub(page, "en"), ...await snapshotHub(page, "zh-Hans")];
  const rows = [];
  for (const entry of HEXAGRAM_SEO_REGISTRY) {
    const snapshot = await snapshotPage(page, entry);
    rows.push(auditSnapshot(entry, snapshot, inboundAnchorFor(entry, hubAnchors)));
  }
  await page.close();
  await writeReport(rows);
} finally {
  await browser.close();
}
