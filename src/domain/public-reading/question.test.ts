import { describe, expect, it } from "vitest";
import { normalizePublicQuestion } from "./question";

describe("normalizePublicQuestion submit boundary", () => {
  it.each([
    ["  Will this work  ", "Will this work"],
    ["  Keep  two internal spaces  ", "Keep  two internal spaces"],
    ["  要继续吗？  ", "要继续吗？"],
    ["  下一步 Next  step  ", "下一步 Next  step"],
  ])("trims only boundary whitespace for %j", (input, expected) => {
    expect(normalizePublicQuestion(input)).toBe(expected);
  });

  it("treats whitespace-only input as no question", () => {
    expect(normalizePublicQuestion("   ")).toBeUndefined();
  });
});
