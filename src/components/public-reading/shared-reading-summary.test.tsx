import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SharedReadingSummary } from "./shared-reading-summary";
import { buildPublicReading } from "@/domain/public-reading/reading";
import { buildStaticReading } from "@/domain/public-reading/static-reading";

describe("shared cast summary facts", () => {
  it.each(["three-coin", "yarrow-stalks", "mei-hua-yi-shu"] as const)("renders %s names, six lines and all actual moving positions", (method) => {
    const reading = buildPublicReading({ id: "cast-under-test", createdAt: "2026-10-31T03:00:00Z", method, methodVersion: "test-only", question: "A real question supplied to the component", lineValuesBottomUp: [9, 6, 7, 8, 9, 6], evidence: { kind: "history", originalMethod: method } });
    const model = buildStaticReading(reading);
    const html = renderToStaticMarkup(<SharedReadingSummary reading={reading} model={model} zh={false} onChoose={() => {}} busy={false} error="" />);
    expect(html).toContain(model.primary.englishName);
    expect(html).toContain(model.relating!.englishName);
    expect(html).toContain("Line 1, 2, 5, 6");
    expect([...html.matchAll(/data-line-position="(\d)"/g)].map(match => Number(match[1]))).toEqual([6,5,4,3,2,1,6,5,4,3,2,1]);
    expect(html.match(/data-moving="true"/g)).toHaveLength(4);
    expect(html).toContain('data-reading-choice="deep"');
    expect(html).toContain('data-reading-choice="free"');
  });
  it("does not invent relating lines for an unchanged cast", () => {
    const reading = buildPublicReading({ method: "three-coin", methodVersion: "test-only", lineValuesBottomUp: [7, 8, 7, 8, 7, 8], evidence: { kind: "history", originalMethod: "three-coin" } });
    const html = renderToStaticMarkup(<SharedReadingSummary reading={reading} model={buildStaticReading(reading)} zh={false} onChoose={() => {}} busy={false} error="" />);
    expect(html).toContain("No relating hexagram");
    expect([...html.matchAll(/data-line-position=/g)]).toHaveLength(6);
  });
});
