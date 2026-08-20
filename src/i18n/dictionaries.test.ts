import { describe, expect, it } from "vitest";
import { getDictionary } from "./dictionaries";

describe("locale UI dictionaries", () => {
  it("provides the same UI surface for English and Simplified Chinese", () => {
    const english = getDictionary("en");
    const chinese = getDictionary("zh-Hans");
    expect(Object.keys(chinese)).toEqual(Object.keys(english));
    expect(chinese.questionFirst.heading).toContain("反思");
    expect(chinese.meiHua.castButton).toContain("起卦");
    expect(chinese.reading.primary).toBe("本卦");
    expect(chinese.reading.relating).toBe("之卦");
    expect(chinese.reading.aiDisabledNotice).toContain("AI");
    expect(english.questionFirst.heading).toContain("reflect");
    expect(english.reading.primary).toBe("Primary Hexagram");
  });
});
