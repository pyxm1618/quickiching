import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CLASSICAL_HEXAGRAMS } from "@/domain/public-reading/classical";
import { loadPublicHexagramKnowledge } from "@/domain/public-reading/knowledge";
import { hexagramSeoFor, hexagramSeoRows } from "@/content/hexagrams/seo";
import { zhHansHexagramContent } from "@/content/hexagrams/zh-Hans";
import { HexagramDetailPageView } from "./hexagram-detail-page";

function keywordPhrases(value: string): string[] {
  return value.split(/[;；]/u).map((part) => part.trim()).filter(Boolean);
}

function visibleText(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/giu, " ")
    .replace(/<style\b[\s\S]*?<\/style>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp);/giu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

describe("static hexagram detail page", () => {
  it("renders one exact H1 and six same-page line anchors for representative locales", async () => {
    const cases = [
      { number: 1, locale: "en" as const },
      { number: 23, locale: "en" as const },
      { number: 52, locale: "en" as const },
      { number: 54, locale: "en" as const },
      { number: 61, locale: "en" as const },
      { number: 64, locale: "en" as const },
      { number: 1, locale: "zh-Hans" as const },
      { number: 23, locale: "zh-Hans" as const },
      { number: 52, locale: "zh-Hans" as const },
      { number: 54, locale: "zh-Hans" as const },
      { number: 61, locale: "zh-Hans" as const },
      { number: 64, locale: "zh-Hans" as const },
    ];
    for (const item of cases) {
      const knowledge = await loadPublicHexagramKnowledge(item.number);
      const classicalIndex = CLASSICAL_HEXAGRAMS.findIndex((entry) => entry.number === item.number);
      const html = renderToStaticMarkup(
        <HexagramDetailPageView
          locale={item.locale}
          knowledge={knowledge}
          seo={hexagramSeoFor(item.number, item.locale)}
          content={item.locale === "zh-Hans" ? zhHansHexagramContent(item.number) : undefined}
          previous={classicalIndex > 0 ? CLASSICAL_HEXAGRAMS[classicalIndex - 1] : null}
          next={classicalIndex < CLASSICAL_HEXAGRAMS.length - 1 ? CLASSICAL_HEXAGRAMS[classicalIndex + 1] : null}
        />,
      );
      expect((html.match(/<h1\b/g) ?? []).length, item.locale + " " + item.number).toBe(1);
      expect(html).toContain(">" + hexagramSeoFor(item.number, item.locale).finalH1 + "<");
      for (let position = 1; position <= 6; position += 1) {
        expect(html).toContain('id="line-' + position + '"');
      }
      expect(html).toContain("application/ld+json");
      expect(html).toContain('"@type":"WebPage"');
      expect(html).toContain('"@type":"BreadcrumbList"');
    }
  });

  it("keeps the workbook exact metadata for all 128 routes", async () => {
    const englishPage = await import("@/app/(default)/hexagrams/[slug]/page");
    const chinesePage = await import("@/app/(localized)/zh/hexagrams/[slug]/page");
    expect(englishPage.generateStaticParams()).toHaveLength(64);
    expect(chinesePage.generateStaticParams()).toHaveLength(64);

    for (const seo of hexagramSeoRows()) {
      const page = seo.locale === "en" ? englishPage : chinesePage;
      const metadata = await page.generateMetadata({ params: Promise.resolve({ slug: seo.slug }) });
      expect(metadata.title, seo.canonicalUrl).toEqual({ absolute: seo.finalTitle });
      expect(metadata.description, seo.canonicalUrl).toBe(seo.finalDescription);
      expect(metadata.openGraph?.title, seo.canonicalUrl).toBe(seo.finalTitle);
      expect(metadata.openGraph?.description, seo.canonicalUrl).toBe(seo.finalDescription);
    }
  });

  it("gives all 128 pages natural early coverage of the primary and at least one core secondary keyword", async () => {
    for (const seo of hexagramSeoRows()) {
      const knowledge = await loadPublicHexagramKnowledge(seo.number);
      const classicalIndex = CLASSICAL_HEXAGRAMS.findIndex((entry) => entry.number === seo.number);
      const html = renderToStaticMarkup(
        <HexagramDetailPageView
          locale={seo.locale}
          knowledge={knowledge}
          seo={seo}
          content={seo.locale === "zh-Hans" ? zhHansHexagramContent(seo.number) : undefined}
          previous={classicalIndex > 0 ? CLASSICAL_HEXAGRAMS[classicalIndex - 1] : null}
          next={classicalIndex < CLASSICAL_HEXAGRAMS.length - 1 ? CLASSICAL_HEXAGRAMS[classicalIndex + 1] : null}
        />,
      );
      const earlyCopy = html.match(/<p[^>]*data-seo-early-copy[^>]*>([\s\S]*?)<\/p>/iu)?.[1] ?? "";
      const earlyText = visibleText(earlyCopy).toLocaleLowerCase("en-US");
      expect(earlyText, seo.canonicalUrl).toContain(seo.primaryKeyword.toLocaleLowerCase("en-US"));
      expect(
        keywordPhrases(seo.secondaryCore).some((phrase) => earlyText.includes(phrase.toLocaleLowerCase("en-US"))),
        seo.canonicalUrl,
      ).toBe(true);
    }
  });

  it("keeps source provenance without letting repeated source labels dominate the visible copy", async () => {
    for (const locale of ["en", "zh-Hans"] as const) {
      const knowledge = await loadPublicHexagramKnowledge(1);
      const seo = hexagramSeoFor(1, locale);
      const html = renderToStaticMarkup(
        <HexagramDetailPageView
          locale={locale}
          knowledge={knowledge}
          seo={seo}
          content={locale === "zh-Hans" ? zhHansHexagramContent(1) : undefined}
          previous={null}
          next={CLASSICAL_HEXAGRAMS[1]}
        />,
      );
      const text = visibleText(html);
      expect((text.match(/Wikisource/giu) ?? []).length, locale).toBeLessThanOrEqual(2);
      expect((text.match(/oldid/giu) ?? []).length, locale).toBeLessThanOrEqual(1);
      expect((text.match(/固定修订版/gu) ?? []).length, locale).toBeLessThanOrEqual(1);
      expect(text, locale).not.toMatch(/#line-[1-6]/u);
      for (let position = 1; position <= 6; position += 1) {
        expect(html, locale).toContain('href="#line-' + position + '"');
        expect(html, locale).toContain(">#" + position + "<");
      }
    }
  });

  it("includes required special same-page modules and keeps hexagram 64 singular", async () => {
    const knowledge23 = await loadPublicHexagramKnowledge(23);
    const knowledge52 = await loadPublicHexagramKnowledge(52);
    const knowledge54 = await loadPublicHexagramKnowledge(54);
    const knowledge61 = await loadPublicHexagramKnowledge(61);
    const knowledge64 = await loadPublicHexagramKnowledge(64);
    const render = (number: number, knowledge: Awaited<ReturnType<typeof loadPublicHexagramKnowledge>>) => {
      const index = CLASSICAL_HEXAGRAMS.findIndex((entry) => entry.number === number);
      return renderToStaticMarkup(
        <HexagramDetailPageView
          locale="en"
          knowledge={knowledge}
          seo={hexagramSeoFor(number, "en")}
          previous={index > 0 ? CLASSICAL_HEXAGRAMS[index - 1] : null}
          next={index < CLASSICAL_HEXAGRAMS.length - 1 ? CLASSICAL_HEXAGRAMS[index + 1] : null}
        />,
      );
    };
    const hexagram23Html = render(23, knowledge23);
    expect(hexagram23Html).toContain('data-special-serp-module="hexagram-23"');
    expect(hexagram23Html).toContain("Bo (Splitting Apart)");
    expect(render(52, knowledge52)).toMatch(/Line 3[\s\S]{0,1000}purposeful stillness/i);
    expect(render(54, knowledge54)).toMatch(/relationships|romance/i);
    expect(render(61, knowledge61)).toMatch(/Line 5[\s\S]{0,1000}trust/i);
    expect(render(64, knowledge64)).not.toMatch(/64 hexagrams|all 64 hexagrams/i);
  });

  it("does not label a detail-to-hub link as an inbound anchor", async () => {
    const knowledge = await loadPublicHexagramKnowledge(1);
    const html = renderToStaticMarkup(
      <HexagramDetailPageView
        locale="en"
        knowledge={knowledge}
        seo={hexagramSeoFor(1, "en")}
        previous={null}
        next={CLASSICAL_HEXAGRAMS[1]}
      />,
    );
    expect(html).not.toContain("data-seo-inbound-anchor");
  });
});
