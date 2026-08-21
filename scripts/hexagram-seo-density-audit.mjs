import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { HEXAGRAM_SEO_REGISTRY } from "../src/content/hexagrams/seo.ts";
import { densityReviewRulingFor } from "../src/content/hexagrams/density-rulings.ts";
import { resolveChromeExecutable } from "./browser-runtime.mjs";

const BASE = process.env.HEXAGRAM_SEO_AUDIT_BASE_URL || process.env.PUBLIC_V1_TEST_BASE_URL || "http://127.0.0.1:3000";
const STATIC_BUILD_DIR = process.env.HEXAGRAM_SEO_AUDIT_STATIC_DIR || "";
const OUTPUT_DIR = process.env.HEXAGRAM_SEO_AUDIT_OUTPUT_DIR || "/tmp/quickiching-hexagram-seo-density";
const CANONICAL_ORIGIN = "https://www.quickiching.com";

function normalize(value) {
  return value.normalize("NFKC");
}

function normalizeForMatch(value) {
  return normalize(value).toLocaleLowerCase("en-US");
}

function splitApprovedPhrases(value) {
  return value
    .split(/[;；]/u)
    .map((phrase) => normalize(phrase.trim()))
    .filter(Boolean);
}

function approvedDensityPhrases(entry) {
  const phrases = [
    entry.primaryKeyword,
    ...splitApprovedPhrases(entry.secondaryCore),
    ...splitApprovedPhrases(entry.secondaryVariantFamily),
    ...splitApprovedPhrases(entry.lineQueryFamily),
    ...splitApprovedPhrases(entry.semanticEntityTerms),
  ];
  if (entry.locale !== "zh-Hans") return phrases;
  // A standalone one-character hexagram label (乾, 坤, etc.) is an entity
  // label, not a Chinese keyword phrase. Keeping it in the protected
  // dictionary would count every occurrence in fixed classical quotations
  // as keyword-family repetition and would make the workbook's soft band
  // measure the source typography rather than page-specific language.
  return phrases.filter((phrase) => [...phrase].length > 1 || !/[\p{Script=Han}]/u.test(phrase));
}

function uniqueLongestFirst(values) {
  return [...new Set(values)]
    .sort((left, right) => right.length - left.length || left.localeCompare(right));
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

function protectedMatches(text, phrases) {
  const haystack = normalizeForMatch(text);
  const normalizedPhrases = uniqueLongestFirst(phrases.map(normalizeForMatch));
  const spans = [];
  let cursor = 0;
  while (cursor < haystack.length) {
    const phrase = normalizedPhrases.find((candidate) => haystack.startsWith(candidate, cursor));
    if (phrase) {
      spans.push({ start: cursor, end: cursor + phrase.length, phrase });
      cursor += phrase.length;
    } else {
      cursor += 1;
    }
  }
  return spans;
}

function unicodeWordTokens(text) {
  return normalize(text).match(/[\p{L}\p{N}]+/gu) ?? [];
}

function chineseTokenCount(text, spans) {
  const masked = Array.from(normalize(text));
  for (const span of spans) {
    for (let index = span.start; index < span.end; index += 1) masked[index] = " ";
  }
  const rest = masked.join("");
  const segmenter = new Intl.Segmenter("zh-Hans", { granularity: "word" });
  const restCount = [...segmenter.segment(rest)].filter((segment) => segment.isWordLike).length;
  return spans.length + restCount;
}

function csvEscape(value) {
  const stringValue = String(value ?? "");
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

function elementWithAttribute(fragment, attribute) {
  const match = fragment.match(new RegExp(`<([a-z0-9]+)\\b[^>]*\\b${attribute}\\b[^>]*>[\\s\\S]*?<\\/\\1>`, "iu"));
  return match?.[0] ?? "";
}

function removeBodyExcludedElements(fragment) {
  let cleaned = fragment;
  for (const tagName of ["nav", "button", "script", "style"]) {
    cleaned = cleaned.replace(new RegExp(`<${tagName}\\b[^>]*>[\\s\\S]*?<\\/${tagName}>`, "giu"), "");
  }
  cleaned = cleaned.replace(/<([a-z0-9]+)\b[^>]*(?:data-legal-disclaimer|data-cookie|aria-hidden=["']true["'])[^>]*>[\s\S]*?<\/\1>/giu, "");
  return cleaned;
}

function extractBalancedElement(html, tagName, requiredAttribute) {
  const openingMatch = html.match(new RegExp(`<${tagName}\\b[^>]*\\b${requiredAttribute}\\b[^>]*>`, "iu"));
  if (!openingMatch || openingMatch.index === undefined) return "";
  const start = openingMatch.index;
  const tagPattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, "giu");
  tagPattern.lastIndex = start;
  let depth = 0;
  for (const match of html.matchAll(tagPattern)) {
    if (match[0].startsWith(`</${tagName}`)) depth -= 1;
    else if (!match[0].endsWith("/>") && !match[0].startsWith(`<!--`)) depth += 1;
    if (depth === 0) return html.slice(start, start + match.index + match[0].length - start);
  }
  return "";
}

function staticSnapshot(html) {
  const root = extractBalancedElement(html, "article", "data-hexagram-detail");
  const metaTags = [...html.matchAll(/<meta\b[^>]*>/giu)].map((match) => match[0]);
  const linkTags = [...html.matchAll(/<link\b[^>]*>/giu)].map((match) => match[0]);
  const metaValue = (attribute, value) => {
    const tag = metaTags.find((candidate) => htmlAttribute(candidate, attribute).toLocaleLowerCase("en-US") === value);
    return tag ? htmlAttribute(tag, "content") : "";
  };
  const alternates = linkTags
    .filter((tag) => htmlAttribute(tag, "rel").toLocaleLowerCase("en-US") === "alternate" && htmlAttribute(tag, "hreflang"))
    .map((tag) => ({ hreflang: htmlAttribute(tag, "hreflang"), href: htmlAttribute(tag, "href") }));
  const jsonLd = elementMatches(html, "script")
    .filter((element) => htmlAttribute(element.match(/^<script\b[^>]*>/iu)?.[0] ?? "", "type") === "application/ld+json")
    .map((element) => {
      try { return JSON.parse(element.replace(/^<script\b[^>]*>/iu, "").replace(/<\/script>$/iu, "")); } catch { return { __parseError: true }; }
    });
  const openingTags = [...root.matchAll(/<[a-z0-9]+\b[^>]*>/giu)].map((match) => match[0]);
  const h1 = elementMatches(root, "h1").map(htmlText);
  const h2 = elementMatches(root, "h2").map(htmlText);
  const canonical = linkTags.find((tag) => htmlAttribute(tag, "rel").toLocaleLowerCase("en-US") === "canonical");
  return {
    bodyText: htmlText(removeBodyExcludedElements(root)),
    title: htmlText(html.match(/<title\b[^>]*>[\s\S]*?<\/title>/iu)?.[0] ?? ""),
    description: metaValue("name", "description"),
    robots: metaValue("name", "robots"),
    canonical: canonical ? htmlAttribute(canonical, "href") : "",
    ogUrl: metaValue("property", "og:url"),
    ogTitle: metaValue("property", "og:title"),
    ogDescription: metaValue("property", "og:description"),
    h1,
    earlyCopy: htmlText(elementWithAttribute(root, "data-seo-early-copy")),
    h2,
    breadcrumb: htmlText(elementWithAttribute(root, "aria-label")),
    lineAnchors: Array.from({ length: 6 }, (_, index) => new RegExp(`\\bid=["']line-${index + 1}["']`, "iu").test(root)),
    alternates,
    htmlLang: html.match(/<html\b[^>]*>/iu)?.[0] ? htmlAttribute(html.match(/<html\b[^>]*>/iu)[0], "lang") : "",
    jsonLd,
    hiddenCount: openingTags.filter((tag) => /\bhidden\b|style=["'][^"']*(?:display|visibility)\s*:/iu.test(tag)).length,
    keywordListCount: openingTags.filter((tag) => /data-(?:keyword-list|seo-keywords)\b/iu.test(tag)).length,
  };
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
  const approvedPhrases = approvedDensityPhrases(entry);
  const matches = protectedMatches(bodyText, approvedPhrases);
  const bodyTokenCount = entry.locale === "zh-Hans"
    ? chineseTokenCount(bodyText, matches)
    : unicodeWordTokens(bodyText).length;
  const primaryOccurrences = countPhraseOccurrences(bodyText, entry.primaryKeyword);
  const familyMatchedCount = matches.length;
  const approvedFamilyBreakdown = Object.entries(matches.reduce((counts, match) => {
    counts[match.phrase] = (counts[match.phrase] ?? 0) + 1;
    return counts;
  }, {})).sort(([, left], [, right]) => right - left);
  const exactPrimaryDensity = primaryOccurrences / Math.max(bodyTokenCount, 1);
  const familyDensity = familyMatchedCount / Math.max(bodyTokenCount, 1);
  const brandOccurrences = countPhraseOccurrences(bodyText, "Quick I Ching") + countPhraseOccurrences(bodyText, "QuickIChing");
  const expectedCanonical = entry.canonicalUrl;
  const alternateMap = Object.fromEntries(snapshot.alternates.map((alternate) => [alternate.hreflang, alternate.href]));
  const inboundAnchorValid = Boolean(inboundAnchor
    && inboundAnchor.sourcePath === hubPathForLocale(entry.locale)
    && new URL(inboundAnchor.href, CANONICAL_ORIGIN).pathname === pagePath(entry)
    && normalizeForMatch(inboundAnchor.text).includes(normalizeForMatch(entry.primaryKeyword)));
  const placement = {
    title: snapshot.title === entry.finalTitle,
    description: snapshot.description === entry.finalDescription,
    robots: /\bindex\b/iu.test(snapshot.robots) && /\bfollow\b/iu.test(snapshot.robots) && !/\bnoindex\b/iu.test(snapshot.robots),
    ogTitle: snapshot.ogTitle === entry.finalTitle,
    ogDescription: snapshot.ogDescription === entry.finalDescription,
    ogUrl: snapshot.ogUrl === expectedCanonical,
    h1: snapshot.h1.length === 1 && snapshot.h1[0] === entry.finalH1,
    earlyCopy: normalizeForMatch(snapshot.earlyCopy).includes(normalizeForMatch(entry.primaryKeyword)),
    h2: snapshot.h2.some((value) => normalizeForMatch(value).includes(normalizeForMatch(entry.primaryKeyword))),
    breadcrumb: normalizeForMatch(snapshot.breadcrumb).includes(normalizeForMatch(entry.primaryKeyword)),
    inboundAnchor: inboundAnchorValid,
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
  const densityBand = familyDensity < entry.familyDensityMin ? "below-3%" : familyDensity > entry.familyDensityMax ? "above-5%" : "within-3%-5%";
  const densityRuling = densityBand === "within-3%-5%" ? null : densityReviewRulingFor(entry.locale, entry.number);
  const hardFailures = [
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
    densityBand !== "within-3%-5%" && !densityRuling ? "density-review:unreviewed" : null,
  ].filter(Boolean);
  const status = hardFailures.length > 0 ? "FAIL" : densityBand === "within-3%-5%" ? "PASS" : "WARN";
  return {
    url: expectedCanonical,
    path: pagePath(entry),
    locale: entry.locale,
    number: entry.number,
    primary: entry.primaryKeyword,
    bodyTokenCount,
    exactPrimaryOccurrenceCount: primaryOccurrences,
    exactPrimaryDensity: Number(exactPrimaryDensity.toFixed(6)),
    approvedFamilyMatchedCount: familyMatchedCount,
    approvedFamilyBreakdown,
    familyDensity: Number(familyDensity.toFixed(6)),
    densityBand,
    brandBodyOccurrences: brandOccurrences,
    placements: placement,
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
    status,
    failures: hardFailures,
    densityRuling: densityRuling ? {
      id: densityRuling.id,
      rationale: densityRuling.rationale,
      groupLocale: densityRuling.locale,
      groupNumbers: densityRuling.numbers,
    } : null,
    densityExplanation: densityRuling?.rationale ?? null,
  };
}

async function writeReport(rows) {
  const outOfBandRows = rows.filter((row) => row.densityBand !== "within-3%-5%");
  const summary = {
    base: BASE,
    staticBuildDir: STATIC_BUILD_DIR || null,
    algorithm: "NFKC; English Unicode letter/number tokens; zh-Hans longest non-overlapping protected phrase matches plus Intl.Segmenter(zh-Hans, word) word-like residual segments; site chrome, JSON-LD, scripts, styles, nav, buttons, and legal disclaimer excluded.",
    total: rows.length,
    records: rows.length === 128,
    pass: rows.filter((row) => row.status === "PASS").length,
    warn: rows.filter((row) => row.status === "WARN").length,
    fail: rows.filter((row) => row.status === "FAIL").length,
    within3To5: rows.filter((row) => row.densityBand === "within-3%-5%").length,
    densityRulingsComplete: outOfBandRows.every((row) => row.densityRuling !== null),
    below3: rows.filter((row) => row.densityBand === "below-3%").map((row) => ({ url: row.url, ruling: row.densityRuling, explanation: row.densityExplanation })),
    above5: rows.filter((row) => row.densityBand === "above-5%").map((row) => ({ url: row.url, ruling: row.densityRuling, explanation: row.densityExplanation })),
    brandOverCap: rows.filter((row) => row.brandBodyOccurrences > 2).map((row) => row.url),
    failures: rows.flatMap((row) => row.failures.map((failure) => ({ url: row.url, failure }))),
  };
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(`${OUTPUT_DIR}/hexagram-seo-density.json`, JSON.stringify({ summary, rows }, null, 2) + "\n");
  const columns = ["url", "path", "locale", "number", "primary", "bodyTokenCount", "exactPrimaryOccurrenceCount", "exactPrimaryDensity", "approvedFamilyMatchedCount", "familyDensity", "densityBand", "brandBodyOccurrences", "status", "failures", "inboundAnchor", "densityRuling", "densityExplanation"];
  const csv = [columns.join(","), ...rows.map((row) => columns.map((column) => csvEscape(Array.isArray(row[column]) ? row[column].join(";") : row[column])).join(","))].join("\n") + "\n";
  await writeFile(`${OUTPUT_DIR}/hexagram-seo-density.csv`, csv);
  console.log(JSON.stringify({ ...summary, outputJson: `${OUTPUT_DIR}/hexagram-seo-density.json`, outputCsv: `${OUTPUT_DIR}/hexagram-seo-density.csv` }));
  if (summary.total !== 128 || summary.fail > 0 || summary.brandOverCap.length > 0 || !summary.densityRulingsComplete) process.exitCode = 1;
}

if (STATIC_BUILD_DIR) {
  const hubAnchors = [staticHubAnchors("en"), staticHubAnchors("zh-Hans")].flat();
  const rows = [];
  for (const entry of HEXAGRAM_SEO_REGISTRY) {
    const html = await readFile(resolve(STATIC_BUILD_DIR, `.${pagePath(entry)}.html`), "utf8");
    rows.push(auditSnapshot(entry, staticSnapshot(html), inboundAnchorFor(entry, hubAnchors)));
  }
  await writeReport(rows);
} else {
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
    const hubAnchors = [...await snapshotHub(page, "en"), ...await snapshotHub(page, "zh-Hans")];
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
}
