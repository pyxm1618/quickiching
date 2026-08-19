export const SITE_ORIGIN = "https://www.quickiching.com";

export const HOME_TITLE = "I Ching Online — Free Hexagram Reading | Quick I Ching";
export const HOME_DESCRIPTION = "Use the I Ching online with Three-Coin, Yarrow Stalk, Mei Hua Yi Shu, or Manual Cast. See changing lines and get a free grounded interpretation.";
export const HOME_H1 = "I Ching Online — Cast Your Hexagram";

export const HEXAGRAM_INDEXABLE_PATHS = [
  "/hexagrams/1-the-creative",
  "/hexagrams/2-the-receptive",
  "/hexagrams/3-difficulty-at-the-beginning",
  "/hexagrams/4-youthful-folly",
  "/hexagrams/5-waiting",
  "/hexagrams/6-conflict",
  "/hexagrams/7-the-army",
  "/hexagrams/8-holding-together",
  "/hexagrams/9-small-taming",
  "/hexagrams/10-treading",
  "/hexagrams/11-peace",
  "/hexagrams/12-standstill",
  "/hexagrams/13-fellowship",
  "/hexagrams/14-great-possession",
  "/hexagrams/15-modesty",
  "/hexagrams/16-enthusiasm",
  "/hexagrams/17-following",
  "/hexagrams/18-work-on-the-decayed",
  "/hexagrams/19-approach",
  "/hexagrams/20-contemplation",
  "/hexagrams/21-biting-through",
  "/hexagrams/22-grace",
  "/hexagrams/23-splitting-apart",
  "/hexagrams/24-return",
  "/hexagrams/25-innocence",
  "/hexagrams/26-great-taming",
  "/hexagrams/27-nourishment",
  "/hexagrams/28-great-exceeding",
  "/hexagrams/29-the-abysmal-water",
  "/hexagrams/30-the-clinging-fire",
  "/hexagrams/31-influence",
  "/hexagrams/32-duration",
  "/hexagrams/33-retreat",
  "/hexagrams/34-great-power",
  "/hexagrams/35-progress",
  "/hexagrams/36-darkening-of-the-light",
  "/hexagrams/37-the-family",
  "/hexagrams/38-opposition",
  "/hexagrams/39-obstruction",
  "/hexagrams/40-deliverance",
  "/hexagrams/41-decrease",
  "/hexagrams/42-increase",
  "/hexagrams/43-breakthrough",
  "/hexagrams/44-coming-to-meet",
  "/hexagrams/45-gathering-together",
  "/hexagrams/46-pushing-upward",
  "/hexagrams/47-oppression",
  "/hexagrams/48-the-well",
  "/hexagrams/49-revolution",
  "/hexagrams/50-the-cauldron",
  "/hexagrams/51-the-arousing-thunder",
  "/hexagrams/52-keeping-still-mountain",
  "/hexagrams/53-development",
  "/hexagrams/54-the-marrying-maiden",
  "/hexagrams/55-abundance",
  "/hexagrams/56-the-wanderer",
  "/hexagrams/57-the-gentle-wind",
  "/hexagrams/58-the-joyous-lake",
  "/hexagrams/59-dispersion",
  "/hexagrams/60-limitation",
  "/hexagrams/61-inner-truth",
  "/hexagrams/62-small-exceeding",
  "/hexagrams/63-after-completion",
  "/hexagrams/64-before-completion",
] as const;

export const INDEXABLE_PATHS = [
  "/",
  "/methods/three-coin",
  "/methods/yarrow-stalks",
  "/methods/mei-hua-yi-shu",
  "/methods/manual-cast",
  "/guides/how-to-ask-the-i-ching",
  "/guides/changing-lines",
  "/guides/primary-relating-hexagrams",
  "/hexagrams",
  ...HEXAGRAM_INDEXABLE_PATHS,
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
    "/history",
  ].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
