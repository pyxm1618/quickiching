import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

const BASE = process.env.PUBLIC_V1_TEST_BASE_URL || "http://127.0.0.1:3000";
const LABEL = process.env.SEO_AUDIT_LABEL || "CURRENT";
const ASSERT_SEMANTICS = process.env.SEO_AUDIT_ASSERT === "1";
const HOME_TITLE = "I Ching Online — Free Hexagram Reading | Quick I Ching";
const HOME_DESCRIPTION = "Use the I Ching online with three coins, yarrow stalks, or Mei Hua Yi Shu. Cast your hexagram, see changing lines, and get a free basic interpretation.";
const HOME_H1 = "I Ching Online — Cast Your Hexagram";
const WEBSITE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Quick I Ching",
  url: "https://www.quickiching.com/",
};
const PHRASES = [
  "i ching",
  "i ching online",
  "i ching reading",
  "online i ching reading",
  "i ching casting",
  "i ching hexagram",
  "changing lines",
  "relating hexagram",
  "three coin",
  "yarrow",
  "mei hua yi shu",
];
const ENTITIES = [
  "i ching",
  "reading",
  "hexagram",
  "changing lines",
  "relating hexagram",
  "three coin",
  "yarrow",
  "mei hua yi shu",
];

function tokenize(text) {
  return text.toLowerCase().match(/[a-z0-9]+(?:['’][a-z0-9]+)?/g) ?? [];
}

function countPhrase(words, phrase) {
  const wanted = tokenize(phrase);
  if (wanted.length === 0 || wanted.length > words.length) return 0;
  let count = 0;
  for (let index = 0; index <= words.length - wanted.length; index += 1) {
    if (wanted.every((word, offset) => words[index + offset] === word)) count += 1;
  }
  return count;
}

function topNgrams(words, size, limit = 12) {
  const counts = new Map();
  for (let index = 0; index <= words.length - size; index += 1) {
    const phrase = words.slice(index, index + size).join(" ");
    counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([phrase, count]) => ({ phrase, count }));
}

function stripGeneratedContent(value) {
  if (!value || value === "none" || value === "normal") return "";
  return value.replace(/^['"]|['"]$/g, "");
}

const executablePath = process.env.CHROME_PATH || await chromium.executablePath();
const usingSystemChrome = Boolean(process.env.CHROME_PATH);
const browser = await puppeteer.launch({
  args: usingSystemChrome ? ["--no-sandbox", "--disable-dev-shm-usage"] : [...chromium.args, "--disable-dev-shm-usage"],
  executablePath,
  headless: true,
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(BASE, { waitUntil: "networkidle0", timeout: 30_000 });

  const snapshot = await page.evaluate(() => {
    for (const details of document.querySelectorAll("details")) details.open = true;

    const decorativeNodes = [...document.querySelectorAll(".ritual-coin-char, .ritual-coin-mint")].map((node) => ({
      text: node.textContent ?? "",
      label: node.getAttribute("data-visual-label") ?? "",
      generated: getComputedStyle(node, "::before").content,
    }));
    const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((node) => node.textContent?.trim() ?? "");
    const schemas = [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap((node) => {
      try {
        return [JSON.parse(node.textContent ?? "")];
      } catch {
        return [];
      }
    });

    return {
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
      h1: [...document.querySelectorAll("h1")].map((node) => node.textContent?.trim() ?? ""),
      bodyText: document.body?.innerText ?? "",
      heroText: document.querySelector(".home-oracle > section p.mt-7")?.textContent?.trim() ?? "",
      decorativeNodes,
      headings,
      schemas,
    };
  });

  const words = tokenize(snapshot.bodyText);
  const exactCount = countPhrase(words, "i ching online");
  const decorativeDomTextNodes = snapshot.decorativeNodes.filter((node) => node.text.trim()).length;
  const report = {
    label: LABEL,
    url: BASE,
    tokenizer: "lowercase ASCII/alphanumeric words with apostrophes; punctuation and hyphens split tokens",
    visibleWords: words.length,
    exactPhrase: {
      phrase: "i ching online",
      occurrences: exactCount,
      densityPct: Number(((exactCount / Math.max(words.length, 1)) * 100).toFixed(3)),
    },
    decorativeDomTextNodes,
    phraseCluster: Object.fromEntries(PHRASES.map((phrase) => [phrase, countPhrase(words, phrase)])),
    entities: Object.fromEntries(ENTITIES.map((phrase) => [phrase, countPhrase(words, phrase)])),
    topNgrams: Object.fromEntries([1, 2, 3, 4, 5].map((size) => [`${size}word`, topNgrams(words, size)])),
  };

  console.log(`[Homepage SEO Audit] ${LABEL} ${JSON.stringify(report)}`);

  if (ASSERT_SEMANTICS) {
    assert.equal(snapshot.title, HOME_TITLE, "Homepage title changed from the locked value");
    assert.equal(snapshot.description, HOME_DESCRIPTION, "Homepage description changed from the locked value");
    assert.deepEqual(snapshot.h1, [HOME_H1], "Homepage must have exactly one locked H1");
    assert(snapshot.heroText.toLowerCase().includes("i ching online"), "Hero copy must retain the homepage primary phrase");
    assert(exactCount > 0, "Homepage visible text must contain i ching online");
    assert(snapshot.decorativeNodes.length > 0, "Decorative coin nodes are missing");
    assert.equal(decorativeDomTextNodes, 0, "Decorative coin labels must not exist as DOM text nodes");
    for (const node of snapshot.decorativeNodes) {
      assert.equal(node.text.trim(), "", `Decorative coin node leaked DOM text: ${node.text}`);
      assert(node.label, "Decorative coin visual label is missing");
      assert.equal(stripGeneratedContent(node.generated), node.label, `Decorative generated content mismatch for ${node.label}`);
    }
    assert(!snapshot.headings.some((heading) => /^Line \d(?: sealed| awaiting cast)?$/i.test(heading)), "Three-Coin UI status leaked into the heading tree");
    assert(
      snapshot.schemas.some((schema) => JSON.stringify(schema) === JSON.stringify(WEBSITE_SCHEMA)),
      "Homepage WebSite JSON-LD is missing or does not match the minimal locked schema",
    );
  }
} finally {
  await browser.close();
}
