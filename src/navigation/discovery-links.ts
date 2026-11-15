/**
 * One discovery-graph definition for the global navigation shell.
 *
 * Both the crawlable route graph and the visible Content presentation read from
 * here, so the destinations cannot drift between the invisible and visible
 * forms of shell-owned discovery navigation. No /methods or /info hub exists.
 */
export type DiscoveryLink = {
  path: string;
  en: string;
  zh: string;
};

export const HOME_LINK: DiscoveryLink = { path: "/", en: "Home", zh: "首页" };

export const HEXAGRAMS_LINK: DiscoveryLink = { path: "/hexagrams", en: "64 Hexagrams", zh: "六十四卦" };

export const THREE_COIN_LINK: DiscoveryLink = {
  path: "/methods/three-coin",
  en: "Three Coin Method",
  zh: "三枚铜钱",
};

export const OTHER_METHOD_LINKS: readonly DiscoveryLink[] = [
  { path: "/methods/yarrow-stalks", en: "Yarrow Stalks", zh: "蓍草法" },
  { path: "/methods/mei-hua-yi-shu", en: "Mei Hua Yi Shu", zh: "梅花易数" },
  { path: "/methods/manual-cast", en: "Manual Cast", zh: "手动起卦" },
];

export const METHOD_LINKS: readonly DiscoveryLink[] = [
  THREE_COIN_LINK,
  ...OTHER_METHOD_LINKS,
];

export const INFO_LINKS: readonly DiscoveryLink[] = [
  { path: "/guides/how-to-ask-the-i-ching", en: "How to Ask the I Ching", zh: "如何向易经提问" },
  { path: "/guides/changing-lines", en: "Changing Lines", zh: "变爻" },
  { path: "/guides/primary-relating-hexagrams", en: "Primary & Relating Hexagrams", zh: "本卦与变卦" },
  { path: "/help", en: "Help & Support", zh: "帮助与支持" },
  { path: "/privacy", en: "Privacy Policy", zh: "隐私政策" },
  { path: "/terms", en: "Terms of Service", zh: "服务条款" },
  { path: "/acceptable-use", en: "Acceptable Use", zh: "可接受使用政策" },
];

export const SUPPORT_EMAIL_LINK = { href: "mailto:support@quickiching.com", en: "Contact Support", zh: "联系支持" };

export const ALL_DISCOVERY_LINKS: readonly DiscoveryLink[] = [
  HOME_LINK,
  HEXAGRAMS_LINK,
  ...METHOD_LINKS,
  ...INFO_LINKS,
];
