import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("Adsterra placement boundary", () => {
  it("places exactly one result ad after Bottom Line and before reflection", () => {
    const resultView = source("../three-coin-result/reading-result-view.tsx");
    const adMatches = resultView.match(/<AdsterraResultAd \/>/g) ?? [];
    const bottomLineIndex = resultView.indexOf('id="bottom-line-heading"');
    const adIndex = resultView.indexOf("<AdsterraResultAd />");
    const reflectionIndex = resultView.indexOf('id="reflection-heading"');

    expect(adMatches).toHaveLength(1);
    expect(bottomLineIndex).toBeGreaterThanOrEqual(0);
    expect(adIndex).toBeGreaterThan(bottomLineIndex);
    expect(reflectionIndex).toBeGreaterThan(adIndex);
  });

  it("keeps the indexable public pages free of the result ad component", () => {
    const indexablePages = [
      "../../app/page.tsx",
      "../../app/methods/three-coin/page.tsx",
      "../../app/methods/yarrow-stalks/page.tsx",
      "../../app/methods/mei-hua-yi-shu/page.tsx",
      "../../app/guides/how-to-ask-the-i-ching/page.tsx",
      "../../app/guides/changing-lines/page.tsx",
      "../../app/guides/primary-relating-hexagrams/page.tsx",
      "../../app/hexagrams/page.tsx",
    ];

    for (const page of indexablePages) {
      expect(source(page)).not.toContain("AdsterraResultAd");
    }
  });
});
