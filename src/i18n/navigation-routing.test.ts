import { describe, expect, it } from "vitest";
import { CLASSICAL_HEXAGRAMS } from "@/domain/public-reading/classical";
import { EN_UI_DICTIONARY } from "./dictionaries/en";
import { ZH_HANS_UI_DICTIONARY } from "./dictionaries/zh-Hans";
import { alternateLanguages, currentRouteForPath, languageSwitchTarget } from "./helpers";
import { ROUTE_REGISTRY } from "./routes";

describe("Navigation and multi-language routing contract", () => {
  it("maps all 64 hexagram detail pairs (128 total pages) symmetrically", () => {
    expect(CLASSICAL_HEXAGRAMS).toHaveLength(64);

    for (const hexagram of CLASSICAL_HEXAGRAMS) {
      const enPath = `/hexagrams/${hexagram.slug}`;
      const zhPath = `/zh/hexagrams/${hexagram.slug}`;

      const enRoute = currentRouteForPath(enPath);
      const zhRoute = currentRouteForPath(zhPath);

      expect(enRoute, `English route missing for ${enPath}`).toBeDefined();
      expect(zhRoute, `Chinese route missing for ${zhPath}`).toBeDefined();
      expect(enRoute?.id).toBe(`hexagram:${hexagram.slug}`);
      expect(zhRoute?.id).toBe(`hexagram:${hexagram.slug}`);

      const switchFromEn = languageSwitchTarget(enRoute!.id, "en");
      expect(switchFromEn).toEqual({
        href: zhPath,
        label: "简体中文",
        equivalent: true,
      });

      const switchFromZh = languageSwitchTarget(zhRoute!.id, "zh-Hans");
      expect(switchFromZh).toEqual({
        href: enPath,
        label: "English",
        equivalent: true,
      });

      const alternates = alternateLanguages(enRoute!.id);
      expect(alternates).toEqual({
        en: `https://www.quickiching.com${enPath}`,
        "zh-Hans": `https://www.quickiching.com${zhPath}`,
        "x-default": `https://www.quickiching.com${enPath}`,
      });
    }
  });

  it("maps core hub and homepage routes symmetrically", () => {
    const pairs: Array<[string, string, string]> = [
      ["homepage", "/", "/zh"],
      ["three-coin-method", "/methods/three-coin", "/zh/methods/three-coin"],
      ["yarrow-stalks-method", "/methods/yarrow-stalks", "/zh/methods/yarrow-stalks"],
      ["mei-hua-yi-shu", "/methods/mei-hua-yi-shu", "/zh/methods/mei-hua-yi-shu"],
      ["manual-cast-method", "/methods/manual-cast", "/zh/methods/manual-cast"],
      ["guides-how-to-ask", "/guides/how-to-ask-the-i-ching", "/zh/guides/how-to-ask-the-i-ching"],
      ["guides-changing-lines", "/guides/changing-lines", "/zh/guides/changing-lines"],
      ["guides-primary-relating", "/guides/primary-relating-hexagrams", "/zh/guides/primary-relating-hexagrams"],
      ["hexagrams-hub", "/hexagrams", "/zh/hexagrams"],
    ];

    for (const [routeId, enPath, zhPath] of pairs) {
      const enRoute = currentRouteForPath(enPath);
      const zhRoute = currentRouteForPath(zhPath);

      expect(enRoute?.id).toBe(routeId);
      expect(zhRoute?.id).toBe(routeId);

      expect(languageSwitchTarget(routeId, "en")).toEqual({
        href: zhPath,
        label: "简体中文",
        equivalent: true,
      });
      expect(languageSwitchTarget(routeId, "zh-Hans")).toEqual({
        href: enPath,
        label: "English",
        equivalent: true,
      });

      expect(alternateLanguages(routeId)).toEqual({
        en: `https://www.quickiching.com${enPath}`,
        "zh-Hans": `https://www.quickiching.com${zhPath}`,
        "x-default": `https://www.quickiching.com${enPath}`,
      });
    }
  });

  it("keeps all canonical SEO routes bidirectionally switchable", () => {
    const seoRoutes = ROUTE_REGISTRY.filter((route) => route.indexable.en);
    expect(seoRoutes).toHaveLength(73);
    expect(seoRoutes.every((route) => route.paths["zh-Hans"]?.startsWith("/zh") === true)).toBe(true);
    expect(seoRoutes.every((route) => route.hreflangGroup && route.switchable)).toBe(true);

    const noindexInfoRoutes = [
      ["help", "/help", "/zh/help"],
      ["privacy", "/privacy", "/zh/privacy"],
      ["terms", "/terms", "/zh/terms"],
      ["acceptable-use", "/acceptable-use", "/zh/acceptable-use"],
    ] as const;
    for (const [routeId, enPath, zhPath] of noindexInfoRoutes) {
      expect(currentRouteForPath(enPath)?.id).toBe(routeId);
      expect(currentRouteForPath(zhPath)?.id).toBe(routeId);
      expect(languageSwitchTarget(routeId, "en")).toEqual({ href: zhPath, label: "简体中文", equivalent: true });
      expect(languageSwitchTarget(routeId, "zh-Hans")).toEqual({ href: enPath, label: "English", equivalent: true });
    }
  });

  it("keeps shared bilingual language and account copy localized after retiring old navigation dictionaries", () => {
    expect("nav" in ZH_HANS_UI_DICTIONARY).toBe(false);
    expect("footer" in ZH_HANS_UI_DICTIONARY).toBe(false);
    expect("nav" in EN_UI_DICTIONARY).toBe(false);
    expect("footer" in EN_UI_DICTIONARY).toBe(false);
    expect(ZH_HANS_UI_DICTIONARY.language.currentLanguage).toBe("简体中文");
    expect(ZH_HANS_UI_DICTIONARY.language.selectLanguage).toBe("选择语言");
    expect(ZH_HANS_UI_DICTIONARY.userNav.account).toBe("我的账户");
    expect(EN_UI_DICTIONARY.language.currentLanguage).toBe("English");
    expect(EN_UI_DICTIONARY.language.selectLanguage).toBe("Select language");
    expect(EN_UI_DICTIONARY.userNav.account).toBe("My Account");
  });

});
