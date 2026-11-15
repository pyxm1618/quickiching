import { describe, expect, it, vi } from "vitest";
import {
  getNavigationLocationSnapshot,
  publishNavigationLocation,
  subscribeNavigationLocation,
  type NavigationLocation,
} from "./navigation-location";

const location = (
  pathname: string,
  search: string,
  hash: string,
): NavigationLocation => ({ pathname, search, hash });

describe("shared reactive navigation location", () => {
  it("publishes a same-path query change and notifies every consumer", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeNavigationLocation(listener);
    publishNavigationLocation(location("/readings/result", "?session=A", ""));
    expect(getNavigationLocationSnapshot()).toEqual(location("/readings/result", "?session=A", ""));

    publishNavigationLocation(location("/readings/result", "?session=B", ""));
    expect(getNavigationLocationSnapshot().search).toBe("?session=B");
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it("publishes a same-path hash change and notifies every consumer", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeNavigationLocation(listener);
    publishNavigationLocation(location("/guides/changing-lines", "", "#section-a"));
    publishNavigationLocation(location("/guides/changing-lines", "", "#section-b"));
    expect(getNavigationLocationSnapshot().hash).toBe("#section-b");
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("models a back/forward transition as a single shared snapshot", () => {
    const seen: string[] = [];
    const unsubscribe = subscribeNavigationLocation(() => {
      seen.push(getNavigationLocationSnapshot().search);
    });
    publishNavigationLocation(location("/readings/result", "?session=A", ""));
    publishNavigationLocation(location("/readings/result", "?session=B", "#line-2"));
    publishNavigationLocation(location("/readings/result", "?session=A", ""));
    expect(seen).toEqual(["?session=A", "?session=B", "?session=A"]);
    unsubscribe();
  });

  it("does not notify when the location is unchanged", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeNavigationLocation(listener);
    publishNavigationLocation(location("/pricing", "?returnUrl=%2Freadings%2Fdeep", ""));
    const before = listener.mock.calls.length;
    publishNavigationLocation(location("/pricing", "?returnUrl=%2Freadings%2Fdeep", ""));
    expect(listener).toHaveBeenCalledTimes(before);
    unsubscribe();
  });

  it("delivers one snapshot to multiple independent subscribers", () => {
    const locale = vi.fn();
    const auth = vi.fn();
    const offLocale = subscribeNavigationLocation(locale);
    const offAuth = subscribeNavigationLocation(auth);
    publishNavigationLocation(location("/readings/choice", "?session=C", ""));
    expect(getNavigationLocationSnapshot()).toEqual(location("/readings/choice", "?session=C", ""));
    expect(locale).toHaveBeenCalled();
    expect(auth).toHaveBeenCalled();
    offLocale();
    offAuth();
  });
});
