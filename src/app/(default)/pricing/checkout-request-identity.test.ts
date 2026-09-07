import { describe, expect, it } from "vitest";
import {
  checkoutFailurePresentation,
  createCheckoutRequestIdentityStore,
} from "./checkout-request-identity";

describe("checkout request identity", () => {
  it("keeps one transaction identity across retryable/unknown checkout attempts", () => {
    const backing = new Map<string, string>();
    const store = createCheckoutRequestIdentityStore({
      getItem: (key) => backing.get(key) ?? null,
      setItem: (key, value) => backing.set(key, value),
      removeItem: (key) => backing.delete(key),
    }, () => "request-a");

    expect(store.getOrCreate("one")).toBe("request-a");
    store.retain("one");
    expect(store.getOrCreate("one")).toBe("request-a");
  });

  it("clears the identity only after a confirmed checkout handoff", () => {
    const backing = new Map<string, string>();
    const ids = ["request-a", "request-b"];
    const store = createCheckoutRequestIdentityStore({
      getItem: (key) => backing.get(key) ?? null,
      setItem: (key, value) => backing.set(key, value),
      removeItem: (key) => backing.delete(key),
    }, () => ids.shift() ?? "request-c");

    expect(store.getOrCreate("three")).toBe("request-a");
    store.complete("three");
    expect(store.getOrCreate("three")).toBe("request-b");
  });

  it("presents HTTP 409 as an explicit safe conflict state rather than a generic outage", () => {
    expect(checkoutFailurePresentation(409)).toEqual({
      kind: "conflict",
      message: "This checkout is already being resolved. Your purchase identity was preserved; review or retry this same checkout instead of starting a new purchase.",
    });
  });

  it("keeps rate limit and generic transport failures distinct from checkout conflicts", () => {
    expect(checkoutFailurePresentation(429).kind).toBe("rate_limited");
    expect(checkoutFailurePresentation(503).kind).toBe("unavailable");
  });
});
