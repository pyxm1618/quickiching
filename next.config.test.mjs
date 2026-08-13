import { describe, expect, it } from "vitest";
import nextConfig, { buildContentSecurityPolicy } from "./next.config.mjs";

describe("Next.js redirect policy", () => {
  it("permanently redirects the bare domain and named Vercel alias to www", async () => {
    const redirects = await nextConfig.redirects();
    const bare = redirects.find((redirect) => redirect.has?.some((condition) => condition.type === "host" && condition.value === "quickiching.com"));
    const alias = redirects.find((redirect) => redirect.has?.some((condition) => condition.type === "host" && condition.value === "ichingcoin.vercel.app"));
    expect(bare).toMatchObject({ destination: "https://www.quickiching.com/:path*", permanent: true });
    expect(alias).toMatchObject({ destination: "https://www.quickiching.com/:path*", permanent: true });
  });

  it("uses permanent relevant redirects for every known legacy route", async () => {
    const redirects = await nextConfig.redirects();
    const expected = new Map([
      ["/i-ching-coin", "/methods/three-coin"],
      ["/three-coin-method", "/methods/three-coin"],
      ["/yarrow-stalk-method", "/methods/yarrow-stalks"],
      ["/mei-hua-yi-shu", "/methods/mei-hua-yi-shu"],
      ["/how-to-ask-the-i-ching", "/guides/how-to-ask-the-i-ching"],
      ["/changing-lines", "/guides/changing-lines"],
      ["/primary-and-relating-hexagrams", "/guides/primary-relating-hexagrams"],
      ["/cast/three_coin", "/"],
      ["/cast/yarrow_stalk", "/methods/yarrow-stalks"],
      ["/cast/mei_hua_current_time", "/methods/mei-hua-yi-shu"],
    ]);
    for (const [source, destination] of expected) {
      expect(redirects.find((redirect) => redirect.source === source)).toMatchObject({ destination, permanent: true });
    }
  });
});

describe("Next.js security headers", () => {
  it("allows only the external origins required by GA4 and Microsoft Clarity by default", async () => {
    const headerGroups = await nextConfig.headers();
    const globalHeaders = headerGroups.find((group) => group.source === "/:path*")?.headers ?? [];
    const csp = globalHeaders.find((header) => header.key === "Content-Security-Policy")?.value;

    expect(csp).toContain("script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://*.clarity.ms");
    expect(csp).toContain("https://*.google-analytics.com");
    expect(csp).toContain("https://*.analytics.google.com");
    expect(csp).toContain("https://c.bing.com");
    expect(csp).not.toContain("effectivecpmnetwork.com");
  });

  it("adds only the reviewed Adsterra script origin when the feature flag is enabled", () => {
    const csp = buildContentSecurityPolicy({ NEXT_PUBLIC_ADSTERRA_ENABLED: "true" });

    expect(csp).toContain("script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://*.clarity.ms https://pl30822164.effectivecpmnetwork.com");
    expect(csp).not.toContain("effectivecpmnetwork.com*");
  });

  it("keeps the Adsterra origin out for missing and false flags", () => {
    expect(buildContentSecurityPolicy({})).not.toContain("effectivecpmnetwork.com");
    expect(buildContentSecurityPolicy({ NEXT_PUBLIC_ADSTERRA_ENABLED: "false" })).not.toContain("effectivecpmnetwork.com");
  });
});
