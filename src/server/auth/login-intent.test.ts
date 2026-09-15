import { describe, expect, it } from "vitest";
import { normalizeLoginIntentInput } from "./login-intent";

describe("Login Intent validation", () => {
  it("requires a non-empty owner digest and a safe callback path", () => {
    expect(() => normalizeLoginIntentInput({
      ownerDigest: " ",
      targetResource: "casting:abc",
      callbackURL: "/signin",
    }, "https://www.quickiching.com")).toThrow("LOGIN_INTENT_INVALID");

    expect(() => normalizeLoginIntentInput({
      ownerDigest: "owner-digest",
      targetResource: "casting:abc",
      callbackURL: "https://evil.example/steal",
    }, "https://www.quickiching.com")).toThrow("LOGIN_INTENT_INVALID");
  });

  it("returns canonical input without retaining arbitrary callback origins", () => {
    expect(normalizeLoginIntentInput({
      ownerDigest: " owner-digest ",
      targetResource: " casting:abc ",
      callbackURL: "https://www.quickiching.com/signin?intent=abc",
    }, "https://www.quickiching.com")).toMatchObject({
      ownerDigest: "owner-digest",
      targetResource: "casting:abc",
      callbackPath: "/signin?intent=abc",
    });
  });

  it("rejects callback encoding that would become an origin or backslash after another decode", () => {
    expect(() => normalizeLoginIntentInput({
      ownerDigest: "owner-digest",
      targetResource: "casting:abc",
      callbackURL: "/%252f%252fevil.example/signin",
    }, "https://www.quickiching.com")).toThrow("LOGIN_INTENT_INVALID");
  });
});
