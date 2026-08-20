import { describe, expect, it } from "vitest";
import { buildPublicReading } from "./reading";
import { buildStaticReading } from "./static-reading";
import { ZH_HANS_READING_CONTENT } from "@/content/mei-hua-yi-shu/zh-Hans";

describe("Chinese classical text display boundaries", () => {
  it("returns the real classical line together with a separately named structural hint", () => {
    const reading = buildPublicReading({
      method: "manual",
      lineValuesBottomUp: [9, 7, 7, 7, 7, 7],
      evidence: { kind: "manual", mode: "line-values" },
    });
    const model = buildStaticReading(reading, undefined, ZH_HANS_READING_CONTENT);
    const line = model.activeLines[0] as typeof model.activeLines[number] & {
      classicalLine: { label: string; text: string; sourceUrl: string };
      positionHint: string;
    };

    expect(line.classicalLine).toMatchObject({ label: "初九", text: "潜龙勿用。" });
    expect(line.classicalLine.sourceUrl).toContain("oldid=");
    expect(line.positionHint).toBeTruthy();
    expect(line.positionHint).not.toBe(line.classicalLine.text);
  });

  it("does not describe generic position hints as classical line text", () => {
    const serialized = JSON.stringify(ZH_HANS_READING_CONTENT);
    expect(serialized).toContain("linePositionHints");
    expect(serialized).not.toContain("linePhases");
    expect(serialized).not.toContain("卦辞与象辞");
    expect(serialized).toContain("QuickIChing");
  });
});
