import { describe, expect, it } from "vitest";
import { normalizeScene } from "./types";

describe("scene vocabulary normalization", () => {
  it("preserves the current domain vocabulary", () => {
    expect(normalizeScene("career")).toBe("career");
    expect(normalizeScene("relationships")).toBe("relationships");
    expect(normalizeScene("choices")).toBe("choices");
    expect(normalizeScene("personal_growth")).toBe("personal_growth");
    expect(normalizeScene("other")).toBe("other");
  });

  it("maps only known historical scene values to current domain semantics", () => {
    expect(normalizeScene("general")).toBe("other");
    expect(normalizeScene("decision")).toBe("choices");
    expect(normalizeScene("spiritual")).toBe("personal_growth");
    expect(normalizeScene("relationship")).toBe("relationships");
    expect(normalizeScene("growth")).toBe("personal_growth");
    expect(normalizeScene("unknown")).toBeNull();
  });
});
