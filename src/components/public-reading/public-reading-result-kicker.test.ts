import { describe, expect, it } from "vitest";
import { resolveReadingKicker } from "./public-reading-result";
import { ZH_HANS_UI_DICTIONARY } from "@/i18n/dictionaries/zh-Hans";
import { EN_UI_DICTIONARY } from "@/i18n/dictionaries/en";
import { buildPublicReading } from "@/domain/public-reading/reading";
import type { PublicReadingMethod } from "@/domain/public-reading/types";

function mockReading(method: PublicReadingMethod, version: string) {
  return buildPublicReading({
    id: `test-${method}`,
    createdAt: "2026-09-23T12:00:00.000Z",
    method,
    methodVersion: version,
    question: "测试问题",
    lineValuesBottomUp: [7, 8, 9, 6, 7, 8],
    evidence: { kind: "history", originalMethod: method },
  });
}

describe("PublicReadingResult Kicker Method Perception", () => {
  it("resolves Three-Coin Chinese kicker accurately without internal version numbers", () => {
    const reading = mockReading("three-coin", "three-coin-v1");
    const kicker = resolveReadingKicker(reading, ZH_HANS_UI_DICTIONARY);
    expect(kicker).toBe("三枚铜钱 · 基础解读");
    expect(kicker).not.toContain("-v1");
    expect(kicker).not.toContain("梅花易数");
  });

  it("resolves Yarrow Chinese kicker accurately without internal version numbers", () => {
    const reading = mockReading("yarrow-stalks", "yarrow-v1");
    const kicker = resolveReadingKicker(reading, ZH_HANS_UI_DICTIONARY);
    expect(kicker).toBe("蓍草起卦 · 基础解读");
    expect(kicker).not.toContain("-v1");
    expect(kicker).not.toContain("梅花易数");
  });

  it("resolves Mei Hua Chinese kicker accurately without internal version numbers", () => {
    const reading = mockReading("mei-hua-yi-shu", "mei-hua-v1");
    const kicker = resolveReadingKicker(reading, ZH_HANS_UI_DICTIONARY);
    expect(kicker).toBe("梅花易数 · 基础解读");
    expect(kicker).not.toContain("-v1");
  });

  it("resolves Manual Cast Chinese kicker accurately without internal version numbers", () => {
    const reading = mockReading("manual", "manual-v1");
    const kicker = resolveReadingKicker(reading, ZH_HANS_UI_DICTIONARY);
    expect(kicker).toBe("手动起卦 · 基础解读");
    expect(kicker).not.toContain("-v1");
    expect(kicker).not.toContain("梅花易数");
  });

  it("preserves English static kicker contract for English dictionary", () => {
    const reading = mockReading("three-coin", "three-coin-v1");
    const kicker = resolveReadingKicker(reading, EN_UI_DICTIONARY);
    expect(kicker).toBe("Static reading · three-coin-v1");
  });
});
