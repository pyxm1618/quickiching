import {
  HEXAGRAM_SEO_EN_SOURCE_SHA256,
  HEXAGRAM_SEO_REGISTRY,
  HEXAGRAM_SEO_ZH_SOURCE_SHA256,
} from "../src/content/hexagrams/seo.ts";
import { CLASSICAL_HEXAGRAMS } from "../src/domain/public-reading/classical.ts";

const expectedEnglishSourceSha256 = "3924004150cc6190481a02257dd9e90731134cef417189c1b1e4a87e96da9a73";
const expectedChineseSourceSha256 = "c53e446dc0b168bbb459edf11342b58bc67031ca1436e9fc27a92cd58dbd25bc";
const failures = [];
const english = HEXAGRAM_SEO_REGISTRY.filter((entry) => entry.locale === "en");
const chinese = HEXAGRAM_SEO_REGISTRY.filter((entry) => entry.locale === "zh-Hans");

if (HEXAGRAM_SEO_EN_SOURCE_SHA256 !== expectedEnglishSourceSha256) {
  failures.push("English source hash mismatch: " + HEXAGRAM_SEO_EN_SOURCE_SHA256);
}
if (HEXAGRAM_SEO_ZH_SOURCE_SHA256 !== expectedChineseSourceSha256) {
  failures.push("Chinese source hash mismatch: " + HEXAGRAM_SEO_ZH_SOURCE_SHA256);
}
if (english.length !== 64 || chinese.length !== 64) {
  failures.push("locale row count mismatch: en=" + english.length + " zh=" + chinese.length);
}

for (const classical of CLASSICAL_HEXAGRAMS) {
  const en = english.find((entry) => entry.number === classical.number);
  const zh = chinese.find((entry) => entry.number === classical.number);
  if (!en || !zh) {
    failures.push("missing locale pair for hexagram " + classical.number);
    continue;
  }
  if (en.slug !== classical.slug || zh.slug !== classical.slug) {
    failures.push("slug mismatch for hexagram " + classical.number);
  }
  if (en.canonicalUrl !== "https://www.quickiching.com/hexagrams/" + classical.slug) {
    failures.push("English canonical mismatch for " + classical.number);
  }
  if (zh.canonicalUrl !== "https://www.quickiching.com/zh/hexagrams/" + classical.slug) {
    failures.push("Chinese canonical mismatch for " + classical.number);
  }
  if (en.primaryKeyword !== "hexagram " + classical.number) {
    failures.push("English Primary mismatch for " + classical.number + ": " + en.primaryKeyword);
  }
  if (en.finalTitle !== "I Ching Hexagram " + classical.number + ": " + en.hexagramName + " — Meaning, Love & Unchanging") {
    failures.push("English Title mismatch for " + classical.number);
  }
  if (en.finalH1 !== "Hexagram " + classical.number + " — " + en.hexagramName) {
    failures.push("English H1 mismatch for " + classical.number);
  }
  if (en.finalDescription.length < 100 || en.finalDescription.length > 160) {
    failures.push("English Description length out of range for " + classical.number + ": " + en.finalDescription.length);
  }
  const description = en.finalDescription.toLocaleLowerCase("en-US");
  if (!description.includes("hexagram " + classical.number) || !description.includes("love") || !description.includes("unchanging")) {
    failures.push("English Description intent mismatch for " + classical.number);
  }
}

for (const field of ["canonicalUrl", "finalTitle", "finalDescription", "finalH1"]) {
  const values = HEXAGRAM_SEO_REGISTRY.map((entry) => entry[field]);
  if (new Set(values).size !== 128) failures.push(field + " is not unique across 128 rows");
}

const summary = {
  englishSourceSha256: HEXAGRAM_SEO_EN_SOURCE_SHA256,
  chineseSourceSha256: HEXAGRAM_SEO_ZH_SOURCE_SHA256,
  total: HEXAGRAM_SEO_REGISTRY.length,
  english: english.length,
  zhHans: chinese.length,
  uniqueCanonicalUrls: new Set(HEXAGRAM_SEO_REGISTRY.map((entry) => entry.canonicalUrl)).size,
  uniqueTitles: new Set(HEXAGRAM_SEO_REGISTRY.map((entry) => entry.finalTitle)).size,
  uniqueDescriptions: new Set(HEXAGRAM_SEO_REGISTRY.map((entry) => entry.finalDescription)).size,
  uniqueH1s: new Set(HEXAGRAM_SEO_REGISTRY.map((entry) => entry.finalH1)).size,
  failures,
};
console.log(JSON.stringify(summary));
if (failures.length > 0) process.exit(1);
