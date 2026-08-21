import type { ContentLocale } from "./config";

export type LocalizedRouteDefinition = {
  id: string;
  paths: Partial<Record<ContentLocale, string>>;
  renderable: Partial<Record<ContentLocale, boolean>>;
  indexable: Partial<Record<ContentLocale, boolean>>;
  hreflangGroup: boolean;
  switchable: boolean;
};

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

export const CHINESE_HEXAGRAM_INDEXABLE_PATHS = HEXAGRAM_INDEXABLE_PATHS.map((path) => `/zh${path}`);

export const ENGLISH_INDEXABLE_PATHS = [
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

const EQUIVALENT_ROUTES: readonly LocalizedRouteDefinition[] = [
  {
    id: "homepage",
    paths: { en: "/", "zh-Hans": "/zh" },
    renderable: { en: true, "zh-Hans": true },
    indexable: { en: true, "zh-Hans": true },
    hreflangGroup: true,
    switchable: true,
  },
  {
    id: "mei-hua-yi-shu",
    paths: { en: "/methods/mei-hua-yi-shu", "zh-Hans": "/zh/methods/mei-hua-yi-shu" },
    renderable: { en: true, "zh-Hans": true },
    indexable: { en: true, "zh-Hans": true },
    hreflangGroup: true,
    switchable: true,
  },
];

const NAMED_ENGLISH_ROUTES: Record<string, string> = {
  "three-coin-method": "/methods/three-coin",
  "yarrow-stalks-method": "/methods/yarrow-stalks",
  "manual-cast-method": "/methods/manual-cast",
  "guides-how-to-ask": "/guides/how-to-ask-the-i-ching",
  "guides-changing-lines": "/guides/changing-lines",
  "guides-primary-relating": "/guides/primary-relating-hexagrams",
  "hexagrams-hub": "/hexagrams",
};

function englishOnlyRoute(id: string, path: string): LocalizedRouteDefinition {
  return {
    id,
    paths: { en: path },
    renderable: { en: true },
    indexable: { en: true },
    hreflangGroup: false,
    switchable: false,
  };
}

function chineseOnlyRoute(id: string, path: string): LocalizedRouteDefinition {
  return {
    id,
    paths: { "zh-Hans": path },
    renderable: { "zh-Hans": true },
    indexable: { "zh-Hans": true },
    hreflangGroup: false,
    switchable: false,
  };
}

function pairedHexagramRoute(path: string): LocalizedRouteDefinition {
  const slug = path.slice("/hexagrams/".length);
  return {
    id: `hexagram:${slug}`,
    paths: { en: path, "zh-Hans": `/zh/hexagrams/${slug}` },
    renderable: { en: true, "zh-Hans": true },
    indexable: { en: true, "zh-Hans": true },
    hreflangGroup: true,
    switchable: true,
  };
}

const NAMED_ROUTES = Object.entries(NAMED_ENGLISH_ROUTES).map(([id, path]) => englishOnlyRoute(id, path));
const NAMED_PATHS = new Set(Object.values(NAMED_ENGLISH_ROUTES));
const CHINESE_ONLY_ROUTES = [chineseOnlyRoute("hexagrams-zh-hub", "/zh/hexagrams")];
const HEXAGRAM_ROUTES = HEXAGRAM_INDEXABLE_PATHS.map(pairedHexagramRoute);

export const ROUTE_REGISTRY: readonly LocalizedRouteDefinition[] = [
  ...EQUIVALENT_ROUTES,
  ...NAMED_ROUTES,
  ...CHINESE_ONLY_ROUTES,
  ...HEXAGRAM_ROUTES,
];

const ROUTE_BY_ID = new Map(ROUTE_REGISTRY.map((route) => [route.id, route]));
const ROUTE_BY_PATH = new Map(
  ROUTE_REGISTRY.flatMap((route) => Object.values(route.paths).map((path) => [path, route] as const)),
);

export function localizedRoute(id: string): LocalizedRouteDefinition {
  const route = ROUTE_BY_ID.get(id);
  if (!route) throw new Error(`LOCALIZED_ROUTE_NOT_FOUND: ${id}`);
  return route;
}

export function routeForPath(path: string): LocalizedRouteDefinition | undefined {
  const normalized = path === "/" ? "/" : path.replace(/\/+$/, "");
  return ROUTE_BY_PATH.get(normalized);
}

export function routeIdForEnglishPath(path: string): string | undefined {
  if (path === "/") return "homepage";
  if (path === "/methods/mei-hua-yi-shu") return "mei-hua-yi-shu";
  const named = Object.entries(NAMED_ENGLISH_ROUTES).find(([, routePath]) => routePath === path);
  if (named) return named[0];
  if (path.startsWith("/hexagrams/")) return `hexagram:${path.slice("/hexagrams/".length)}`;
  return undefined;
}

export function indexablePathInventory(): readonly string[] {
  const english = ENGLISH_INDEXABLE_PATHS.filter((path) => {
    const route = routeForPath(path);
    return route?.indexable.en === true;
  });
  const localized = ROUTE_REGISTRY.flatMap((route) =>
    route.indexable["zh-Hans"] && route.paths["zh-Hans"] ? [route.paths["zh-Hans"]] : [],
  );
  return [...english, ...localized];
}

export { NAMED_PATHS };
