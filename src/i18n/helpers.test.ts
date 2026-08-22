import { describe, expect, it } from "vitest";
import {
  ACTIVE_CONTENT_LOCALES,
  contentLocaleForPublicSegment,
  localeDefinition,
  type ContentLocale,
} from "./config";
import {
  ENGLISH_INDEXABLE_PATHS,
  localizedRoute,
  routeForPath,
  ROUTE_REGISTRY,
} from "./routes";
import {
  alternateLanguages,
  canonicalUrl,
  indexablePathInventory,
  languageSwitchTarget,
  publicPath,
  sitemapUrlInventory,
} from "./helpers";

describe("multilingual locale registry", () => {
  it("exposes only English and Simplified Chinese internal locales", () => {
    expect(ACTIVE_CONTENT_LOCALES).toEqual(["en", "zh-Hans"]);
    expect(localeDefinition("en")).toMatchObject({ publicSegment: "", htmlLang: "en", hreflang: "en" });
    expect(localeDefinition("zh-Hans")).toMatchObject({ publicSegment: "zh", htmlLang: "zh-Hans", hreflang: "zh-Hans" });
    expect(contentLocaleForPublicSegment("zh")).toBe("zh-Hans");
    expect(contentLocaleForPublicSegment("zh-Hans")).toBeNull();
    expect(contentLocaleForPublicSegment("fr")).toBeNull();
  });

  it("uses an unprefixed English path and the public zh segment", () => {
    const paths: Array<[ContentLocale, string, string]> = [
      ["en", "/", "/"],
      ["en", "/methods/mei-hua-yi-shu", "/methods/mei-hua-yi-shu"],
      ["zh-Hans", "/", "/zh"],
      ["zh-Hans", "/methods/mei-hua-yi-shu", "/zh/methods/mei-hua-yi-shu"],
    ];
    for (const [locale, source, expected] of paths) expect(publicPath(locale, source)).toBe(expected);
    expect(publicPath("zh-Hans", "/methods/mei-hua-yi-shu/")).toBe("/zh/methods/mei-hua-yi-shu");
  });

  it("registers paired English and Chinese detail pages plus a Chinese Hub", () => {
    expect(localizedRoute("homepage")).toMatchObject({
      paths: { en: "/", "zh-Hans": "/zh" },
      renderable: { en: true, "zh-Hans": true },
      indexable: { en: true, "zh-Hans": true },
      hreflangGroup: true,
      switchable: true,
    });
    expect(localizedRoute("mei-hua-yi-shu").paths["zh-Hans"]).toBe("/zh/methods/mei-hua-yi-shu");
    expect(localizedRoute("three-coin-method").paths["zh-Hans"]).toBeUndefined();
    expect(localizedRoute("hexagrams-hub")).toMatchObject({
      paths: { en: "/hexagrams", "zh-Hans": "/zh/hexagrams" },
      renderable: { en: true, "zh-Hans": true },
      indexable: { en: true, "zh-Hans": true },
      hreflangGroup: true,
      switchable: true,
    });
    const detailRoutes = ROUTE_REGISTRY.filter((route) => route.id.startsWith("hexagram:"));
    expect(detailRoutes).toHaveLength(64);
    expect(detailRoutes.every((route) => route.hreflangGroup && route.switchable)).toBe(true);
    expect(detailRoutes.every((route) => route.paths["zh-Hans"]?.startsWith("/zh/hexagrams/") === true)).toBe(true);
  });

  it("creates self-canonical bidirectional alternates only for equivalent pages", () => {
    expect(canonicalUrl("/zh")).toBe("https://www.quickiching.com/zh");
    expect(canonicalUrl("/methods/mei-hua-yi-shu/")).toBe("https://www.quickiching.com/methods/mei-hua-yi-shu");
    expect(alternateLanguages("homepage")).toEqual({
      en: "https://www.quickiching.com/",
      "zh-Hans": "https://www.quickiching.com/zh",
      "x-default": "https://www.quickiching.com/",
    });
    expect(alternateLanguages("mei-hua-yi-shu")).toEqual({
      en: "https://www.quickiching.com/methods/mei-hua-yi-shu",
      "zh-Hans": "https://www.quickiching.com/zh/methods/mei-hua-yi-shu",
      "x-default": "https://www.quickiching.com/methods/mei-hua-yi-shu",
    });
    expect(alternateLanguages("three-coin-method")).toBeUndefined();
    expect(alternateLanguages("hexagram:1-the-creative")).toEqual({
      en: "https://www.quickiching.com/hexagrams/1-the-creative",
      "zh-Hans": "https://www.quickiching.com/zh/hexagrams/1-the-creative",
      "x-default": "https://www.quickiching.com/hexagrams/1-the-creative",
    });
    expect(languageSwitchTarget("hexagram:1-the-creative", "en")).toEqual({
      href: "/zh/hexagrams/1-the-creative",
      label: "简体中文",
      equivalent: true,
    });
    expect(languageSwitchTarget("hexagram:1-the-creative", "zh-Hans")).toEqual({
      href: "/hexagrams/1-the-creative",
      label: "English",
      equivalent: true,
    });
  });

  it("resolves language switches without inventing Chinese equivalents", () => {
    expect(languageSwitchTarget("homepage", "en")).toEqual({ href: "/zh", label: "简体中文", equivalent: true });
    expect(languageSwitchTarget("homepage", "zh-Hans")).toEqual({ href: "/", label: "English", equivalent: true });
    expect(languageSwitchTarget("three-coin-method", "en")).toEqual({ href: "/zh", label: "中文首页", equivalent: false });
    expect(routeForPath("/zh/methods/mei-hua-yi-shu")?.id).toBe("mei-hua-yi-shu");
    expect(routeForPath("/fr")?.id).toBeUndefined();
  });

  it("derives a unique sitemap inventory from the registry", () => {
    expect(ENGLISH_INDEXABLE_PATHS).toHaveLength(73);
    expect(ENGLISH_INDEXABLE_PATHS.filter((path) => path.startsWith("/hexagrams/")).length).toBe(64);
    expect(indexablePathInventory()).toHaveLength(140);
    expect(sitemapUrlInventory()).toHaveLength(140);
    expect(indexablePathInventory()).toContain("/zh");
    expect(indexablePathInventory()).toContain("/zh/methods/mei-hua-yi-shu");
    expect(indexablePathInventory()).toContain("/zh/hexagrams");
    expect(indexablePathInventory()).toContain("/zh/hexagrams/1-the-creative");
    for (let number = 1; number <= 64; number += 1) {
      expect(routeForPath(`/hexagrams/${number}`)).toBeUndefined();
      expect(routeForPath(`/zh/hexagrams/${number}`)).toBeUndefined();
      expect(routeForPath(`/hexagrams/${number}-line-1`)).toBeUndefined();
      expect(routeForPath(`/zh/hexagrams/${number}-line-1`)).toBeUndefined();
    }
    expect(indexablePathInventory()).toHaveLength(new Set(indexablePathInventory()).size);
    for (const path of indexablePathInventory()) {
      expect(path === "/" || !path.endsWith("/")).toBe(true);
      expect(path.startsWith("/en")).toBe(false);
    }
    expect(sitemapUrlInventory()).toEqual(indexablePathInventory().map((path) => canonicalUrl(path)));
  });
});
