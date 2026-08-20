import { describe, expect, it } from "vitest";
import { meiHuaFromFields } from "@/domain/casting/mei-hua/algorithm";
import { buildPublicReading, readingFingerprint } from "./reading";
import { buildStaticReading } from "./static-reading";
import { ZH_HANS_READING_CONTENT } from "@/content/mei-hua-yi-shu/zh-Hans";

describe("localized public reading display", () => {
  it("localizes summaries and changing-line structure without changing reading facts", () => {
    const reading = buildPublicReading({
      id: "localized-reading-test",
      createdAt: "2026-08-19T00:00:00.000Z",
      method: "mei-hua-yi-shu",
      lineValuesBottomUp: [9, 7, 7, 7, 7, 7],
      evidence: {
        kind: "mei-hua-yi-shu",
        calculation: meiHuaFromFields({ year: 2026, month: 8, day: 19, hour: 10, ianaTimeZone: "Asia/Shanghai" }),
      },
    });
    const facts = {
      primary: reading.primaryHexagram,
      changing: reading.changingLines,
      relating: reading.relatingHexagram,
      fingerprint: readingFingerprint(reading),
    };

    const model = buildStaticReading(reading, undefined, ZH_HANS_READING_CONTENT);

    expect(model.primary.englishName).toContain("第");
    expect(model.primary.coreMeaning).toContain("乾卦");
    expect(model.activeLines[0]?.lineType).toBe("老阳");
    expect(model.activeLines[0]?.changeDirection).toBe("阳 → 阴");
    expect(model.changing).toContain("动爻");
    expect(model.synthesis.bottomLine).toContain("本卦");
    expect({
      primary: reading.primaryHexagram,
      changing: reading.changingLines,
      relating: reading.relatingHexagram,
      fingerprint: readingFingerprint(reading),
    }).toEqual(facts);
  });
});
