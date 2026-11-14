import { describe, expect, it } from "vitest";
import {
  hasReadingReturnContext,
  resolveSurfaceContract,
  surfaceIdForPath,
  surfacesWithoutPrimaryNavigation,
  localeSwitchableSurfaces,
} from "./surface-contract";

describe("Surface Contract", () => {
  it.each([
    ["/", "S01"],
    ["/zh", "S01"],
    ["/hexagrams", "S03"],
    ["/zh/hexagrams", "S03"],
    ["/hexagrams/1-the-creative", "S04"],
    ["/zh/hexagrams/64-before-completion", "S04"],
    ["/methods/three-coin", "S05"],
    ["/zh/methods/three-coin", "S05"],
    ["/methods/yarrow-stalks", "S06"],
    ["/methods/mei-hua-yi-shu", "S07"],
    ["/zh/methods/manual-cast", "S08"],
    ["/guides/how-to-ask-the-i-ching", "S09"],
    ["/zh/guides/changing-lines", "S09"],
    ["/help", "S10"],
    ["/terms", "S11"],
    ["/readings/choice", "S12"],
    ["/readings/result", "S13"],
    ["/zh/readings/deep", "S14"],
    ["/pricing", "S15"],
    ["/signin", "S17"],
    ["/zh/signup", "S18"],
    ["/my-readings", "S19"],
    ["/account", "S20"],
  ])("maps %s onto %s", (pathname, expected) => {
    expect(surfaceIdForPath(pathname)).toBe(expected);
  });

  it("switches the root route from Home to Flow from live flow state, not from the pathname", () => {
    expect(resolveSurfaceContract({ pathname: "/" }).mode).toBe("home");
    expect(resolveSurfaceContract({ pathname: "/", flowState: { threeCoinStage: "landing" } }).id).toBe("S01");
    expect(resolveSurfaceContract({ pathname: "/", flowState: { threeCoinStage: "question-confirm" } }).id).toBe("S02");
    const refining = resolveSurfaceContract({ pathname: "/", flowState: { threeCoinStage: "ritual" } });
    expect(refining.id).toBe("S02");
    expect(refining.mode).toBe("flow");
    expect(refining.primaryNavigation).toBe(false);
    // Same pathname, different surface: pathname alone is not the authority.
    expect(resolveSurfaceContract({ pathname: "/" }).primaryNavigation).toBe(true);
  });

  it("treats /pricing with a reading return context as the flow surface", () => {
    expect(resolveSurfaceContract({ pathname: "/pricing" }).id).toBe("S15");
    expect(resolveSurfaceContract({ pathname: "/pricing", flowState: { pricingReadingContext: true } }).id).toBe("S16");
  });

  it("keeps discovery navigation off every content, flow and immersive surface the Authority froze", () => {
    for (const pathname of [
      "/guides/how-to-ask-the-i-ching",
      "/help",
      "/privacy",
      "/hexagrams",
      "/readings/choice",
      "/readings/result",
      "/readings/deep",
      "/methods/yarrow-stalks",
      "/methods/mei-hua-yi-shu",
      "/methods/manual-cast",
      "/signin",
      "/signup",
    ]) {
      expect(resolveSurfaceContract({ pathname }).primaryNavigation, pathname).toBe(false);
    }
    for (const pathname of [
      "/hexagrams/1-the-creative",
      "/methods/three-coin",
      "/pricing",
      "/my-readings",
    ]) {
      expect(resolveSurfaceContract({ pathname }).primaryNavigation, pathname).toBe(true);
    }
  });

  it("renders no global shell on the account adapter or the recovery surface", () => {
    expect(resolveSurfaceContract({ pathname: "/account" }).presentation).toBe("none");
    expect(resolveSurfaceContract({ pathname: "/totally-unknown" }).presentation).toBe("none");
    expect(surfaceIdForPath("/totally-unknown")).toBe("S21");
  });

  it("declares the one deferred shell as a contract fact instead of a page override", () => {
    const detail = resolveSurfaceContract({ pathname: "/hexagrams/1-the-creative" });
    expect(detail.presentation).toBe("none");
    expect(detail.deferredShell).toBeTruthy();
    // The Authority's capability row stays declared, so the deviation is visible.
    expect(detail.homeControl).toBe(true);
    expect(detail.localeControl).toBe(true);
    expect(detail.primaryNavigation).toBe(true);
    // No other surface may defer.
    for (const pathname of ["/", "/hexagrams", "/methods/three-coin", "/pricing", "/my-readings", "/readings/result", "/help"]) {
      expect(resolveSurfaceContract({ pathname }).deferredShell, pathname).toBeUndefined();
    }
  });

  it("keeps the locale control on every surface that owns a counterpart", () => {
    expect(localeSwitchableSurfaces()).toContain("S12");
    expect(localeSwitchableSurfaces()).toContain("S14");
    expect(localeSwitchableSurfaces()).toContain("S16");
    expect(localeSwitchableSurfaces()).not.toContain("S21");
    expect(surfacesWithoutPrimaryNavigation()).toContain("S03");
  });

  it("accepts only an internal return target as a reading return context", () => {
    expect(hasReadingReturnContext("?returnUrl=%2Freadings%2Fresult%3Fsession%3Dabc")).toBe(true);
    expect(hasReadingReturnContext("returnUrl=/readings/result?session=abc")).toBe(true);
    expect(hasReadingReturnContext("?returnUrl=https%3A%2F%2Fevil.example")).toBe(false);
    expect(hasReadingReturnContext("?returnUrl=%2F%2Fevil.example")).toBe(false);
    expect(hasReadingReturnContext("?orderId=ord_1")).toBe(false);
    expect(hasReadingReturnContext(undefined)).toBe(false);
  });
});
