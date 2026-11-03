import { describe, expect, it } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { ZH_HANS_MEI_HUA_CONTENT, ZH_HANS_READING_CONTENT } from "./zh-Hans";

describe("Simplified Chinese terminology boundaries", () => {
  it("labels the active number + moment convention precisely", () => {
    const convention = ZH_HANS_MEI_HUA_CONTENT.convention.paragraphs.join(" ");
    expect(ZH_HANS_MEI_HUA_CONTENT.scope.supported).toContain("一个用户数字 + 确认时刻起卦");
    expect(ZH_HANS_MEI_HUA_CONTENT.scope.notSupported).toContain("旧版仅当前时间起卦");
    expect(convention).toContain("按八取余");
    expect(convention).toContain("按六取余");
    expect(convention).toContain("不使用年月日");
    expect(convention).toContain("IANA");
  });

  it("uses 大象（《象传》） and separates the three content layers", () => {
    const dictionary = getDictionary("zh-Hans");
    const reading = dictionary.reading as unknown as Record<string, string>;
    expect(reading.classicalLine).toBe("经典爻辞");
    expect(reading.originalExplanation).toBe("QuickIChing 原创说明");
    expect(reading.positionHint).toBe("爻位结构提示");
    expect(ZH_HANS_READING_CONTENT.messages.supports.join(" ")).toContain("大象（《象传》）");
    expect(JSON.stringify(ZH_HANS_MEI_HUA_CONTENT)).not.toContain("象辞");
  });

  it("replaces the over-narrow 43rd hexagram product summary", () => {
    const hexagram43 = ZH_HANS_READING_CONTENT.hexagrams[43];
    expect(hexagram43?.theme).toBe("公开决断与戒慎");
    expect(hexagram43?.coreMeaning).toContain("公开");
    expect(hexagram43?.coreMeaning).toContain("不利即戎");
    expect(hexagram43?.coreMeaning).not.toContain("决裂前的澄清");
  });
});
