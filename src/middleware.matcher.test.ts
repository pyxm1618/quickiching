import { unstable_doesMiddlewareMatch } from "next/dist/experimental/testing/server/middleware-testing-utils";
import { describe, expect, it } from "vitest";
import nextConfig from "../next.config.mjs";
import { config } from "./middleware";

// This suite exercises Next.js 15.5.x's own matcher contract: the same
// getMiddlewareMatchers() + getMiddlewareRouteMatcher() pipeline that
// `next build` compiles into the middleware manifest and Vercel evaluates per
// request. Calling middleware() directly cannot prove config.matcher at all.
const ORIGIN = "https://www.quickiching.com";

// withWorkflow() wraps next.config.mjs in a phase function. Resolve it once so
// the matcher is compiled with the production config (i18n / basePath affect
// getMiddlewareMatchers), exactly as it is at build time.
type MatcherArgs = Parameters<typeof unstable_doesMiddlewareMatch>[0];
const productionNextConfig: Promise<MatcherArgs["nextConfig"]> = Promise.resolve(
  typeof nextConfig === "function"
    ? nextConfig("phase-production-build", { defaultConfig: {} })
    : nextConfig,
);

async function middlewareInvoked(
  path: string,
  headers: Record<string, string> = {},
): Promise<boolean> {
  return unstable_doesMiddlewareMatch({
    config,
    url: `${ORIGIN}${path}`,
    headers,
    nextConfig: await productionNextConfig,
  });
}

const NEXT_ACTION_HEADERS = { "next-action": "action-id" };

describe("config.matcher contract (Next.js unstable_doesMiddlewareMatch)", () => {
  it("stays a positive allowlist with no unconditional catch-all", () => {
    expect(config.matcher).not.toContain("/:path*");
    for (const entry of config.matcher) {
      if (typeof entry === "string") {
        expect(entry.startsWith("/:path*")).toBe(false);
      } else {
        // The only object matcher must be gated by a condition.
        expect(entry.has?.length).toBeGreaterThan(0);
      }
    }
  });

  describe("requests that must still invoke Middleware", () => {
    it("keeps every API route behind the closed boundary", async () => {
      for (const path of [
        "/api/user/me",
        "/api/webhooks/waffo",
        "/api/internal/reconcile",
        "/api/auth/get-session",
        "/api/checkout",
        "/api/refunds",
        "/api/internal/refunds/00000000-0000-4000-8000-000000000001/dispatch",
        "/api/readings/00000000-0000-4000-8000-000000000001/deep",
        "/api/account/delete",
        "/api/internal/cp6-staging-diagnostics",
        "/api/health",
        "/api/ready",
        // Unknown API paths must still reach the closed-boundary 404 branch.
        "/api/orders",
        "/api/personalized-interpretation",
        "/api/not-a-route",
      ]) {
        expect(await middlewareInvoked(path), path).toBe(true);
      }
    });

    it("keeps page-level capability and retired routes, including subpaths", async () => {
      for (const path of [
        "/signin",
        "/signin/",
        "/signin/callback/google",
        "/signup",
        "/account",
        "/account/settings",
        "/checkout",
        "/checkout/simulate",
        "/result",
        "/result/00000000-0000-4000-8000-000000000001",
        "/cast",
        "/cast/three_coin",
      ]) {
        expect(await middlewareInvoked(path), path).toBe(true);
      }
    });

    it("keeps the Chinese surface covered", async () => {
      for (const path of [
        "/zh",
        "/zh/",
        "/zh/account",
        "/zh/unknown",
        "/zh/pricing",
        "/zh/readings/three-coin/result",
      ]) {
        expect(await middlewareInvoked(path), path).toBe(true);
      }
    });

    it("keeps the Next-Action safety boundary global on any pathname", async () => {
      for (const path of [
        "/",
        "/methods/three-coin",
        "/hexagrams/1",
        "/help",
        "/.well-known/workflow/v1/flow",
        "/_next/static/chunks/example.js",
        "/favicon.ico",
      ]) {
        expect(await middlewareInvoked(path, NEXT_ACTION_HEADERS), path).toBe(true);
      }
    });
  });

  describe("requests that must no longer invoke Middleware", () => {
    it("stops ordinary public GETs", async () => {
      for (const path of [
        "/",
        "/methods/three-coin",
        "/methods/yarrow-stalks",
        "/methods/mei-hua-yi-shu",
        "/methods/manual-cast",
        "/hexagrams",
        "/hexagrams/1",
        "/guides/how-to-ask-the-i-ching",
        "/help",
        "/privacy",
        "/terms",
        "/acceptable-use",
        "/pricing",
        "/my-readings",
      ]) {
        expect(await middlewareInvoked(path), path).toBe(false);
      }
    });

    it("stops static assets, the image optimizer and favicon", async () => {
      for (const path of [
        "/_next/static/chunks/example.js",
        "/_next/static/css/example.css",
        "/_next/image?url=%2Fimages%2Flogo.png&w=640&q=75",
        "/favicon.ico",
        "/robots.txt",
        "/sitemap.xml",
        "/images/logo.svg",
        "/fonts/inter.woff2",
        "/performance/hero.webp",
      ]) {
        expect(await middlewareInvoked(path), path).toBe(false);
      }
    });

    it("stops Workflow internal routes", async () => {
      for (const path of [
        "/.well-known/workflow/v1/flow",
        "/.well-known/workflow/v1/step",
      ]) {
        expect(await middlewareInvoked(path), path).toBe(false);
      }
    });

    it("only the header, never the pathname, re-enables the global boundary", async () => {
      expect(await middlewareInvoked("/methods/three-coin")).toBe(false);
      expect(await middlewareInvoked("/methods/three-coin", NEXT_ACTION_HEADERS)).toBe(true);
      expect(await middlewareInvoked("/")).toBe(false);
      expect(await middlewareInvoked("/", NEXT_ACTION_HEADERS)).toBe(true);
    });
  });
});
