import { describe, expect, it } from "vitest";
import {
  isAnalyticsSurface,
  isGooglePublisherSurface,
  isSensitiveUserSurface,
} from "./privacy-route-policy";

describe("privacy and publisher route policy", () => {
  it.each([
    "/account",
    "/zh/account",
    "/history",
    "/zh/history",
    "/signin",
    "/zh/signin",
    "/signup",
    "/zh/signup",
    "/readings/three-coin/result",
    "/zh/readings/three-coin/result",
    "/checkout/return",
    "/zh/checkout/return",
  ])("classifies %s as a sensitive user surface", (pathname) => {
    expect(isSensitiveUserSurface(pathname)).toBe(true);
    expect(isGooglePublisherSurface(pathname)).toBe(false);
    expect(isAnalyticsSurface(pathname)).toBe(false);
  });

  it.each([
    "/",
    "/zh",
    "/hexagrams",
    "/zh/hexagrams",
    "/hexagrams/64-before-completion",
    "/zh/hexagrams/64-before-completion",
    "/guides/changing-lines",
    "/zh/guides/changing-lines",
    "/methods/three-coin",
    "/zh/methods/three-coin",
    "/pricing",
    "/zh/pricing",
    "/help",
    "/zh/help",
  ])("allows Google publisher and analytics on reviewed public surface %s", (pathname) => {
    expect(isGooglePublisherSurface(pathname)).toBe(true);
    expect(isAnalyticsSurface(pathname)).toBe(true);
  });

  it("allows the Google CMP on privacy pages without enabling analytics there", () => {
    expect(isGooglePublisherSurface("/privacy")).toBe(true);
    expect(isGooglePublisherSurface("/zh/privacy")).toBe(true);
    expect(isAnalyticsSurface("/privacy")).toBe(false);
    expect(isAnalyticsSurface("/zh/privacy")).toBe(false);
  });

  it.each([
    "/terms",
    "/zh/terms",
    "/acceptable-use",
    "/zh/acceptable-use",
    "/unknown-route",
    "/zh/unknown-route",
  ])("fails closed on non-reviewed publisher surface %s", (pathname) => {
    expect(isGooglePublisherSurface(pathname)).toBe(false);
    expect(isAnalyticsSurface(pathname)).toBe(false);
  });
});
