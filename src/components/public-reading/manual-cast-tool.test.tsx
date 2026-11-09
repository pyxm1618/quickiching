import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EN_UI_DICTIONARY } from "@/i18n/dictionaries/en";
import { ZH_HANS_UI_DICTIONARY } from "@/i18n/dictionaries/zh-Hans";
import { manualFromPrimaryAndChangingLines } from "@/domain/public-reading/manual";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import {
  ManualHexagramMovingInput,
  ManualHexagramPicker,
  ManualSixLinesInput,
} from "./manual-cast-tool";

describe("Manual Cast formal UI", () => {
  it("renders Mode A top-to-bottom while keeping all 6/7/8/9 choices as real buttons", () => {
    const html = renderToStaticMarkup(
      <ManualSixLinesInput values={[7, 6, 8, 9, 7, 8]} dictionary={EN_UI_DICTIONARY} onChange={() => {}} />,
    );

    expect([...html.matchAll(/data-line-row-position="(\d)"/g)].map((match) => Number(match[1])))
      .toEqual([6, 5, 4, 3, 2, 1]);
    expect(html).not.toContain("<select");
    expect(html).toContain('data-line-position="2" data-line-value="6"');
    expect(html).toContain('data-line-position="4" data-line-value="9"');
    expect(html).toContain("Old Yin");
    expect(html).toContain("Old Yang");
    expect(html).toContain("Changing");
    expect(html).toContain("○");
    expect(html).toContain("×");
  });

  it("uses complete Chinese line labels rather than partial English-shaped labels", () => {
    const html = renderToStaticMarkup(
      <ManualSixLinesInput values={[7, 7, 7, 7, 7, 7]} dictionary={ZH_HANS_UI_DICTIONARY} onChange={() => {}} />,
    );

    expect(html).toContain("第 6 爻");
    expect(html).toContain("第 1 爻");
    expect(html).not.toContain(">Line ");
  });

  it("defers all 64 picker options until the custom picker is open", () => {
    const closed = renderToStaticMarkup(
      <ManualHexagramPicker dictionary={EN_UI_DICTIONARY} selected={1} open={false} onOpenChange={() => {}} onSelect={() => {}} />,
    );
    const open = renderToStaticMarkup(
      <ManualHexagramPicker dictionary={EN_UI_DICTIONARY} selected={1} open onOpenChange={() => {}} onSelect={() => {}} />,
    );

    expect(closed).not.toContain('role="option"');
    expect((open.match(/role="option"/g) ?? []).length).toBe(64);
    expect(open).not.toContain("<select");
  });

  it("renders zero moving lines as a legal no-relating preview", () => {
    const values = manualFromPrimaryAndChangingLines(1, []);
    const result = buildHexagramResult({ lineValuesBottomUp: values, method: "manual", algorithmVersion: "manual-cast-v1" });
    const html = renderToStaticMarkup(
      <ManualHexagramMovingInput
        dictionary={EN_UI_DICTIONARY}
        primaryHexagram={1}
        changingLines={[]}
        lineValues={values}
        relatingHexagramNumber={result.relatingHexagramNumber}
        relatingLineValues={null}
        pickerOpen={false}
        onPickerOpenChange={() => {}}
        onPrimaryChange={() => {}}
        onToggleChangingLine={() => {}}
      />,
    );

    expect(result.relatingHexagramNumber).toBeNull();
    expect(html).toContain('data-relating-hexagram-number="none"');
    expect(html).toContain("No relating hexagram");
    expect((html.match(/data-moving-line-position="/g) ?? []).length).toBe(6);
    expect(html).not.toContain('type="checkbox"');
  });

  it("renders multiple moving lines and the deterministic relating preview", () => {
    const changingLines = [3, 5];
    const values = manualFromPrimaryAndChangingLines(1, changingLines);
    const result = buildHexagramResult({ lineValuesBottomUp: values, method: "manual", algorithmVersion: "manual-cast-v1" });
    expect(result.relatingHexagramNumber).not.toBeNull();

    const relatingValues = manualFromPrimaryAndChangingLines(result.relatingHexagramNumber!, []);
    const html = renderToStaticMarkup(
      <ManualHexagramMovingInput
        dictionary={EN_UI_DICTIONARY}
        primaryHexagram={1}
        changingLines={changingLines}
        lineValues={values}
        relatingHexagramNumber={result.relatingHexagramNumber}
        relatingLineValues={relatingValues}
        pickerOpen={false}
        onPickerOpenChange={() => {}}
        onPrimaryChange={() => {}}
        onToggleChangingLine={() => {}}
      />,
    );

    expect(html).toContain('data-moving-line-position="5" data-moving="true"');
    expect(html).toContain('data-moving-line-position="3" data-moving="true"');
    expect(html).toContain('data-relating-hexagram-number="' + result.relatingHexagramNumber + '"');
  });
});
