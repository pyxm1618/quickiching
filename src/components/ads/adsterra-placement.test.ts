import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("Adsterra placement boundary", () => {
  it("places exactly one result ad after Bottom Line and before reflection", () => {
    const resultView = source("../three-coin-result/reading-result-view.tsx");
    const ads = resultView.match(/<AdsterraResultAd \/>/g) ?? [];
    const bottomLine = resultView.indexOf('id="bottom-line-heading"');
    const ad = resultView.indexOf("<AdsterraResultAd />");
    const reflection = resultView.indexOf('id="reflection-heading"');

    expect(ads).toHaveLength(1);
    expect(ad).toBeGreaterThan(bottomLine);
    expect(reflection).toBeGreaterThan(ad);
  });
});
