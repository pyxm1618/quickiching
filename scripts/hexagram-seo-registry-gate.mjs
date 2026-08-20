import { HEXAGRAM_SEO_REGISTRY, HEXAGRAM_SEO_SOURCE_SHA256 } from "../src/content/hexagrams/seo.ts";
import { CLASSICAL_HEXAGRAMS } from "../src/domain/public-reading/classical.ts";

const expectedSourceSha256 = "c53e446dc0b168bbb459edf11342b58bc67031ca1436e9fc27a92cd58dbd25bc";
const failures = [];
const english = HEXAGRAM_SEO_REGISTRY.filter((entry) => entry.locale === "en");
const chinese = HEXAGRAM_SEO_REGISTRY.filter((entry) => entry.locale === "zh-Hans");

if (HEXAGRAM_SEO_SOURCE_SHA256 !== expectedSourceSha256) {
  failures.push("source hash mismatch: " + HEXAGRAM_SEO_SOURCE_SHA256);
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
}

for (const field of ["canonicalUrl", "finalTitle", "finalDescription", "finalH1"]) {
  const values = HEXAGRAM_SEO_REGISTRY.map((entry) => entry[field]);
  if (new Set(values).size !== 128) failures.push(field + " is not unique across 128 rows");
}

const summary = {
  sourceSha256: HEXAGRAM_SEO_SOURCE_SHA256,
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
