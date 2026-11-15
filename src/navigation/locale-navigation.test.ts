import { describe, expect, it } from "vitest";
import { authCallbackPath, localeSwitchTarget, mapInternalPathLocale } from "./locale-navigation";

describe("locale switching keeps the surface and its flow-critical state", () => {
  it.each([
    ["/", "/zh"],
    ["/zh", "/"],
    ["/hexagrams", "/zh/hexagrams"],
    ["/methods/three-coin", "/zh/methods/three-coin"],
    ["/help", "/zh/help"],
    ["/my-readings", "/zh/my-readings"],
    ["/pricing", "/zh/pricing"],
    ["/signin", "/zh/signin"],
  ])("maps %s onto the equivalent localized surface %s", (from, expected) => {
    const target = localeSwitchTarget({ pathname: from, currentLocale: from.startsWith("/zh") ? "zh-Hans" : "en" });
    expect(target.available).toBe(true);
    expect(target.href).toBe(expected);
  });

  it("never falls back to Home for a transactional surface", () => {
    for (const pathname of ["/readings/choice", "/readings/result", "/readings/deep", "/pricing", "/signin", "/signup", "/my-readings"]) {
      const target = localeSwitchTarget({ pathname, currentLocale: "en" });
      expect(target.href, pathname).not.toBe("/zh");
    }
  });

  it("keeps the sealed session while switching language", () => {
    expect(localeSwitchTarget({
      pathname: "/readings/result",
      search: "?session=ABC-123",
      currentLocale: "en",
    }).href).toBe("/zh/readings/result?session=ABC-123");

    expect(localeSwitchTarget({
      pathname: "/readings/deep",
      search: "?session=ABC-123",
      currentLocale: "zh-Hans",
    }).href).toBe("/readings/deep?session=ABC-123");
  });

  it("keeps S16 payment recovery identity but filters unrelated query state", () => {
    expect(localeSwitchTarget({
      pathname: "/pricing",
      search: "?orderId=ord_9f8&returnUrl=%2Freadings%2Fdeep%3Fsession%3DABC&utm_source=x",
      currentLocale: "en",
    }).href).toBe("/zh/pricing?returnUrl=%2Fzh%2Freadings%2Fdeep%3Fsession%3DABC&orderId=ord_9f8");
  });

  it("maps a nested callback target inside the auth surface", () => {
    expect(localeSwitchTarget({
      pathname: "/signin",
      search: "?callbackURL=%2Freadings%2Fresult%3Fsession%3DABC",
      currentLocale: "en",
    }).href).toBe("/zh/signin?callbackURL=%2Fzh%2Freadings%2Fresult%3Fsession%3DABC");
  });

  it("leaves an external nested target untouched", () => {
    expect(mapInternalPathLocale("https://example.com/x?y=1", "zh-Hans")).toBe("https://example.com/x?y=1");
    expect(mapInternalPathLocale("ord_123", "zh-Hans")).toBe("ord_123");
  });

  it("keeps a semantic section anchor on a content surface", () => {
    expect(localeSwitchTarget({
      pathname: "/hexagrams/1-the-creative",
      hash: "#line-3",
      currentLocale: "en",
    }).href).toBe("/zh/hexagrams/1-the-creative#line-3");
  });

  it("drops a fragment that has no equivalent on a flow surface", () => {
    expect(localeSwitchTarget({
      pathname: "/readings/result",
      search: "?session=ABC",
      hash: "#stone-copy",
      currentLocale: "en",
    }).href).toBe("/zh/readings/result?session=ABC");
  });
});

describe("auth callback preservation", () => {
  it("keeps the sealed session that the auth flow must return to", () => {
    expect(authCallbackPath({
      pathname: "/readings/result",
      search: "?session=ABC-123",
    })).toBe("/readings/result?session=ABC-123");
  });

  it("keeps the pricing return target and payment recovery identity", () => {
    expect(authCallbackPath({
      pathname: "/pricing",
      search: "?returnUrl=%2Freadings%2Fdeep%3Fsession%3DABC&orderId=ord_9f8&utm_source=x",
    })).toBe("/pricing?returnUrl=%2Freadings%2Fdeep%3Fsession%3DABC&orderId=ord_9f8");
  });

  it("does not smuggle opaque or unrelated query state into the callback", () => {
    expect(authCallbackPath({
      pathname: "/readings/result",
      search: "?session=ABC&orderId=ord_1&utm_source=x",
    })).toBe("/readings/result?session=ABC");
  });

  it("keeps a hexagram line anchor", () => {
    expect(authCallbackPath({
      pathname: "/hexagrams/2-the-receptive",
      hash: "#line-5",
    })).toBe("/hexagrams/2-the-receptive#line-5");
  });
});

/** Parses a serialized href into its surface + query without re-encoding. */
function surface(href: string): { pathname: string; params: URLSearchParams } {
  const url = new URL(href, "https://quickiching.test");
  return { pathname: url.pathname, params: url.searchParams };
}

describe("nested semantic locale context (recursive mapping)", () => {
  it("maps callbackURL → readings/result and keeps the nested session", () => {
    const search = new URLSearchParams({ callbackURL: "/readings/result?session=ABC" }).toString();
    const target = localeSwitchTarget({ pathname: "/signin", search: `?${search}`, currentLocale: "en" });
    const outer = surface(target.href);
    expect(outer.pathname).toBe("/zh/signin");
    const nested = surface(outer.params.get("callbackURL") ?? "");
    expect(nested.pathname).toBe("/zh/readings/result");
    expect(nested.params.get("session")).toBe("ABC");
  });

  it("maps callbackURL → pricing → returnUrl → readings/deep (EN → ZH)", () => {
    const deep = "/readings/deep?session=ABC";
    const pricing = `/pricing?${new URLSearchParams({ returnUrl: deep }).toString()}`;
    const search = new URLSearchParams({ callbackURL: pricing }).toString();
    const target = localeSwitchTarget({ pathname: "/signin", search: `?${search}`, currentLocale: "en" });

    const level1 = surface(target.href);
    expect(level1.pathname).toBe("/zh/signin");
    const level2 = surface(level1.params.get("callbackURL") ?? "");
    expect(level2.pathname).toBe("/zh/pricing");
    const level3 = surface(level2.params.get("returnUrl") ?? "");
    expect(level3.pathname).toBe("/zh/readings/deep");
    expect(level3.params.get("session")).toBe("ABC");
  });

  it("maps the same three-level chain back from ZH → EN", () => {
    const deep = "/zh/readings/deep?session=ABC";
    const pricing = `/zh/pricing?${new URLSearchParams({ returnUrl: deep }).toString()}`;
    const search = new URLSearchParams({ callbackURL: pricing }).toString();
    const target = localeSwitchTarget({ pathname: "/zh/signin", search: `?${search}`, currentLocale: "zh-Hans" });

    const level1 = surface(target.href);
    expect(level1.pathname).toBe("/signin");
    const level2 = surface(level1.params.get("callbackURL") ?? "");
    expect(level2.pathname).toBe("/pricing");
    const level3 = surface(level2.params.get("returnUrl") ?? "");
    expect(level3.pathname).toBe("/readings/deep");
    expect(level3.params.get("session")).toBe("ABC");
  });

  it("maps returnUrl → readings/result on Pricing", () => {
    const search = new URLSearchParams({ returnUrl: "/readings/result?session=XYZ" }).toString();
    const target = localeSwitchTarget({ pathname: "/pricing", search: `?${search}`, currentLocale: "en" });
    const outer = surface(target.href);
    expect(outer.pathname).toBe("/zh/pricing");
    const nested = surface(outer.params.get("returnUrl") ?? "");
    expect(nested.pathname).toBe("/zh/readings/result");
    expect(nested.params.get("session")).toBe("XYZ");
  });

  it("preserves a nested semantic fragment", () => {
    const search = new URLSearchParams({ callbackURL: "/hexagrams/1-the-creative#line-3" }).toString();
    const target = localeSwitchTarget({ pathname: "/signin", search: `?${search}`, currentLocale: "en" });
    const outer = surface(target.href);
    const value = outer.params.get("callbackURL") ?? "";
    expect(value).toBe("/zh/hexagrams/1-the-creative#line-3");
  });

  it("preserves nested opaque values and analytics params verbatim", () => {
    const nested = "/pricing?orderId=ord_9f8&utm_source=news&session=KEEP";
    const result = mapInternalPathLocale(nested, "zh-Hans");
    const parsed = surface(result);
    expect(parsed.pathname).toBe("/zh/pricing");
    expect(parsed.params.get("orderId")).toBe("ord_9f8");
    expect(parsed.params.get("utm_source")).toBe("news");
    expect(parsed.params.get("session")).toBe("KEEP");
  });

  it("never rewrites an external target or an unsafe callback target", () => {
    expect(mapInternalPathLocale("https://example.com/x?y=1", "zh-Hans")).toBe("https://example.com/x?y=1");
    expect(mapInternalPathLocale("//evil.example/path", "zh-Hans")).toBe("//evil.example/path");
    expect(mapInternalPathLocale("/readings/result\\evil", "zh-Hans")).toBe("/readings/result\\evil");
    expect(mapInternalPathLocale("/%2Fevil.example", "zh-Hans")).toBe("/%2Fevil.example");
    expect(mapInternalPathLocale("ord_123", "zh-Hans")).toBe("ord_123");
  });

  it("keeps allowlisted S16 recovery state without blindly copying outer query state", () => {
    const target = localeSwitchTarget({
      pathname: "/pricing",
      search: "?orderId=ord_9f8&utm_campaign=x&returnUrl=%2Freadings%2Fdeep%3Fsession%3DABC",
      currentLocale: "en",
    });
    const outer = surface(target.href);
    expect(outer.params.get("orderId")).toBe("ord_9f8");
    expect(outer.params.get("utm_campaign")).toBeNull();
    expect(outer.params.has("returnUrl")).toBe(true);
  });

  it("bounds recursion on untrusted nesting", () => {
    let value = "/readings/result?session=ABC";
    for (let index = 0; index < 10; index += 1) {
      value = `/pricing?${new URLSearchParams({ returnUrl: value }).toString()}`;
    }
    expect(() => mapInternalPathLocale(value, "zh-Hans")).not.toThrow();
    expect(mapInternalPathLocale(value, "zh-Hans").startsWith("/zh/pricing")).toBe(true);
  });

  it("keeps mapped nested targets acceptable to the existing same-origin validator", async () => {
    const { validateAuthCallbackURL } = await import("@/server/auth/callback");
    const mapped = mapInternalPathLocale("/pricing?returnUrl=/readings/deep?session=ABC", "zh-Hans");
    expect(validateAuthCallbackURL(mapped, "https://quickiching.test")).toContain("/zh/pricing");
    for (const unsafe of ["//evil.example/x", "https://evil.example/x", "/%2Fevil"]) {
      expect(() => validateAuthCallbackURL(unsafe, "https://quickiching.test")).toThrow();
      expect(mapInternalPathLocale(unsafe, "zh-Hans")).toBe(unsafe);
    }
  });
});
