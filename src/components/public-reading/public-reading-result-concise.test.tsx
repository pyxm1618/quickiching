import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PublicReadingResult } from "./public-reading-result";
import { buildPublicReading } from "@/domain/public-reading/reading";
import { buildStaticReading } from "@/domain/public-reading/static-reading";
import { loadHexagramInterpretation } from "@/domain/interpretation/v2/load-interpretation";
import type { PublicReadingMethod } from "@/domain/public-reading/types";
import type { LineValue } from "@/domain/casting/types";

vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a> }));

const variants = {
  still: [7, 7, 7, 7, 7, 7],
  single: [7, 7, 9, 7, 7, 7],
  multiple: [6, 7, 9, 8, 7, 8],
  all: [6, 9, 6, 9, 6, 9],
} satisfies Record<string, LineValue[]>;

for (const method of ["three-coin", "yarrow-stalks", "mei-hua-yi-shu"] as const satisfies readonly PublicReadingMethod[]) {
  describe(`concise Free reading: ${method}`, () => {
    for (const [variant, lines] of Object.entries(variants)) {
      it(`renders ${variant} cast with actual changes and two dedicated deep links`, async () => {
        const reading = buildPublicReading({ id: `${method}-${variant}`, createdAt: "2026-10-31T00:00:00.000Z", method, methodVersion: "test", lineValuesBottomUp: lines, evidence: { kind: "history", originalMethod: method } });
        const primary = await loadHexagramInterpretation(reading.primaryHexagram);
        const relating = reading.relatingHexagram === null ? null : await loadHexagramInterpretation(reading.relatingHexagram);
        const model = buildStaticReading(reading, { primary, relating });
        const html = renderToStaticMarkup(<PublicReadingResult reading={reading} initialBundles={{ primary, relating }} deepReadingHref="/reading/test/deep" presentation="ritual" />);
        expect(html.match(/Get My Deep Reading/g)).toHaveLength(2);
        expect(html.match(/href="\/reading\/test\/deep"/g)).toHaveLength(2);
        expect(html).toContain("Want to know what this means for your question?");
        expect(html).toContain("data-free-reading-ritual");
        expect(html).toContain("/free-reading/runtime/hero-mobile.jpg");
        const sections = ["data-deep-reading-cta=\"top\"", "data-overall-reading", "data-primary-card", relating ? "data-relating-card" : "data-no-relating-card", "data-changing-lines", "data-reading-transition", "data-deep-reading-cta=\"bottom\""];
        for (let index = 1; index < sections.length; index++) expect(html.indexOf(sections[index - 1])).toBeLessThan(html.indexOf(sections[index]));
        expect(html).toContain(`href="${model.primary.href}"`);
        expect(html).toContain(model.primary.shortMeaning.replaceAll("&", "&amp;").replaceAll("'", "&#x27;"));
        expect(html.match(/data-active-line=/g) ?? []).toHaveLength(reading.changingLines.length);
        for (let position = 1; position <= 6; position++) {
          expect(html.includes(`data-active-line="${position}"`)).toBe(reading.changingLines.includes(position));
          if (reading.changingLines.includes(position)) {
            expect(html).toContain(primary.lines[position - 1].meaning.replaceAll("&", "&amp;").replaceAll("'", "&#x27;"));
            expect(html).toContain(primary.lines[position - 1].changeDynamic.replaceAll("&", "&amp;").replaceAll("'", "&#x27;"));
          }
        }
        for (const retired of ["Judgment", "Image", "oldid", "Position hint", "reading-reflection-title", "reading-cautions-title", "reading-core-title", "reading-synthesis-title", "data-ritual-result-card"]) expect(html).not.toContain(retired);
      });
    }
  });
}


describe("Deep Reading handoff boundaries", () => {
  for (const method of ["manual", "yarrow-stalks", "mei-hua-yi-shu"] as const) {
    it(`retains Free reading and explains unavailable browser history for ${method}`, () => {
      const reading = buildPublicReading({ id: `history-${method}`, createdAt: "2026-10-31T00:00:00.000Z", method, lineValuesBottomUp: variants.still, evidence: { kind: "history", originalMethod: method } });
      const html = renderToStaticMarkup(<PublicReadingResult reading={reading} />);
      expect(html).toContain("Overall Reading");
      expect(html).toContain("Deep Reading is unavailable for this cast");
      expect(html).not.toContain("Get My Deep Reading");
      expect(html).toContain("data-save-reading");
    });
  }
  it("links recoverable three-coin history to the canonical deep route", () => {
    const reading = buildPublicReading({ id: "history-coins", createdAt: "2026-10-31T00:00:00.000Z", method: "three-coin", lineValuesBottomUp: variants.still, evidence: { kind: "history", originalMethod: "three-coin" } });
    const html = renderToStaticMarkup(<PublicReadingResult reading={reading} />);
    expect(html.match(/href="\/readings\/deep\?session=history-coins"/g)).toHaveLength(2);
  });
  it("offers two callback buttons for a caller-managed supported cast", () => {
    const reading = buildPublicReading({ method: "yarrow-stalks", lineValuesBottomUp: variants.still, evidence: { kind: "history", originalMethod: "yarrow-stalks" } });
    const html = renderToStaticMarkup(<PublicReadingResult reading={reading} onDeepReading={() => undefined} />);
    expect(html.match(/Get My Deep Reading/g)).toHaveLength(2);
    expect(html).not.toContain("Deep Reading is unavailable");
  });
});
