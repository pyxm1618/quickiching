export const SITE_ORIGIN = "https://www.quickiching.com";

export const HOME_TITLE = "I Ching Online — Free Hexagram Reading | Quick I Ching";
export const HOME_DESCRIPTION = "Use the I Ching online with three coins, yarrow stalks, or Mei Hua Yi Shu. Cast your hexagram, see changing lines, and get a free basic interpretation.";
export const HOME_H1 = "I Ching Online — Cast Your Hexagram";

export const INDEXABLE_PATHS = [
  "/",
  "/methods/three-coin",
  "/methods/yarrow-stalks",
  "/methods/mei-hua-yi-shu",
  "/guides/how-to-ask-the-i-ching",
  "/guides/changing-lines",
  "/guides/primary-relating-hexagrams",
  "/hexagrams",
] as const;

export type IndexablePath = (typeof INDEXABLE_PATHS)[number];

export const LEGACY_REDIRECTS = [
  { source: "/i-ching-coin", destination: "/methods/three-coin" },
  { source: "/three-coin-method", destination: "/methods/three-coin" },
  { source: "/yarrow-stalk-method", destination: "/methods/yarrow-stalks" },
  { source: "/mei-hua-yi-shu", destination: "/methods/mei-hua-yi-shu" },
  { source: "/casting-methods", destination: "/#other-casting-methods" },
  { source: "/how-to-ask-the-i-ching", destination: "/guides/how-to-ask-the-i-ching" },
  { source: "/changing-lines", destination: "/guides/changing-lines" },
  { source: "/primary-and-relating-hexagrams", destination: "/guides/primary-relating-hexagrams" },
  { source: "/cast/three_coin", destination: "/" },
  { source: "/cast/yarrow_stalk", destination: "/methods/yarrow-stalks" },
  { source: "/cast/mei_hua_current_time", destination: "/methods/mei-hua-yi-shu" },
] as const;

export function absoluteUrl(path: string): string {
  return new URL(path, `${SITE_ORIGIN}/`).toString();
}

export function isIndexablePath(path: string): path is IndexablePath {
  return (INDEXABLE_PATHS as readonly string[]).includes(path);
}

export function isPrivateOrCommercialPath(path: string): boolean {
  return [
    "/api",
    "/signin",
    "/account",
    "/checkout",
    "/result",
    "/readings/three-coin/result",
  ].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
