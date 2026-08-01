import { describe, expect, it } from "vitest";
import { safeCallbackPath } from "./callback-path";

describe("safeCallbackPath", () => {
  it("preserves local result paths and query strings", () => {
    expect(safeCallbackPath("/result/cas_123?from=signin#reading")).toBe(
      "/result/cas_123?from=signin#reading",
    );
  });

  it.each([
    "https://attacker.example/path",
    "//attacker.example/path",
    "/\\attacker.example/path",
    "javascript:alert(1)",
    "",
  ])("rejects unsafe callback %s", (candidate) => {
    expect(safeCallbackPath(candidate)).toBe("/account");
  });
});
