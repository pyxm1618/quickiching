import { describe, expect, it } from "vitest";
import { fingerprintQuestion, normalizeComposite, normalizeQuestion } from "./normalize";

describe("question fingerprint normalization", () => {
  it.each([
    ["  Will   this work?  ", "will this work"],
    ["Will this work ", "will this work"],
    ["Ｗｉｌｌ　Ｔｈｉｓ　Ｗｏｒｋ？", "will this work"],
    ["下一步  Next   step？", "下一步 next step？"],
  ])("keeps canonical identity normalization for %j", (input, expected) => {
    expect(normalizeQuestion(input)).toBe(expected);
  });

  it("produces the same composite and fingerprint for insignificant whitespace and punctuation variants", () => {
    const left = normalizeComposite("self_reflection", "clarify", " Will   this work? ");
    const right = normalizeComposite("self_reflection", "clarify", "will this work");
    expect(left).toBe(right);
    expect(fingerprintQuestion(left, "test-key", "v1")).toBe(
      fingerprintQuestion(right, "test-key", "v1"),
    );
  });
});
