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

    const standaloneRoutes = ["/history", "/privacy", "/terms", "/acceptable-use", "/help"];
    for (const path of standaloneRoutes) expect(currentRouteForPath(path)).toBeUndefined();
  });

  it("ensures Chinese navigation labels contain natural simplified Chinese and no fake English labels", () => {
    const nav = ZH_HANS_UI_DICTIONARY.nav;
    expect(nav.meiHua).toBe("梅花易数");
    expect(nav.hexagrams).toBe("易经卦库");
    expect(nav.home).toBe("中文首页");
    expect(nav.drawerTitle).toBe("菜单");
    expect(nav.languageLabel).toBe("语言");

    // Must not contain "英文 xxx" in Chinese primary nav
    expect(nav.meiHua.includes("英文")).toBe(false);
    expect(nav.hexagrams.includes("英文")).toBe(false);

    // English dictionary checks
    expect(EN_UI_DICTIONARY.nav.methods).toBe("Methods");
    expect(EN_UI_DICTIONARY.nav.guides).toBe("Guides");
    expect(EN_UI_DICTIONARY.nav.hexagrams).toBe("64 Hexagrams");
  });

  it("ensures Chinese footer labels are fully localized", () => {
    const footer = ZH_HANS_UI_DICTIONARY.footer;
    expect(footer.meiHua).toBe("梅花易数起卦");
    expect(footer.hexagrams).toBe("简体中文易经卦库");
    expect(footer.privacy).toBe("隐私政策");
    expect(footer.terms).toBe("服务条款");
    expect(footer.acceptableUse).toBe("使用规范");
    expect(footer.help).toBe("帮助支持");
  });
});
