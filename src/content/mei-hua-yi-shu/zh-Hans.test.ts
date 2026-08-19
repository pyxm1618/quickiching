import { describe, expect, it } from "vitest";
import { ZH_HANS_MEI_HUA_CONTENT, ZH_HANS_READING_CONTENT } from "./zh-Hans";

describe("Simplified Chinese Mei Hua V1 content", () => {
  it("has a complete non-thin page position and convention explanation", () => {
    expect(ZH_HANS_MEI_HUA_CONTENT.metadata.title).toContain("梅花易数");
    expect(ZH_HANS_MEI_HUA_CONTENT.metadata.description).toContain("公历");
    expect(ZH_HANS_MEI_HUA_CONTENT.introduction.length).toBeGreaterThan(80);
    expect(ZH_HANS_MEI_HUA_CONTENT.convention.paragraphs.join(" ")).toContain("十二时辰");
    expect(ZH_HANS_MEI_HUA_CONTENT.convention.paragraphs.join(" ")).toContain("唯一标准");
    expect(ZH_HANS_MEI_HUA_CONTENT.scope.notSupported.join(" ")).toContain("数字起卦");
    expect(ZH_HANS_MEI_HUA_CONTENT.scope.notSupported.join(" ")).toContain("完整梅花易数排盘");
  });

  it("provides authored Chinese core summaries for all 64 King Wen hexagrams", () => {
    const entries = Object.entries(ZH_HANS_READING_CONTENT.hexagrams);
    expect(entries).toHaveLength(64);
    for (const [number, entry] of entries) {
      expect(Number(number)).toBeGreaterThanOrEqual(1);
      expect(Number(number)).toBeLessThanOrEqual(64);
      expect(entry.displayName.length).toBeGreaterThan(0);
      expect(entry.theme.length).toBeGreaterThan(0);
      expect(entry.coreMeaning.length).toBeGreaterThan(20);
      expect(entry.judgment.length).toBeGreaterThan(0);
      expect(entry.image.length).toBeGreaterThan(0);
    }
  });

  it("keeps Chinese reading language grounded and non-deterministic", () => {
    const text = JSON.stringify({ page: ZH_HANS_MEI_HUA_CONTENT, reading: ZH_HANS_READING_CONTENT });
    expect(text).not.toMatch(/命中注定|一定会发生|精准预测|保证灵验|宇宙告诉你|恐吓/);
    expect(text).toContain("反思");
    expect(text).toContain("确定性预言");
  });
});
