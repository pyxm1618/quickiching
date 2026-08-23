import { describe, expect, it } from "vitest";
import { normalizeAuthEmail, validateAuthCallbackURL } from "./callback";

describe("authentication input boundaries", () => {
  it("normalizes email addresses before persistence and lookup", () => {
    expect(normalizeAuthEmail("  User.Name+tag@Example.COM ")).toBe("user.name+tag@example.com");
  });

  it.each([
    "/signin",
    "/signin?intent=abc",
    "https://www.quickiching.com/signin?intent=abc",
  ])("accepts same-origin callback %s", (candidate) => {
    expect(validateAuthCallbackURL(candidate, "https://www.quickiching.com")).toBe(
      candidate.startsWith("http") ? "/signin?intent=abc" : candidate,
    );
  });

  it.each([
    "https://evil.example/signin",
    "//evil.example/signin",
    "https://www.quickiching.com@evil.example/signin",
    "/%2f%2fevil.example/signin",
    "/%252f%252fevil.example/signin",
    "/%252525252f%252525252fevil.example/signin",
    "/\\evil.example/signin",
    "https://www.quickiching.com/%5cevil.example",
    "/%255cevil.example/signin",
  ])("rejects open redirect callback %s", (candidate) => {
    expect(() => validateAuthCallbackURL(candidate, "https://www.quickiching.com")).toThrow(
      "AUTH_CALLBACK_INVALID",
    );
  });

  it("uses a safe same-origin default when callback is absent", () => {
    expect(validateAuthCallbackURL(undefined, "https://www.quickiching.com")).toBe("/");
  });
});
