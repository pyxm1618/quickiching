import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DeepReadingNeedCredits } from "./deep-reading-need-credits";
import type { PublicReadingMethod } from "@/domain/public-reading/types";

const methods: Array<[PublicReadingMethod, string, string]> = [
  ["three-coin", "Three-Coin", "三枚铜钱"],
  ["yarrow-stalks", "Yarrow Stalks", "蓍草"],
  ["mei-hua-yi-shu", "Mei Hua Yi Shu", "梅花易数"],
  ["manual", "Manual Cast", "手动起卦"],
];

describe("DeepReadingNeedCredits", () => {
  it.each(methods)("keeps %s eligible and preserves cast context", (method, english) => {
    const html = renderToStaticMarkup(<DeepReadingNeedCredits
      locale="en"
      balance={0}
      method={method}
      primaryHexagram={12}
      changingLines={[2, 5]}
      relatingHexagram={45}
      onOpenPricing={vi.fn()}
    />);
    expect(html).toContain('data-deep-reading-state="need-credits"');
    expect(html).toContain(`data-casting-method="${method}"`);
    expect(html).toContain('data-current-balance="0"');
    expect(html).toContain(english);
    expect(html).toContain("#12");
    expect(html).toContain("2, 5");
    expect(html).toContain("#45");
    expect(html).toContain("Choose a Deep Reading pack");
    expect(html).toContain("Buying credits does not start generation");
  });

  it.each(methods)("localizes %s without changing eligibility", (method, _english, chinese) => {
    const html = renderToStaticMarkup(<DeepReadingNeedCredits
      locale="zh-Hans"
      balance={0}
      method={method}
      primaryHexagram={8}
      changingLines={[]}
      relatingHexagram={null}
      onOpenPricing={vi.fn()}
    />);
    expect(html).toContain(chinese);
    expect(html).toContain("继续需要 1 次深度解读额度");
    expect(html).toContain("无动爻");
    expect(html).toContain("无之卦");
  });
});
