import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { HEXAGRAM_SEO_REGISTRY } from "../src/content/hexagrams/seo.ts";
import {
  FAMILY_DENSITY_RANGE,
  PRIMARY_DENSITY_RANGE,
  countExactPhrase,
  evaluateKeywordQuality,
} from "../src/content/hexagrams/seo-quality.ts";
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

function hasExactPhrase(text, phrase, locale) {
  return countExactPhrase(text, phrase, locale) > 0;
}

function coverage(text, phrases, locale) {
  const candidates = unique(phrases.map((phrase) => normalize(phrase.trim())).filter(Boolean));
  const matched = candidates.filter((phrase) => hasExactPhrase(text, phrase, locale));
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

function staticPath(path) {
  return path === "/" ? resolve(STATIC_BUILD_DIR, "./index.html") : resolve(STATIC_BUILD_DIR, `.${path}.html`);
}

function urlForPath(path) {
  if (!STATIC_BUILD_DIR) return `${BASE}${path}`;
  return pathToFileURL(staticPath(path)).href;
}

function pageUrl(entry) {
  return urlForPath(pagePath(entry));
}

function hubPathForLocale(locale) {
  return locale === "zh-Hans" ? "/zh/hexagrams" : "/hexagrams";
}

function inboundAnchorFor(entry, hubAnchors) {
  const targetPath = pagePath(entry);
  return hubAnchors.find((anchor) => {
    const hrefPath = new URL(anchor.href, CANONICAL_ORIGIN).pathname;
    return hrefPath === targetPath && hasExactPhrase(anchor.text, entry.primaryKeyword, entry.locale);
  }) ?? null;
}

function approvedFamilyFor(entry) {
  return unique([
    entry.primaryKeyword,
    ...splitPhrases(entry.secondaryCore),
    ...splitPhrases(entry.secondaryVariantFamily),
    entry.otherCoreVariant,
    entry.meaningKeyword,
    entry.loveKeyword,
    entry.unchangingKeyword,
    entry.relationshipKeyword,
    ...(entry.specialKeywords ?? []),
  ].filter(Boolean));
}

async function snapshotPage(page, entry) {
  const response = await page.goto(pageUrl(entry), {
    waitUntil: "domcontentloaded",
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
    clone.querySelectorAll("nav, button, script, style, [data-seo-exclude], [data-legal-disclaimer], [data-cookie], [aria-hidden=\"true\"], [hidden]").forEach((node) => node.remove());
    const wrapper = document.createElement("div");
    wrapper.style.position = "fixed";
    wrapper.style.left = "-100000px";
    wrapper.style.top = "0";
    wrapper.style.width = "1440px";
    wrapper.append(clone);
    document.body.append(wrapper);
    const bodyText = clone.innerText.replace(/\s+/gu, " ").trim();
    wrapper.remove();
    return {
      bodyText,
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
      h3: [...root.querySelectorAll("h3")].map((node) => node.textContent?.replace(/\s+/gu, " ").trim() ?? ""),
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
      hasLoveModule: root.querySelector("[data-love-module]") !== null,
      hasRelationshipModule: root.querySelector("[data-relationship-module]") !== null,
      specialModules: [...root.querySelectorAll("[data-special-serp-module]")].map((node) => node.getAttribute("data-special-serp-module") ?? ""),
      detailHomeHref: root.querySelector("a[data-seo-home-link]")?.getAttribute("href") ?? "",
      detailHubHref: root.querySelector("a[data-seo-hub-link]")?.getAttribute("href") ?? "",
    };
  });
}

async function snapshotHub(page, locale) {
  const sourcePath = hubPathForLocale(locale);
  const response = await page.goto(urlForPath(sourcePath), {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  if (!STATIC_BUILD_DIR) assert([200, 304].includes(response?.status()), `${sourcePath}: expected 200 or 304, received ${response?.status()}`);
  return page.evaluate((path) => ({
    sourcePath: path,
    homeHref: document.querySelector("main a[data-seo-home-link]")?.getAttribute("href") ?? "",
    anchors: [...document.querySelectorAll("main a[data-seo-inbound-anchor][href]")].map((node) => ({
      sourceUrl: location.href,
      sourcePath: path,
      href: node.getAttribute("href") ?? "",
      primary: node.getAttribute("data-seo-inbound-anchor") ?? "",
      text: node.textContent?.replace(/\s+/gu, " ").trim() ?? "",
    })),
  }), sourcePath);
}

async function snapshotHome(page, locale) {
  const sourcePath = locale === "zh-Hans" ? "/zh" : "/";
  const expectedHub = hubPathForLocale(locale);
  const response = await page.goto(urlForPath(sourcePath), {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  if (!STATIC_BUILD_DIR) assert([200, 304].includes(response?.status()), `${sourcePath}: expected 200 or 304, received ${response?.status()}`);
  return page.evaluate((hubPath) => [...document.querySelectorAll("main a[data-seo-hub-link]")].some((node) => node.getAttribute("href") === hubPath), expectedHub);
}

function auditSnapshot(entry, snapshot, inboundAnchor, siteGraph) {
  assert(snapshot, `${entry.canonicalUrl}: detail root missing from initial HTML`);
  const bodyText = normalize(snapshot.bodyText);
  const approvedFamily = approvedFamilyFor(entry);
  const quality = evaluateKeywordQuality({
    text: bodyText,
    locale: entry.locale,
    primary: entry.primaryKeyword,
    approvedFamily,
  });
  const { measurement } = quality;
  const secondaryPhrases = splitPhrases(entry.secondaryCore);
  const secondaryCoverage = coverage(bodyText, secondaryPhrases, entry.locale);
  const secondaryEarlyMatched = secondaryPhrases.filter((phrase) => hasExactPhrase(snapshot.earlyCopy, phrase, entry.locale));
  const variantCoverage = coverage(
    [bodyText, snapshot.title, snapshot.description, ...snapshot.h1, ...snapshot.h2].join(" "),
    splitPhrases(entry.secondaryVariantFamily).filter((phrase) => normalizeForMatch(phrase) !== normalizeForMatch(entry.primaryKeyword)),
    entry.locale,
  );
  const semanticCoverage = coverage(bodyText, splitPhrases(entry.semanticEntityTerms), entry.locale);
  const brandOccurrences = countExactPhrase(bodyText, "Quick I Ching", entry.locale) + countExactPhrase(bodyText, "QuickIChing", entry.locale);
  const sourceNoise = {
    wikisource: countExactPhrase(bodyText, "Wikisource", entry.locale),
    oldid: countExactPhrase(bodyText, "oldid", entry.locale),
    fixedRevision: countExactPhrase(bodyText, "fixed revision", entry.locale),
    fixedRevisionZh: countExactPhrase(bodyText, "固定修订版", entry.locale),
    visibleLineSlug: normalizeForMatch(bodyText).includes("#line-") ? 1 : 0,
  };
  const expectedCanonical = entry.canonicalUrl;
  const alternateMap = Object.fromEntries(snapshot.alternates.map((alternate) => [alternate.hreflang, alternate.href]));
  const inboundAnchorValid = Boolean(inboundAnchor
    && inboundAnchor.sourcePath === hubPathForLocale(entry.locale)
    && new URL(inboundAnchor.href, CANONICAL_ORIGIN).pathname === pagePath(entry)
    && hasExactPhrase(inboundAnchor.text, entry.primaryKeyword, entry.locale));
  const placement = {
    titleExact: snapshot.title === entry.finalTitle,
    descriptionExact: snapshot.description === entry.finalDescription,
    robots: /\bindex\b/iu.test(snapshot.robots) && /\bfollow\b/iu.test(snapshot.robots) && !/\bnoindex\b/iu.test(snapshot.robots),
    ogTitle: snapshot.ogTitle === entry.finalTitle,
    ogDescription: snapshot.ogDescription === entry.finalDescription,
    ogUrl: snapshot.ogUrl === expectedCanonical,
    h1Exact: snapshot.h1.length === 1 && snapshot.h1[0] === entry.finalH1,
    primaryInTitle: hasExactPhrase(snapshot.title, entry.primaryKeyword, entry.locale),
    primaryInDescription: hasExactPhrase(snapshot.description, entry.primaryKeyword, entry.locale),
    primaryInH1: snapshot.h1.some((value) => hasExactPhrase(value, entry.primaryKeyword, entry.locale)),
    primaryInEarlyCopy: hasExactPhrase(snapshot.earlyCopy, entry.primaryKeyword, entry.locale),
    primaryInH2: snapshot.h2.some((value) => hasExactPhrase(value, entry.primaryKeyword, entry.locale)),
    primaryInBreadcrumb: hasExactPhrase(snapshot.breadcrumb, entry.primaryKeyword, entry.locale),
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
  const expectedHomePath = entry.locale === "zh-Hans" ? "/zh" : "/";
  const expectedHubPath = hubPathForLocale(entry.locale);
  const linkGraph = {
    homeToHub: siteGraph.homeToHub,
    hubToHome: siteGraph.hubHomeHref === expectedHomePath,
    hubToDetail: inboundAnchorValid,
    detailToHub: snapshot.detailHubHref === expectedHubPath,
    detailToHome: snapshot.detailHomeHref === expectedHomePath,
  };
  const modules = {
    love: entry.locale !== "en" || snapshot.hasLoveModule,
    unchanging: snapshot.h2.some((value) => hasExactPhrase(value, entry.unchangingKeyword, entry.locale)),
    relationship: snapshot.hasRelationshipModule === Boolean(entry.relationshipKeyword),
    special: (entry.specialKeywords ?? []).every((phrase) => hasExactPhrase(bodyText, phrase, entry.locale)),
    sixKeywordedLineHeadings: snapshot.h3.filter((value) => hasExactPhrase(value, entry.primaryKeyword, entry.locale)).length >= 6,
  };
  const repetition = {
    mechanicalPrimaryRepetition: mechanicalPrimaryRepetition(bodyText, entry.primaryKeyword),
    exactPrimaryOccurrences: measurement.primaryOccurrences,
    primaryDensity: Number(measurement.primaryDensity.toFixed(6)),
    familyDensity: Number(measurement.familyDensity.toFixed(6)),
  };
  const failures = [
    ...quality.failures,
    ...Object.entries(placement).filter(([, passed]) => !passed).map(([name]) => `placement:${name}`),
    ...Object.entries(linkGraph).filter(([, passed]) => !passed).map(([name]) => `link-graph:${name}`),
    ...Object.entries(modules).filter(([, passed]) => !passed).map(([name]) => `module:${name}`),
    snapshot.canonical !== expectedCanonical ? "canonical" : null,
    snapshot.ogUrl !== expectedCanonical ? "og:url" : null,
    snapshot.htmlLang !== (entry.locale === "zh-Hans" ? "zh-Hans" : "en") ? "html-lang" : null,
    ...Object.entries(hreflang).filter(([, passed]) => !passed).map(([name]) => `hreflang:${name}`),
    ...Object.entries(jsonLd).filter(([, passed]) => !passed).map(([name]) => `json-ld:${name}`),
    ...(!snapshot.lineAnchors.every(Boolean) ? ["line-anchors"] : []),
    snapshot.keywordListCount > 0 ? `keyword-list:${snapshot.keywordListCount}` : null,
    brandOccurrences > entry.brandMentionsInBodyMax ? `brand-body:${brandOccurrences}` : null,
    sourceNoise.wikisource > 0 ? `source-noise:wikisource:${sourceNoise.wikisource}` : null,
    sourceNoise.oldid > 0 ? `source-noise:oldid:${sourceNoise.oldid}` : null,
    sourceNoise.fixedRevision > 0 ? `source-noise:fixed-revision:${sourceNoise.fixedRevision}` : null,
    sourceNoise.fixedRevisionZh > 0 ? `source-noise:fixed-revision-zh:${sourceNoise.fixedRevisionZh}` : null,
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
    approvedFamily,
    bodyTokenCount: measurement.tokenCount,
    primaryOccurrenceCount: measurement.primaryOccurrences,
    familyCoveredTokenCount: measurement.familyCoveredTokens,
    familyDensityBasis: measurement.familyDensityBasis,
    familyMatches: measurement.familyMatches,
    primaryDensity: repetition.primaryDensity,
    familyDensity: repetition.familyDensity,
    densityPolicy: `hard acceptance: Primary ${(PRIMARY_DENSITY_RANGE.min * 100).toFixed(2)}%-${(PRIMARY_DENSITY_RANGE.max * 100).toFixed(2)}%; approved family ${(FAMILY_DENSITY_RANGE.min * 100).toFixed(2)}%-${(FAMILY_DENSITY_RANGE.max * 100).toFixed(2)}%`,
    densityPass: quality.primaryDensityInRange && quality.familyDensityInRange,
    languageContamination: quality.contamination,
    placements: placement,
    linkGraph,
    modules,
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
    algorithm: `Eligible rendered article copy is measured with innerText after removing navigation, source attribution, legal copy, hidden content, scripts, styles, and explicit data-seo-exclude regions. Exact Primary density must be ${(PRIMARY_DENSITY_RANGE.min * 100).toFixed(2)}%-${(PRIMARY_DENSITY_RANGE.max * 100).toFixed(2)}%; longest non-overlapping approved workbook-family coverage must be ${(FAMILY_DENSITY_RANGE.min * 100).toFixed(2)}%-${(FAMILY_DENSITY_RANGE.max * 100).toFixed(2)}%. Both bands, language purity, TDH, modules, and locale link graph are hard gates with no waivers.`,
    total: rows.length,
    records: rows.length === 128,
    english: rows.filter((row) => row.locale === "en").length,
    zhHans: rows.filter((row) => row.locale === "zh-Hans").length,
    pass: rows.filter((row) => row.status === "PASS").length,
    fail: rows.filter((row) => row.status === "FAIL").length,
    primaryPlacementComplete: rows.filter((row) => Object.entries(row.placements).filter(([key]) => key.startsWith("primary")).every(([, passed]) => passed)).length,
    secondaryEarlyCoverageComplete: rows.filter((row) => row.placements.secondaryInEarlyCopy).length,
    primaryDensityComplete: rows.filter((row) => row.primaryDensity >= PRIMARY_DENSITY_RANGE.min && row.primaryDensity <= PRIMARY_DENSITY_RANGE.max).length,
    familyDensityComplete: rows.filter((row) => row.familyDensity >= FAMILY_DENSITY_RANGE.min && row.familyDensity <= FAMILY_DENSITY_RANGE.max).length,
    languagePurityComplete: rows.filter((row) => row.languageContamination.count === 0).length,
    linkGraphComplete: rows.filter((row) => Object.values(row.linkGraph).every(Boolean)).length,
    sourceNoiseClean: rows.filter((row) => Object.values(row.sourceNoise).every((count) => count === 0)).length,
    mechanicalStuffingFlags: rows.filter((row) => row.repetition.mechanicalPrimaryRepetition).map((row) => row.url),
    failures,
  };
  await mkdir(OUTPUT_DIR, { recursive: true });
  const jsonPath = `${OUTPUT_DIR}/hexagram-seo-quality.json`;
  const csvPath = `${OUTPUT_DIR}/hexagram-seo-quality.csv`;
  await writeFile(jsonPath, JSON.stringify({ summary, rows }, null, 2) + "\n");
  const columns = ["url", "path", "locale", "number", "primary", "secondaryCore", "approvedFamily", "bodyTokenCount", "primaryOccurrenceCount", "familyCoveredTokenCount", "primaryDensity", "familyDensity", "densityPass", "languageContamination", "placements", "linkGraph", "modules", "secondaryEarlyMatched", "secondaryCoverage", "variantCoverage", "semanticCoverage", "sourceNoise", "repetition", "brandBodyOccurrences", "status", "failures"];
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
  const englishHub = await snapshotHub(page, "en");
  const chineseHub = await snapshotHub(page, "zh-Hans");
  const siteGraphByLocale = new Map([
    ["en", { homeToHub: await snapshotHome(page, "en"), hubHomeHref: englishHub.homeHref }],
    ["zh-Hans", { homeToHub: await snapshotHome(page, "zh-Hans"), hubHomeHref: chineseHub.homeHref }],
  ]);
  const hubAnchors = [...englishHub.anchors, ...chineseHub.anchors];
  const rows = [];
  for (const entry of HEXAGRAM_SEO_REGISTRY) {
    const snapshot = await snapshotPage(page, entry);
    rows.push(auditSnapshot(entry, snapshot, inboundAnchorFor(entry, hubAnchors), siteGraphByLocale.get(entry.locale)));
  }
  await page.close();
  await writeReport(rows);
} finally {
  let closed = false;
  await Promise.race([
    browser.close().then(() => { closed = true; }).catch(() => {}),
    new Promise((resolveCloseTimeout) => setTimeout(resolveCloseTimeout, 3_000)),
  ]);
  if (!closed) browser.process()?.kill("SIGKILL");
}
