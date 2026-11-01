import { describe, expect, it } from "vitest";
import { normalizeAuthRequestBody } from "./request";

describe("Auth request normalization", () => {
  it("canonicalizes email input and preserves validated same-origin callbacks as absolute URLs", () => {
    expect(normalizeAuthRequestBody({
      email: " User@Example.COM ",
      callbackURL: "https://www.quickiching.com/signin?intent=abc",
    }, "https://www.quickiching.com")).toEqual({
      email: "user@example.com",
      callbackURL: "https://www.quickiching.com/signin?intent=abc",
    });
  });

  it("normalizes success, new-user, and error callbacks through the same same-origin guard", () => {
    expect(normalizeAuthRequestBody({
      provider: "google",
      callbackURL: "https://www.quickiching.com/my-readings?from=auth",
      newUserCallbackURL: "/my-readings?from=new",
      errorCallbackURL: "/signin?callbackURL=%2Fhistory",
    }, "https://www.quickiching.com")).toMatchObject({
      callbackURL: "https://www.quickiching.com/my-readings?from=auth",
      newUserCallbackURL: "https://www.quickiching.com/my-readings?from=new",
      errorCallbackURL: "https://www.quickiching.com/signin?callbackURL=%2Fhistory",
    });
  });

  it.each(["callbackURL", "newUserCallbackURL", "errorCallbackURL"] as const)(
    "rejects an external %s",
    (field) => {
      expect(() => normalizeAuthRequestBody({
        provider: "google",
        [field]: "https://evil.example/steal",
      }, "https://www.quickiching.com")).toThrow("AUTH_CALLBACK_INVALID");
    },
  );

  it("rejects external callback URLs before the Better Auth handler", () => {
    expect(() => normalizeAuthRequestBody({
      provider: "google",
      callbackURL: "https://evil.example/steal",
    }, "https://www.quickiching.com")).toThrow("AUTH_CALLBACK_INVALID");
  });
});
