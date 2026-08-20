import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { alternateLanguages, canonicalUrl, sitemapUrlInventory } from "./helpers";

describe("multilingual metadata and sitemap integration", () => {
  it("publishes the registry inventory rather than a hand-maintained English-only sitemap", () => {
    expect(sitemap().map((entry) => entry.url)).toEqual(sitemapUrlInventory());
    expect(sitemap()).toHaveLength(75);
    expect(sitemap().map((entry) => entry.url)).toContain(canonicalUrl("/zh"));
    expect(sitemap().map((entry) => entry.url)).toContain(canonicalUrl("/zh/methods/mei-hua-yi-shu"));
    expect(sitemap().map((entry) => entry.url).some((url) => url.includes("/en"))).toBe(false);
  });

  it("keeps equivalent English and Chinese pages on one alternate-language set", async () => {
    const englishHome = await import("@/app/(default)/page");
    const englishMeiHua = await import("@/app/(default)/methods/mei-hua-yi-shu/page");
    const chineseHome = await import("@/app/(localized)/zh/page");
    const chineseMeiHua = await import("@/app/(localized)/zh/methods/mei-hua-yi-shu/page");

    expect(englishHome.metadata.alternates).toMatchObject({ canonical: canonicalUrl("/") });
    expect(englishHome.metadata.alternates?.languages).toEqual(alternateLanguages("homepage"));
    expect(englishMeiHua.metadata.alternates?.languages).toEqual(alternateLanguages("mei-hua-yi-shu"));
    expect(chineseHome.generateMetadata().alternates?.languages).toEqual(alternateLanguages("homepage"));
    expect(chineseMeiHua.generateMetadata().alternates?.languages).toEqual(alternateLanguages("mei-hua-yi-shu"));
  });

  it("renders the Chinese Mei Hua title with the brand exactly once", async () => {
    const chineseMeiHua = await import("@/app/(localized)/zh/methods/mei-hua-yi-shu/page");
    const metadata = chineseMeiHua.generateMetadata();
    expect(metadata.title).toEqual({ absolute: "梅花易数公历适配版｜在线起卦 | Quick I Ching" });
  });
});
