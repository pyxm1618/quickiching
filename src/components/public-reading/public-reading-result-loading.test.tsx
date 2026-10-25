import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _prefetch, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { PublicReadingResult } from "./public-reading-result";
import { buildPublicReading } from "@/domain/public-reading/reading";
import { loadHexagramInterpretation } from "@/domain/interpretation/v2/load-interpretation";
import { EN_UI_DICTIONARY } from "@/i18n/dictionaries/en";
import { ZH_HANS_UI_DICTIONARY } from "@/i18n/dictionaries/zh-Hans";
import { zhHansReadingContentFor } from "@/content/mei-hua-yi-shu/zh-Hans";

function reading(lineValuesBottomUp: number[]) {
  return buildPublicReading({
    method: "three-coin",
    methodVersion: "three-coin-v1",
    lineValuesBottomUp,
    evidence: { kind: "history", originalMethod: "three-coin" },
  });
}

describe("PublicReadingResult interpretation loading", () => {
  it("shows a stable shell instead of fallback interpretation while an opted-in English result has no bundle", () => {
    const current = reading([7, 7, 7, 7, 7, 7]);
    const html = renderToStaticMarkup(
      <PublicReadingResult
        reading={current}
        dictionary={EN_UI_DICTIONARY}
        deferFallbackInterpretation
      />,
    );

    expect(html).toContain("data-reading-interpretation-loading");
    expect(html).toContain("Loading the interpretation…");
    expect(html).not.toContain("data-primary-card");
    expect(html).not.toContain("data-relating-card");
  });

  it("renders the final primary and relating interpretation once both required bundles are present", async () => {
    const current = reading([9, 7, 7, 7, 7, 7]);
    expect(current.relatingHexagram).not.toBeNull();
    const primary = await loadHexagramInterpretation(current.primaryHexagram);
    const relating = await loadHexagramInterpretation(current.relatingHexagram!);

    const html = renderToStaticMarkup(
      <PublicReadingResult
        reading={current}
        dictionary={EN_UI_DICTIONARY}
        deferFallbackInterpretation
        initialBundles={{ primary, relating }}
      />,
    );

    expect(html).not.toContain("data-reading-interpretation-loading");
    expect(html).toContain("data-primary-card");
    expect(html).toContain("data-relating-card");
    expect(html).toContain(primary.hexagram.coreTheme);
    expect(html).toContain(relating.hexagram.coreTheme);
  });

  it("does not wait for a relating bundle when the reading has no changing lines", async () => {
    const current = reading([7, 7, 7, 7, 7, 7]);
    expect(current.relatingHexagram).toBeNull();
    const primary = await loadHexagramInterpretation(current.primaryHexagram);

    const html = renderToStaticMarkup(
      <PublicReadingResult
        reading={current}
        dictionary={EN_UI_DICTIONARY}
        deferFallbackInterpretation
        initialBundles={{ primary, relating: null }}
      />,
    );

    expect(html).not.toContain("data-reading-interpretation-loading");
    expect(html).toContain("data-primary-card");
    expect(html).toContain("data-no-relating-card");
    expect(html).toContain(primary.hexagram.coreTheme);
  });

  it("leaves the existing localized Chinese rendering path unchanged", () => {
    const current = reading([9, 7, 7, 7, 7, 7]);
    const localizedContent = zhHansReadingContentFor([
      current.primaryHexagram,
      ...(current.relatingHexagram === null ? [] : [current.relatingHexagram]),
    ]);

    const html = renderToStaticMarkup(
      <PublicReadingResult
        reading={current}
        dictionary={ZH_HANS_UI_DICTIONARY}
        localizedContent={localizedContent}
        deferFallbackInterpretation
      />,
    );

    expect(html).not.toContain("data-reading-interpretation-loading");
    expect(html).not.toContain("data-reading-localization-loading");
    expect(html).toContain("data-primary-card");
  });
});
