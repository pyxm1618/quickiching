import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HexagramLines } from "./hexagram-lines";

describe("HexagramLines Accessibility Localization", () => {
  it("renders pure Chinese accessible labels when locale is zh-Hans", () => {
    const html = renderToStaticMarkup(
      <HexagramLines
        lines={[7, 8, 9, 6, 7, 8]}
        sealedCount={6}
        showLabels
        locale="zh-Hans"
      />,
    );

    // 断言包含纯中文爻名与动爻描述
    expect(html).toContain('aria-label="第 6 爻：阴爻"');
    expect(html).toContain('aria-label="第 5 爻：阳爻"');
    expect(html).toContain('aria-label="第 4 爻：阴爻，动爻"');
    expect(html).toContain('aria-label="第 3 爻：阳爻，动爻"');
    expect(html).toContain('aria-label="第 2 爻：阴爻"');
    expect(html).toContain('aria-label="第 1 爻：阳爻"');

    // 严禁包含英文 Line / yang / yin / moving
    expect(html).not.toMatch(/Line \d/);
    expect(html).not.toContain("yang");
    expect(html).not.toContain("yin");
    expect(html).not.toContain("moving");
  });

  it("renders Chinese uncast accessible labels when lines are incomplete", () => {
    const html = renderToStaticMarkup(
      <HexagramLines
        lines={[7, 8]}
        sealedCount={2}
        showLabels
        locale="zh-Hans"
      />,
    );

    expect(html).toContain('aria-label="第 3 爻：尚未起出"');
    expect(html).not.toContain("not yet cast");
  });

  it("preserves English accessible labels when locale is en", () => {
    const html = renderToStaticMarkup(
      <HexagramLines
        lines={[7, 8, 9, 6, 7, 8]}
        sealedCount={6}
        showLabels
        locale="en"
      />,
    );

    expect(html).toContain('aria-label="Line 6: yin"');
    expect(html).toContain('aria-label="Line 4: yin, moving"');
    expect(html).toContain('aria-label="Line 3: yang, moving"');
  });
});
