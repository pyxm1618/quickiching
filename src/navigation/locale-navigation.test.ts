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

  it("does not copy unrelated or opaque query state", () => {
    expect(localeSwitchTarget({
      pathname: "/pricing",
      search: "?orderId=ord_9f8&returnUrl=%2Freadings%2Fdeep%3Fsession%3DABC&utm_source=x",
      currentLocale: "en",
    }).href).toBe("/zh/pricing?returnUrl=%2Fzh%2Freadings%2Fdeep%3Fsession%3DABC");
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

  it("keeps the pricing return target", () => {
    expect(authCallbackPath({
      pathname: "/pricing",
      search: "?returnUrl=%2Freadings%2Fdeep%3Fsession%3DABC",
    })).toBe("/pricing?returnUrl=%2Freadings%2Fdeep%3Fsession%3DABC");
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
