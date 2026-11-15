import { describe, expect, it, vi } from "vitest";

// The pure URL-authority functions are under test; the Next router hooks are
// isolated exactly as the component tests do.
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: () => {} }),
}));

const {
  buildAuthCallbackValue,
  buildLocaleSwitchHref,
  isSafeInternalTarget,
  prepareLocaleSwitchClick,
  transformNestedNavigationContext,
} = await import("./browser-navigation");
const { validateAuthCallbackURL } = await import("@/server/auth/callback");

/**
 * C5 — Navigation Context Authority focused tests.
 *
 * 1. direct stateful route keeps session + hash across EN ↔ ZH
 * 2. auth callbackURL is locale-converted in both directions
 * 3. pricing returnUrl is locale-converted in both directions
 * 4. bounded depth-2 (callbackURL → returnUrl) converts the whole chain
 * 5. external URLs are never rewritten and stay rejected by the server validator
 * 6. unknown internal nested routes keep their exact original bytes
 * 7. opaque params (orderId / requestId / productKey) are never rewritten
 * 8. outer query and hash survive byte-for-byte (minimal query surgery)
 */

const BASE_URL = "http://localhost:3000";

describe("C5 — outer location contract (pathname + search + hash)", () => {
  it("1. keeps session + hash across EN ↔ ZH on a direct stateful route", () => {
    expect(buildLocaleSwitchHref({
      pathname: "/readings/result",
      search: "?session=A",
      hash: "#x",
      targetLocale: "zh-Hans",
    })).toBe("/zh/readings/result?session=A#x");

    expect(buildLocaleSwitchHref({
      pathname: "/zh/readings/result",
      search: "?session=A",
      hash: "#x",
      targetLocale: "en",
    })).toBe("/readings/result?session=A#x");
  });

  it("preserves the exact outer query and hash bytes on stateful surfaces", () => {
    expect(buildLocaleSwitchHref({
      pathname: "/readings/deep",
      search: "?session=A&foo=B",
      hash: "#interpretation",
      targetLocale: "zh-Hans",
    })).toBe("/zh/readings/deep?session=A&foo=B#interpretation");
    expect(buildLocaleSwitchHref({
      pathname: "/readings/choice",
      search: "?session=A",
      hash: "",
      targetLocale: "zh-Hans",
    })).toBe("/zh/readings/choice?session=A");
    expect(buildLocaleSwitchHref({
      pathname: "/zh",
      search: "",
      hash: "",
      targetLocale: "en",
    })).toBe("/");
  });

  it("8. keeps unrelated outer query segments byte-identical and in order", () => {
    const search = "?session=A&utm_source=news&orderId=ord-77&preview=1";
    expect(buildLocaleSwitchHref({
      pathname: "/readings/result",
      search,
      hash: "#lines",
      targetLocale: "zh-Hans",
    })).toBe(`/zh/readings/result${search}#lines`);
  });
});

describe("C5 — nested navigation context (callbackURL / returnUrl)", () => {
  it("2. converts a nested auth callbackURL in both directions", () => {
    expect(buildLocaleSwitchHref({
      pathname: "/signin",
      search: "?callbackURL=/readings/result?session=A",
      hash: "",
      targetLocale: "zh-Hans",
    })).toBe("/zh/signin?callbackURL=/zh/readings/result?session=A");

    expect(buildLocaleSwitchHref({
      pathname: "/zh/signin",
      search: "?callbackURL=/zh/readings/result?session=A",
      hash: "",
      targetLocale: "en",
    })).toBe("/signin?callbackURL=/readings/result?session=A");
  });

  it("converts a nested auth callbackURL in fully percent-encoded form", () => {
    expect(buildLocaleSwitchHref({
      pathname: "/signin",
      search: "?callbackURL=%2Freadings%2Fresult%3Fsession%3DA",
      hash: "",
      targetLocale: "zh-Hans",
    })).toBe("/zh/signin?callbackURL=%2Fzh%2Freadings%2Fresult%3Fsession%3DA");
  });

  it("3. converts a nested pricing returnUrl in both directions", () => {
    expect(buildLocaleSwitchHref({
      pathname: "/pricing",
      search: "?returnUrl=/readings/deep?session=A",
      hash: "",
      targetLocale: "zh-Hans",
    })).toBe("/zh/pricing?returnUrl=/zh/readings/deep?session=A");

    expect(buildLocaleSwitchHref({
      pathname: "/zh/pricing",
      search: "?returnUrl=/zh/readings/deep?session=A",
      hash: "",
      targetLocale: "en",
    })).toBe("/pricing?returnUrl=/readings/deep?session=A");
  });

  it("4. converts the bounded depth-2 chain callbackURL → returnUrl", () => {
    expect(buildLocaleSwitchHref({
      pathname: "/signin",
      search: "?callbackURL=/pricing?returnUrl=/readings/deep?session=A",
      hash: "",
      targetLocale: "zh-Hans",
    })).toBe("/zh/signin?callbackURL=/zh/pricing?returnUrl=/zh/readings/deep?session=A");

    expect(buildLocaleSwitchHref({
      pathname: "/zh/signin",
      search: "?callbackURL=/zh/pricing?returnUrl=/zh/readings/deep?session=A",
      hash: "",
      targetLocale: "en",
    })).toBe("/signin?callbackURL=/pricing?returnUrl=/readings/deep?session=A");
  });

  it("preserves values deeper than the bounded nested depth exactly", () => {
    // callbackURL (depth 1) → returnUrl (depth 2) convert; a third nested
    // level's value (callbackURL inside returnUrl) is fail-safe preserved
    // byte-for-byte — its path is never rewritten.
    expect(transformNestedNavigationContext(
      "/pricing?returnUrl=/signin?callbackURL=/readings/result?session=A",
      "zh-Hans",
    )).toBe("/zh/pricing?returnUrl=/zh/signin?callbackURL=/readings/result?session=A");
  });

  it("keeps nested query identity and the nested hash of a transformed target", () => {
    expect(transformNestedNavigationContext(
      "/readings/result?session=A&foo=B#section",
      "zh-Hans",
    )).toBe("/zh/readings/result?session=A&foo=B#section");
    // A nested hash authored as %23 inside the value stays inside the value.
    expect(transformNestedNavigationContext(
      "/readings/result?session=A%23interpretation",
      "zh-Hans",
    )).toBe("/zh/readings/result?session=A%23interpretation");
  });
});

describe("C5 — fail-safe preservation and opaque values", () => {
  it("5. never rewrites external URLs and leaves them to the server validator", () => {
    const external = [
      "https://external.example/readings/result?session=A",
      "http://external.example/readings/result?session=A",
      "//external.example/readings/result",
      "javascript:alert(1)",
    ];
    for (const value of external) {
      expect(transformNestedNavigationContext(value, "zh-Hans")).toBe(value);
      expect(isSafeInternalTarget(value)).toBe(false);
      // The existing security validator still rejects these targets.
      expect(() => validateAuthCallbackURL(value, BASE_URL)).toThrow("AUTH_CALLBACK_INVALID");
    }
  });

  it("rejects backslash and scheme-smuggling tricks without rewriting them", () => {
    for (const value of ["/\\evil.example/x", "//evil.example/x", "/%5c%5cevil", "/%2f%2fevil"]) {
      expect(isSafeInternalTarget(value)).toBe(false);
      expect(transformNestedNavigationContext(value, "zh-Hans")).toBe(value);
    }
  });

  it("6. keeps the exact original bytes of an unknown internal nested route", () => {
    expect(transformNestedNavigationContext("/unknown-route?x=1", "zh-Hans")).toBe("/unknown-route?x=1");
    expect(transformNestedNavigationContext("/unknown-route?callbackURL=/readings/result?session=A", "zh-Hans"))
      .toBe("/unknown-route?callbackURL=/readings/result?session=A");
    expect(transformNestedNavigationContext("%2Funknown%3Fx%3D1", "zh-Hans")).toBe("%2Funknown%3Fx%3D1");
  });

  it("7. never rewrites opaque params at the outer level or inside nested values", () => {
    const search = "?orderId=ord-1&returnUrl=/readings/deep?session=A&requestId=req-2&productKey=pk-3&transactionId=tx-4";
    const href = buildLocaleSwitchHref({
      pathname: "/pricing",
      search,
      hash: "",
      targetLocale: "zh-Hans",
    });
    expect(href).toBe("/zh/pricing?orderId=ord-1&returnUrl=/zh/readings/deep?session=A&requestId=req-2&productKey=pk-3&transactionId=tx-4");

    expect(transformNestedNavigationContext("/readings/deep?session=A&orderId=ord-9&castingId=cast-5", "zh-Hans"))
      .toBe("/zh/readings/deep?session=A&orderId=ord-9&castingId=cast-5");
  });
});

describe("C5 — translated targets still pass the existing security validator", () => {
  it("keeps locale-translated callbackURL / returnUrl values validator-clean", () => {
    const translatedCallback = transformNestedNavigationContext("/readings/result?session=A#lines", "zh-Hans");
    expect(translatedCallback).toBe("/zh/readings/result?session=A#lines");
    expect(validateAuthCallbackURL(translatedCallback, BASE_URL)).toBe("/zh/readings/result?session=A#lines");

    const translatedNested = transformNestedNavigationContext("/pricing?returnUrl=/readings/deep?session=A", "zh-Hans");
    expect(validateAuthCallbackURL(translatedNested, BASE_URL)).toBe(translatedNested);

    expect(buildAuthCallbackValue({ pathname: "/readings/result", search: "?session=A", hash: "#lines" }))
      .toBe("/readings/result?session=A#lines");
    expect(validateAuthCallbackURL("/readings/result?session=A#lines", BASE_URL))
      .toBe("/readings/result?session=A#lines");
  });
});

describe("C9 — locale switch click decision (issue / cancel / ignore)", () => {
  const plain = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
  const liveFlow = { method: "three-coin" as const, readingId: "reading-A", locale: "en" as const, active: true as const };

  it("9. modified or middle activation never issues a continuation intent", () => {
    for (const event of [
      { ...plain, ctrlKey: true },
      { ...plain, metaKey: true },
      { ...plain, shiftKey: true },
      { ...plain, altKey: true },
      { ...plain, button: 1 },
      { ...plain, button: 2 },
    ]) {
      let issued = false;
      const decision = prepareLocaleSwitchClick({
        event,
        href: "/zh",
        targetLocale: "zh-Hans",
        liveFlow,
        issueIntent: () => {
          issued = true;
          return true;
        },
      });
      expect(decision).toEqual({ action: "ignore" });
      expect(issued).toBe(false);
    }
  });

  it("issues the intent on a plain left click during an active flow", () => {
    const calls: Array<{ method: string; readingId: string; targetLocale: string }> = [];
    const decision = prepareLocaleSwitchClick({
      event: plain,
      href: "/zh/readings/result?session=A",
      targetLocale: "zh-Hans",
      liveFlow,
      issueIntent: (input) => {
        calls.push(input);
        return true;
      },
    });
    expect(decision).toEqual({ action: "navigate", href: "/zh/readings/result?session=A" });
    expect(calls).toEqual([{ method: "three-coin", readingId: "reading-A", targetLocale: "zh-Hans" }]);
  });

  it("10. cancels the locale navigation when the intent write fails", () => {
    let attempted = false;
    const decision = prepareLocaleSwitchClick({
      event: plain,
      href: "/zh",
      targetLocale: "zh-Hans",
      liveFlow,
      issueIntent: () => {
        attempted = true;
        return false;
      },
    });
    expect(attempted).toBe(true);
    expect(decision).toEqual({ action: "cancel" });
  });

  it("never issues an intent without an active live flow (passive entry stays passive)", () => {
    let issued = false;
    const decision = prepareLocaleSwitchClick({
      event: plain,
      href: "/zh",
      targetLocale: "zh-Hans",
      liveFlow: null,
      issueIntent: () => {
        issued = true;
        return true;
      },
    });
    expect(decision).toEqual({ action: "navigate", href: "/zh" });
    expect(issued).toBe(false);
  });
});
