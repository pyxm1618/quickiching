import React from "react";
import { existsSync, readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { generateThreeCoinLine } from "@/domain/casting/three-coin/algorithm";
import { generateYarrowLine } from "@/domain/casting/yarrow/algorithm";
import { meiHuaFromNumberAndTime } from "@/domain/casting/mei-hua/number-time";
import { buildPublicReading } from "@/domain/public-reading/reading";
import type { PublicReading } from "@/domain/public-reading/types";
import { ResultChoiceView } from "./result-choice-client";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}));

const id = "2d0a4f0d-37e8-42bf-9232-9d40518f1e4f";
const question = "Should I change to a new job?";
const mei = meiHuaFromNumberAndTime({
  number: 17,
  utcMillis: Date.UTC(2026, 9, 31, 12),
  ianaTimeZone: "UTC",
});
const coinLines = Array.from({ length: 6 }, (_, index) => generateThreeCoinLine(index as 0 | 1 | 2 | 3 | 4 | 5, () => true));
const yarrowLines = Array.from({ length: 6 }, (_, index) => generateYarrowLine(index as 0 | 1 | 2 | 3 | 4 | 5, () => 1));

const readings: PublicReading[] = [
  buildPublicReading({
    id,
    method: "three-coin",
    question,
    lineValuesBottomUp: coinLines.map((line) => line.lineValue),
    evidence: { kind: "three-coin", steps: coinLines },
  }),
  buildPublicReading({
    id,
    method: "yarrow-stalks",
    question,
    lineValuesBottomUp: yarrowLines.map((line) => line.lineValue),
    evidence: { kind: "yarrow-stalks", lines: yarrowLines },
  }),
  buildPublicReading({
    id,
    method: "mei-hua-yi-shu",
    methodVersion: mei.algorithmVersion,
    question,
    lineValuesBottomUp: mei.lineValuesBottomUp,
    evidence: { kind: "mei-hua-yi-shu", calculation: mei },
  }),
  buildPublicReading({
    id,
    method: "manual",
    question,
    lineValuesBottomUp: [7, 8, 9, 6, 7, 8],
    evidence: { kind: "manual", mode: "line-values" },
  }),
];

describe("shared post-cast Result Choice", () => {
  it.each(readings.map((reading) => [reading.method, reading] as const))(
    "renders the same choice contract for %s without an auth/save gate",
    (_method, reading) => {
      const html = renderToStaticMarkup(<ResultChoiceView reading={reading} locale="en" />);

      expect(html).toContain("data-result-choice");
      expect(html).toContain("data-result-choice-question");
      expect(html).toContain("data-result-choice-primary");
      expect(html).toContain("data-result-choice-changing");
      expect(html).toContain("data-result-choice-relating");
      expect(html).toContain(question);
      expect(html).toContain("Primary Hexagram");
      expect(html).toContain("Changing Hexagram");
      expect(html).toContain("Deep Reading");
      expect(html).toContain("Free Reading");
      expect(html).toContain(`href="/readings/result?session=${id}"`);
      expect(html).toContain(`href="/readings/deep?session=${id}"`);
      expect(html).not.toContain("data-completed-cast-gate");
      expect(html).not.toContain("data-auth-required-before-reveal");
      expect(html).not.toContain("data-account-reading-saving");
      expect(html).not.toContain("data-ritual-result-card");
    },
  );

  it("keeps the same session id in localized Free and Deep destinations", () => {
    const html = renderToStaticMarkup(<ResultChoiceView reading={readings[2]} locale="zh-Hans" />);
    expect(html).toContain(`href="/zh/readings/result?session=${id}"`);
    expect(html).toContain(`href="/zh/readings/deep?session=${id}"`);
    expect(html).toContain("你的问题");
    expect(html).toContain("本卦");
    expect(html).toContain("变卦");
  });

  it("fully retires the legacy ritual result reveal production implementation", () => {
    const publicResult = readFileSync(new URL("../public-reading/public-reading-result.tsx", import.meta.url), "utf8");
    const resultClient = readFileSync(new URL("./reading-result-client.tsx", import.meta.url), "utf8");
    const ritualCss = readFileSync(new URL("../public-reading/ritual.css", import.meta.url), "utf8");

    expect(existsSync(new URL("../public-reading/ritual-result-card.tsx", import.meta.url))).toBe(false);
    expect(publicResult).not.toContain("RitualResultCard");
    expect(publicResult).not.toContain("showRitualReveal");
    expect(resultClient).not.toContain("showRitualReveal");
    expect(ritualCss).not.toContain(".ritual-result-card");
    expect(ritualCss).not.toContain(".ritual-result-title");
    expect(ritualCss).not.toContain(".ritual-result-actions");
    expect(ritualCss).not.toContain("@keyframes ritual-card-enter");
  });
});
