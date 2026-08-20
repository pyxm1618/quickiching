import { SITE_ORIGIN } from "@/i18n/config";
import { canonicalUrl } from "@/i18n/helpers";
import { ENGLISH_INDEXABLE_PATHS as INDEXABLE_PATHS, HEXAGRAM_INDEXABLE_PATHS, indexablePathInventory } from "@/i18n/routes";

export { SITE_ORIGIN, INDEXABLE_PATHS, HEXAGRAM_INDEXABLE_PATHS };
export const INDEXABLE_INVENTORY = indexablePathInventory();

export const HOME_TITLE = "I Ching Online — Free Hexagram Reading | Quick I Ching";
export const HOME_DESCRIPTION = "Use the I Ching online with Three-Coin, Yarrow Stalk, Mei Hua Yi Shu, or Manual Cast. See changing lines and get a free grounded interpretation.";
export const HOME_H1 = "I Ching Online — Cast Your Hexagram";

export type IndexablePath = string;

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
  return canonicalUrl(path);
}

export function isIndexablePath(path: string): path is IndexablePath {
  return INDEXABLE_INVENTORY.includes(path);
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
