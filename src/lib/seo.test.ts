import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { HOME_DESCRIPTION, HOME_H1, HOME_TITLE, INDEXABLE_PATHS, LEGACY_REDIRECTS, SITE_ORIGIN, absoluteUrl, isPrivateOrCommercialPath } from "./seo";

const THREE_COIN_RESULT_PATH = "/readings/three-coin/result";

describe("Public SEO V1 constants", () => {
  it("locks the approved homepage title, description, H1 and canonical host", () => {
    expect(HOME_TITLE).toBe("I Ching Online — Free Hexagram Reading | Quick I Ching");
    expect(HOME_DESCRIPTION).toBe("Use the I Ching online with three coins, yarrow stalks, or Mei Hua Yi Shu. Cast your hexagram, see changing lines, and get a free basic interpretation.");
    expect(HOME_H1).toBe("I Ching Online — Cast Your Hexagram");
    expect(SITE_ORIGIN).toBe("https://www.quickiching.com");
  });

  it("keeps the sitemap limited to canonical indexable URLs", () => {
    const entries = sitemap();
    expect(entries.map((entry) => entry.url)).toEqual(INDEXABLE_PATHS.map(absoluteUrl));
    expect(entries.every((entry) => entry.url.startsWith(`${SITE_ORIGIN}/`))).toBe(true);
    for (const path of INDEXABLE_PATHS) expect(isPrivateOrCommercialPath(path)).toBe(false);
  });

  it("keeps the Three-Coin product result outside the public SEO URL set", () => {
    expect(INDEXABLE_PATHS).not.toContain(THREE_COIN_RESULT_PATH);
    expect(sitemap().map((entry) => entry.url)).not.toContain(absoluteUrl(THREE_COIN_RESULT_PATH));
    expect(isPrivateOrCommercialPath(THREE_COIN_RESULT_PATH)).toBe(true);
  });

  it("publishes the canonical sitemap in robots without blocking noindex legal pages", () => {
    const policy = robots();
    expect(policy.sitemap).toBe(`${SITE_ORIGIN}/sitemap.xml`);
    expect(policy.host).toBe("www.quickiching.com");
    expect(JSON.stringify(policy.rules)).not.toContain("/privacy");
    expect(JSON.stringify(policy.rules)).not.toContain("/terms");
    expect(JSON.stringify(policy.rules)).toContain("/api/");
  });

  it("maps legacy search intents to relevant destinations instead of a blanket homepage redirect", () => {
    const bySource = new Map(LEGACY_REDIRECTS.map((redirect) => [redirect.source, redirect.destination]));
    expect(bySource.get("/three-coin-method")).toBe("/methods/three-coin");
    expect(bySource.get("/yarrow-stalk-method")).toBe("/methods/yarrow-stalks");
    expect(bySource.get("/mei-hua-yi-shu")).toBe("/methods/mei-hua-yi-shu");
    expect(bySource.get("/cast/yarrow_stalk")).toBe("/methods/yarrow-stalks");
    expect(bySource.get("/cast/mei_hua_current_time")).toBe("/methods/mei-hua-yi-shu");
  });
});
