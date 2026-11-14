/**
 * Quick I Ching — Navigation / Surface Authority (implementation of
 * docs/architecture/navigation-surface-authority.md).
 *
 * The single decision chain for navigation ownership:
 *
 *   route + flow state -> Surface Contract -> Navigation Shell -> capabilities
 *
 * Pathname alone is never the authority: a route may hold more than one surface
 * (the root route owns both the S01 landing surface and the S02 refining flow
 * surface), so callers must pass the live flow state resolved from user intent.
 *
 * This module is intentionally free of React and of browser APIs so that the
 * contract can be exercised by unit tests and read by the server.
 */

export type SurfaceId =
  | "S01"
  | "S02"
  | "S03"
  | "S04"
  | "S05"
  | "S06"
  | "S07"
  | "S08"
  | "S09"
  | "S10"
  | "S11"
  | "S12"
  | "S13"
  | "S14"
  | "S15"
  | "S16"
  | "S17"
  | "S18"
  | "S19"
  | "S20"
  | "S21";

export type NavigationMode =
  | "home"
  | "content"
  | "flow"
  | "immersive"
  | "recovery"
  | "adapter";

export type SurfaceKind =
  | "root"
  | "page"
  | "detail"
  | "seo-detail"
  | "task-flow"
  | "flow-step"
  | "flow-result"
  | "account-page"
  | "recovery"
  | "adapter";

/** Which approved shell presentation renders this surface. */
export type ShellPresentation = "scene" | "info" | "none";

/**
 * band    — the shell occupies its own 75px band above the page (default).
 * overlay — the shell is a zero-height fixed overlay so a full-bleed
 *           composition keeps its exact viewport geometry.
 * none    — no shell is rendered for this surface.
 */
export type ShellLayout = "band" | "overlay" | "none";

export type SurfaceContract = {
  id: SurfaceId;
  kind: SurfaceKind;
  mode: NavigationMode;
  presentation: ShellPresentation;
  layout: ShellLayout;
  /** Discovery navigation (Hexagrams / Other Methods / Info). */
  primaryNavigation: boolean;
  /** Shell-owned Home capability. Always the brand, never a page copy. */
  homeControl: boolean;
  /** Semantic locale switching. */
  localeControl: boolean;
  /** Account capability, additionally gated by isAuthCapabilityEnabled(). */
  accountControl: boolean;
  /**
   * Set when the Authority's capability row is declared but the surface is
   * rendered without the global shell. Every entry is an explicit, reviewable
   * deviation — never a silent page-level override.
   */
  deferredShell?: string;
};

const SURFACES: Record<SurfaceId, SurfaceContract> = {
  // S01 Root Landing — Home mode: brand Home, locale, account, discovery nav.
  S01: {
    id: "S01",
    kind: "root",
    mode: "home",
    presentation: "scene",
    layout: "band",
    primaryNavigation: true,
    homeControl: true,
    localeControl: true,
    accountControl: true,
  },
  // S02 Root Three Coin refining — Flow mode on the same route. The primary
  // navigation is withdrawn for the duration of the deliberate flow; Home,
  // locale and account stay available.
  S02: {
    id: "S02",
    kind: "root",
    mode: "flow",
    presentation: "scene",
    layout: "band",
    primaryNavigation: false,
    homeControl: true,
    localeControl: true,
    accountControl: true,
  },
  // S03 Hexagrams Hub — Immersive: full-bleed composition, no discovery nav,
  // but the shell still owns Home, locale and account.
  S03: {
    id: "S03",
    kind: "page",
    mode: "immersive",
    presentation: "scene",
    layout: "overlay",
    primaryNavigation: false,
    homeControl: true,
    localeControl: true,
    accountControl: true,
  },
  // S04 Hexagram Detail — Content page.
  //
  // DEVIATION (declared, not hidden): the Authority's S04 row requires Home,
  // Locale, Account and discovery navigation. This surface is an approved
  // full-bleed "detail scroll" composition whose fixed shell decorations cover
  // its own content and local section navigation (verified at 1440×900 and
  // 390×844). Satisfying the row needs a content-shell presentation with
  // discovery navigation, which is a visual-design decision the Navigation
  // Authority does not own. Until that decision exists the shell renders
  // nothing here — the page no longer hides shell DOM or shell CSS itself.
  S04: {
    id: "S04",
    kind: "detail",
    mode: "content",
    presentation: "none",
    layout: "none",
    primaryNavigation: true,
    homeControl: true,
    localeControl: true,
    accountControl: true,
    deferredShell: "full-bleed detail-scroll composition; shell presentation not yet designed",
  },
  // S05 Three Coin SEO Detail — Content page.
  S05: {
    id: "S05",
    kind: "seo-detail",
    mode: "content",
    presentation: "scene",
    layout: "band",
    primaryNavigation: true,
    homeControl: true,
    localeControl: true,
    accountControl: true,
  },
  // S06 Yarrow task flow.
  S06: {
    id: "S06",
    kind: "task-flow",
    mode: "flow",
    presentation: "scene",
    layout: "band",
    primaryNavigation: false,
    homeControl: true,
    localeControl: true,
    accountControl: true,
  },
  // S07 Mei Hua task flow.
  S07: {
    id: "S07",
    kind: "task-flow",
    mode: "flow",
    presentation: "scene",
    layout: "band",
    primaryNavigation: false,
    homeControl: true,
    localeControl: true,
    accountControl: true,
  },
  // S08 Manual Cast task flow.
  S08: {
    id: "S08",
    kind: "task-flow",
    mode: "flow",
    presentation: "scene",
    layout: "band",
    primaryNavigation: false,
    homeControl: true,
    localeControl: true,
    accountControl: true,
  },
  // S09 Guides — Content page, no discovery nav.
  S09: {
    id: "S09",
    kind: "page",
    mode: "content",
    presentation: "info",
    layout: "band",
    primaryNavigation: false,
    homeControl: true,
    localeControl: true,
    accountControl: true,
  },
  // S10 Help.
  S10: {
    id: "S10",
    kind: "page",
    mode: "content",
    presentation: "info",
    layout: "band",
    primaryNavigation: false,
    homeControl: true,
    localeControl: true,
    accountControl: true,
  },
  // S11 Legal.
  S11: {
    id: "S11",
    kind: "page",
    mode: "content",
    presentation: "info",
    layout: "band",
    primaryNavigation: false,
    homeControl: true,
    localeControl: true,
    accountControl: true,
  },
  // S12 Result Choice — flow step; full-bleed composition keeps its geometry.
  S12: {
    id: "S12",
    kind: "flow-step",
    mode: "flow",
    presentation: "scene",
    layout: "overlay",
    primaryNavigation: false,
    homeControl: true,
    localeControl: true,
    accountControl: true,
  },
  // S13 Free Reading — flow result.
  S13: {
    id: "S13",
    kind: "flow-result",
    mode: "flow",
    presentation: "scene",
    layout: "band",
    primaryNavigation: false,
    homeControl: true,
    localeControl: true,
    accountControl: true,
  },
  // S14 Deep Reading — flow result.
  S14: {
    id: "S14",
    kind: "flow-result",
    mode: "flow",
    presentation: "scene",
    layout: "band",
    primaryNavigation: false,
    homeControl: true,
    localeControl: true,
    accountControl: true,
  },
  // S15 Direct Pricing — Content page with discovery navigation.
  S15: {
    id: "S15",
    kind: "page",
    mode: "content",
    presentation: "scene",
    layout: "band",
    primaryNavigation: true,
    homeControl: true,
    localeControl: true,
    accountControl: true,
  },
  // S16 Pricing reading-return — Flow; no discovery navigation.
  S16: {
    id: "S16",
    kind: "page",
    mode: "flow",
    presentation: "scene",
    layout: "band",
    primaryNavigation: false,
    homeControl: true,
    localeControl: true,
    accountControl: true,
  },
  // S17 Sign In.
  S17: {
    id: "S17",
    kind: "account-page",
    mode: "flow",
    presentation: "scene",
    layout: "band",
    primaryNavigation: false,
    homeControl: true,
    localeControl: true,
    accountControl: false,
  },
  // S18 Sign Up.
  S18: {
    id: "S18",
    kind: "account-page",
    mode: "flow",
    presentation: "scene",
    layout: "band",
    primaryNavigation: false,
    homeControl: true,
    localeControl: true,
    accountControl: false,
  },
  // S19 My Readings — Content page with discovery navigation.
  S19: {
    id: "S19",
    kind: "account-page",
    mode: "content",
    presentation: "scene",
    layout: "band",
    primaryNavigation: true,
    homeControl: true,
    localeControl: true,
    accountControl: true,
  },
  // S20 Account Adapter — pure redirect; no shell at all.
  S20: {
    id: "S20",
    kind: "adapter",
    mode: "adapter",
    presentation: "none",
    layout: "none",
    primaryNavigation: false,
    homeControl: false,
    localeControl: false,
    accountControl: false,
  },
  // S21 Recovery — the recovery page owns its own actions; no global shell.
  S21: {
    id: "S21",
    kind: "recovery",
    mode: "recovery",
    presentation: "none",
    layout: "none",
    primaryNavigation: false,
    homeControl: false,
    localeControl: false,
    accountControl: false,
  },
};

export type ThreeCoinStage = "landing" | "question-confirm" | "ritual";

export type NavigationFlowState = {
  /** Live Three Coin stage on the root route: the S01 <-> S02 discriminator. */
  threeCoinStage?: ThreeCoinStage;
  /** True while /pricing carries a validated reading return context (S16). */
  pricingReadingContext?: boolean;
};

export type SurfaceClassification = {
  id: SurfaceId;
  /** Path without the locale prefix; "/" for both localized roots. */
  basePath: string;
  locale: "en" | "zh-Hans";
};

const GUIDE_PATHS = new Set([
  "/guides/how-to-ask-the-i-ching",
  "/guides/changing-lines",
  "/guides/primary-relating-hexagrams",
]);

const LEGAL_PATHS = new Set(["/privacy", "/terms", "/acceptable-use"]);

const METHOD_SURFACES: Record<string, SurfaceId> = {
  "/methods/three-coin": "S05",
  "/methods/yarrow-stalks": "S06",
  "/methods/mei-hua-yi-shu": "S07",
  "/methods/manual-cast": "S08",
};

const READING_SURFACES: Record<string, SurfaceId> = {
  "/readings/choice": "S12",
  "/readings/result": "S13",
  "/readings/deep": "S14",
};

export function normalizeNavigationPath(pathname: string): { basePath: string; locale: "en" | "zh-Hans" } {
  const raw = pathname || "/";
  const withoutQuery = raw.split(/[?#]/u)[0] || "/";
  const trimmed = withoutQuery.length > 1 ? withoutQuery.replace(/\/+$/u, "") : withoutQuery;
  if (trimmed === "/zh") return { basePath: "/", locale: "zh-Hans" };
  if (trimmed.startsWith("/zh/")) return { basePath: trimmed.slice(3) || "/", locale: "zh-Hans" };
  return { basePath: trimmed === "" ? "/" : trimmed, locale: "en" };
}

export function hasReadingReturnContext(search: string | undefined): boolean {
  if (!search) return false;
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const candidate = params.get("returnUrl");
  if (!candidate) return false;
  // Only an internal absolute path can express a reading return context. Full
  // same-origin validation stays with validateAuthCallbackURL on the server.
  return candidate.startsWith("/") && !candidate.startsWith("//");
}

export function surfaceIdForPath(
  pathname: string,
  flowState: NavigationFlowState = {},
): SurfaceId {
  const { basePath } = normalizeNavigationPath(pathname);

  if (basePath === "/") {
    const stage = flowState.threeCoinStage ?? "landing";
    return stage === "landing" ? "S01" : "S02";
  }
  if (basePath === "/hexagrams") return "S03";
  if (basePath.startsWith("/hexagrams/")) return "S04";
  if (basePath === "/account") return "S20";
  if (basePath === "/pricing") return flowState.pricingReadingContext ? "S16" : "S15";
  if (basePath === "/signin") return "S17";
  if (basePath === "/signup") return "S18";
  if (basePath === "/my-readings") return "S19";
  if (basePath === "/help") return "S10";
  if (LEGAL_PATHS.has(basePath)) return "S11";
  if (GUIDE_PATHS.has(basePath)) return "S09";
  const method = METHOD_SURFACES[basePath];
  if (method) return method;
  const reading = READING_SURFACES[basePath];
  if (reading) return reading;
  return "S21";
}

export function classifySurface(
  pathname: string,
  flowState: NavigationFlowState = {},
): SurfaceClassification {
  const { basePath, locale } = normalizeNavigationPath(pathname);
  return { id: surfaceIdForPath(pathname, flowState), basePath, locale };
}

export function surfaceContract(id: SurfaceId): SurfaceContract {
  return SURFACES[id];
}

export function resolveSurfaceContract(input: {
  pathname: string;
  flowState?: NavigationFlowState;
}): SurfaceContract {
  return SURFACES[surfaceIdForPath(input.pathname, input.flowState)];
}

/** Every surface that must offer the semantic locale control. */
export function localeSwitchableSurfaces(): SurfaceId[] {
  return (Object.keys(SURFACES) as SurfaceId[]).filter((id) => SURFACES[id].localeControl);
}

/** Every surface that must NOT render discovery navigation. */
export function surfacesWithoutPrimaryNavigation(): SurfaceId[] {
  return (Object.keys(SURFACES) as SurfaceId[]).filter((id) => !SURFACES[id].primaryNavigation);
}
