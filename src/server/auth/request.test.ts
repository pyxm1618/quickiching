import { describe, expect, it } from "vitest";
import { normalizeAuthRequestBody } from "./request";

describe("Auth request normalization", () => {
  it("canonicalizes email input and reduces same-origin callbacks to paths", () => {
    expect(normalizeAuthRequestBody({
      email: " User@Example.COM ",
      callbackURL: "https://www.quickiching.com/signin?intent=abc",
    }, "https://www.quickiching.com")).toEqual({
      email: "user@example.com",
      callbackURL: "/signin?intent=abc",
    });
  });

  it("normalizes success, new-user, and error callbacks through the same same-origin guard", () => {
    expect(normalizeAuthRequestBody({
      provider: "google",
      callbackURL: "https://www.quickiching.com/history?from=auth",
      newUserCallbackURL: "/history?from=new",
      errorCallbackURL: "/signin?callbackURL=%2Fhistory",
    }, "https://www.quickiching.com")).toMatchObject({
      callbackURL: "/history?from=auth",
      newUserCallbackURL: "/history?from=new",
      errorCallbackURL: "/signin?callbackURL=%2Fhistory",
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
