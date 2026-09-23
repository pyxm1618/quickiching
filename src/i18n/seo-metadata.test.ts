import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { ZH_INDEXABLE_PAGE_SEO, zhSeoFor } from "@/content/seo/zh-pages";
import { alternateLanguages, canonicalUrl, sitemapUrlInventory } from "./helpers";
import { ROUTE_REGISTRY } from "./routes";

describe("multilingual metadata and sitemap integration", () => {
  it("publishes 73 English and 73 Chinese canonical URLs from one registry", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toEqual(sitemapUrlInventory());
    expect(urls).toHaveLength(146);
    expect(urls.filter((url) => new URL(url).pathname.startsWith("/zh"))).toHaveLength(73);
    expect(urls.filter((url) => !new URL(url).pathname.startsWith("/zh"))).toHaveLength(73);
    expect(urls).toContain(canonicalUrl("/zh"));
    expect(urls).toContain(canonicalUrl("/zh/methods/three-coin"));
    expect(urls).toContain(canonicalUrl("/zh/methods/yarrow-stalks"));
    expect(urls).toContain(canonicalUrl("/zh/methods/mei-hua-yi-shu"));
    expect(urls).toContain(canonicalUrl("/zh/methods/manual-cast"));
    expect(urls).toContain(canonicalUrl("/zh/guides/how-to-ask-the-i-ching"));
    expect(urls).toContain(canonicalUrl("/zh/guides/changing-lines"));
    expect(urls).toContain(canonicalUrl("/zh/guides/primary-relating-hexagrams"));
    expect(urls).toContain(canonicalUrl("/zh/hexagrams"));
    expect(urls.some((url) => new URL(url).pathname.startsWith("/en"))).toBe(false);
  });

  it("keeps every indexable English route paired with an equivalent Chinese canonical", () => {
    const indexable = ROUTE_REGISTRY.filter((route) => route.indexable.en);
    expect(indexable).toHaveLength(73);
    for (const route of indexable) {
      expect(route.indexable["zh-Hans"], route.id).toBe(true);
      expect(route.paths.en, route.id).toBeDefined();
      expect(route.paths["zh-Hans"], route.id).toMatch(/^\/zh(?:\/|$)/);
      expect(route.hreflangGroup, route.id).toBe(true);
      expect(route.switchable, route.id).toBe(true);
      expect(alternateLanguages(route.id)).toEqual({
        en: canonicalUrl(route.paths.en!),
        "zh-Hans": canonicalUrl(route.paths["zh-Hans"]!),
        "x-default": canonicalUrl(route.paths.en!),
      });
    }
  });

  it("drives all nine non-hexagram Chinese SEO pages from the Chinese SEO registry", async () => {
    expect(Object.keys(ZH_INDEXABLE_PAGE_SEO)).toHaveLength(9);
    const home = await import("@/app/(localized)/zh/page");
    const threeCoin = await import("@/app/(localized)/zh/methods/three-coin/page");
    const yarrow = await import("@/app/(localized)/zh/methods/yarrow-stalks/page");
    const meiHua = await import("@/app/(localized)/zh/methods/mei-hua-yi-shu/page");
    const manual = await import("@/app/(localized)/zh/methods/manual-cast/page");
    const ask = await import("@/app/(localized)/zh/guides/how-to-ask-the-i-ching/page");
    const changing = await import("@/app/(localized)/zh/guides/changing-lines/page");
    const primaryRelating = await import("@/app/(localized)/zh/guides/primary-relating-hexagrams/page");
    const hub = await import("@/app/(localized)/zh/hexagrams/page");

    expect(home.metadata.title).toEqual({ absolute: zhSeoFor("homepage").finalTitle });
    expect(threeCoin.metadata.title).toEqual({ absolute: zhSeoFor("three-coin-method").finalTitle });
    expect(yarrow.metadata.title).toEqual({ absolute: zhSeoFor("yarrow-stalks-method").finalTitle });
    expect(meiHua.generateMetadata().title).toEqual({ absolute: zhSeoFor("mei-hua-yi-shu").finalTitle });
    expect(manual.metadata.title).toEqual({ absolute: zhSeoFor("manual-cast-method").finalTitle });
    expect(ask.metadata.title).toEqual({ absolute: zhSeoFor("guides-how-to-ask").finalTitle });
    expect(changing.metadata.title).toEqual({ absolute: zhSeoFor("guides-changing-lines").finalTitle });
    expect(primaryRelating.metadata.title).toEqual({ absolute: zhSeoFor("guides-primary-relating").finalTitle });
    expect(hub.metadata.title).toEqual({ absolute: zhSeoFor("hexagrams-hub").finalTitle });
  });

  it("keeps English homepage and Mei Hua alternates unchanged while adding reciprocal Chinese equivalents", async () => {
    const englishHome = await import("@/app/(default)/page");
    const englishMeiHua = await import("@/app/(default)/methods/mei-hua-yi-shu/page");
    expect(englishHome.metadata.alternates).toMatchObject({ canonical: canonicalUrl("/") });
    expect(englishHome.metadata.alternates?.languages).toEqual(alternateLanguages("homepage"));
    expect(englishMeiHua.metadata.alternates?.languages).toEqual(alternateLanguages("mei-hua-yi-shu"));
  });
});
