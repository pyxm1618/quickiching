import { NextRequest } from "next/server";
import { ACTION_HEADER } from "next/dist/client/components/app-router-headers";
import { unstable_doesMiddlewareMatch } from "next/dist/experimental/testing/server/middleware-testing-utils";
import { handleAction } from "next/dist/server/app-render/action-handler";
import { getServerActionRequestMetadata } from "next/dist/server/lib/server-action-request-meta";
import {
  SERVER_REFERENCE_ID_LENGTH,
  mightBeServerReferenceId,
} from "next/dist/shared/lib/server-reference-info";
import { describe, expect, it, vi } from "vitest";
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

// Regression / contract suite for the empty `Next-Action: ""` semantic
// difference. The `has` matcher requires a truthy header value (Next.js
// prepare-destination.js matchHas: `if (!hasItem.value && value)`), so an
// empty value no longer invokes Middleware, whereas the previous "/:path*" +
// `request.headers.has("next-action")` did. This is safe and intentional:
// Next.js 15.5.25 never recognizes an empty value as a Server Action request.
//
//   server/lib/server-action-request-meta.js  getServerActionRequestMetadata
//     isFetchAction = string actionId && POST   -> possible-action PREFILTER
//   server/app-render/action-handler.js        getActionModIdOrError
//     `if (!actionId) throw InvariantError("Missing 'next-action' header.")`
//     (all four fetch-action branches) -> handleUnrecognizedFetchAction
//     -> 404 + x-nextjs-action-not-found: 1, before any decodeReply,
//     selectWorkerForForwarding, module require or executeAction.
//   shared/lib/server-reference-info.js       SERVER_REFERENCE_ID_LENGTH = 42
//     mightBeServerReferenceId("") === false
//
// The real safety boundary is therefore a NON-EMPTY, valid action ID, not the
// literal presence of the header. No `has` matcher (even with value ".*" or
// "^$") can match an empty-valued header, so preserving the old literal
// semantics would require restoring the "/:path*" catch-all. Do not do that.
// Re-validate against the real runtime on any Next.js upgrade.
describe("empty Next-Action is not a Server Action request (Next.js 15.5.25)", () => {
  const path = "/methods/three-coin";

  it("does not invoke Middleware, while a non-empty value still does", async () => {
    expect(await middlewareInvoked(path, { [ACTION_HEADER]: "" })).toBe(false);
    expect(await middlewareInvoked(path, NEXT_ACTION_HEADERS)).toBe(true);
  });

  it("is only a possible-action prefilter on POST, and not an action on GET", () => {
    const post = new NextRequest(`${ORIGIN}${path}`, {
      method: "POST",
      headers: { [ACTION_HEADER]: "", "content-type": "text/plain" },
    });
    const metadata = getServerActionRequestMetadata(post);
    expect(metadata.actionId).toBe("");
    expect(metadata.isFetchAction).toBe(true);
    // `isPossibleServerAction` is only Next.js's documented false-positive-prone
    // prefilter, NOT a "this is a Server Action request" determination.
    expect(metadata.isPossibleServerAction).toBe(true);

    const get = new NextRequest(`${ORIGIN}${path}`, {
      method: "GET",
      headers: { [ACTION_HEADER]: "" },
    });
    expect(getServerActionRequestMetadata(get).isPossibleServerAction).toBe(false);
  });

  it("cannot resolve to an action: the empty value fails action ID validation", () => {
    expect(SERVER_REFERENCE_ID_LENGTH).toBe(42);
    expect(mightBeServerReferenceId("")).toBe(false);
    expect(mightBeServerReferenceId("a".repeat(SERVER_REFERENCE_ID_LENGTH))).toBe(true);
  });

  it("Next.js handleAction answers the empty value with a 404 and executes nothing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const responseHeaders: Record<string, string> = {};
      const res = {
        statusCode: 200,
        setHeader: (key: string, value: string) => {
          responseHeaders[key.toLowerCase()] = value;
        },
        getHeaders: () => ({}),
      };
      const requireActionModule = vi.fn(() => {
        throw new Error("Server Action module must not be loaded for an empty action ID");
      });
      const req = {
        method: "POST",
        url: path,
        headers: { "content-type": "text/plain", [ACTION_HEADER]: "" },
      };

      const outcome = await handleAction({
        req,
        res,
        ComponentMod: { __next_app__: { require: requireActionModule } },
        // This app defines no Server Actions; its built
        // server-reference-manifest.json has empty node/edge maps.
        ctx: { renderOpts: { serverActionsManifest: { node: {}, edge: {} } } },
      } as unknown as Parameters<typeof handleAction>[0]);

      expect(outcome?.type).toBe("done");
      expect(res.statusCode).toBe(404);
      expect(responseHeaders["x-nextjs-action-not-found"]).toBe("1");
      expect(requireActionModule).not.toHaveBeenCalled();
      // Next.js rejected the empty value as an invalid server reference ID.
      expect(warn.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    } finally {
      warn.mockRestore();
    }
  });
});
