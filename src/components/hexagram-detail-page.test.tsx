import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CLASSICAL_HEXAGRAMS } from "@/domain/public-reading/classical";
import { loadPublicHexagramKnowledge } from "@/domain/public-reading/knowledge";
import { hexagramSeoFor, hexagramSeoRows } from "@/content/hexagrams/seo";
import { evaluateKeywordQuality } from "@/content/hexagrams/seo-quality";
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

function eligibleText(html: string): string {
  let eligible = html;
  for (const tag of ["script", "style", "nav"]) {
    eligible = eligible.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, "giu"), " ");
  }
  let previous = "";
  while (previous !== eligible) {
    previous = eligible;
    eligible = eligible.replace(/<([a-z][a-z0-9-]*)\b[^>]*data-seo-exclude[^>]*>[\s\S]*?<\/\1>/giu, " ");
  }
  return visibleText(eligible);
}

function approvedFamily(seo: ReturnType<typeof hexagramSeoFor>): string[] {
  return [...new Set([
    seo.primaryKeyword,
    ...keywordPhrases(seo.secondaryCore),
    ...keywordPhrases(seo.secondaryVariantFamily),
    seo.otherCoreVariant,
    seo.meaningKeyword,
    seo.loveKeyword,
    seo.unchangingKeyword,
    seo.relationshipKeyword,
    ...seo.specialKeywords,
  ].filter((phrase): phrase is string => Boolean(phrase)))];
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

  it("keeps all 128 eligible detail bodies in their own language", async () => {
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
      expect(html, seo.canonicalUrl).toContain("data-seo-copy");
      const copy = eligibleText(html);
      if (seo.locale === "en") {
        expect(copy, seo.canonicalUrl).not.toMatch(/\p{Script=Han}/u);
      } else {
        expect(copy, seo.canonicalUrl).not.toMatch(/\b\p{Script=Latin}{2,}\b/u);
      }
      expect(copy, seo.canonicalUrl).not.toMatch(/Quick ?I ?Ching/iu);
    }
  });

  it("keeps all 128 server-rendered detail bodies inside the hard density bands", async () => {
    const failures: string[] = [];
    for (const seo of hexagramSeoRows()) {
      const knowledge = await loadPublicHexagramKnowledge(seo.number);
      const html = renderToStaticMarkup(
        <HexagramDetailPageView
          locale={seo.locale}
          knowledge={knowledge}
          seo={seo}
          content={seo.locale === "zh-Hans" ? zhHansHexagramContent(seo.number) : undefined}
          previous={seo.number > 1 ? CLASSICAL_HEXAGRAMS[seo.number - 2] : null}
          next={seo.number < 64 ? CLASSICAL_HEXAGRAMS[seo.number] : null}
        />,
      );
      const quality = evaluateKeywordQuality({
        text: eligibleText(html),
        locale: seo.locale,
        primary: seo.primaryKeyword,
        approvedFamily: approvedFamily(seo),
      });
      if (quality.failures.length > 0) {
        failures.push(`${seo.locale} ${seo.number} tokens=${quality.measurement.tokenCount} primaryCount=${quality.measurement.primaryOccurrences} familyMatches=${quality.measurement.familyMatches.length} primary=${quality.measurement.primaryDensity.toFixed(6)} family=${quality.measurement.familyDensity.toFixed(6)} ${quality.failures.join("|")}`);
      }
    }
    expect(failures).toEqual([]);
  }, 15_000);

  it("renders workbook-approved English intent modules and keyworded line headings", async () => {
    const relationshipNumbers: number[] = [];
    for (let number = 1; number <= 64; number += 1) {
      const knowledge = await loadPublicHexagramKnowledge(number);
      const seo = hexagramSeoFor(number, "en");
      const html = renderToStaticMarkup(
        <HexagramDetailPageView
          locale="en"
          knowledge={knowledge}
          seo={seo}
          previous={number > 1 ? CLASSICAL_HEXAGRAMS[number - 2] : null}
          next={number < 64 ? CLASSICAL_HEXAGRAMS[number] : null}
        />,
      );
      const normalized = html.toLocaleLowerCase("en-US");
      expect(normalized, seo.canonicalUrl).toContain(`>${seo.loveKeyword} meaning<`);
      expect(normalized, seo.canonicalUrl).toContain(`>${seo.unchangingKeyword}<`);
      expect(html, seo.canonicalUrl).toContain(`Hexagram ${number} Line 1`);
      expect(html, seo.canonicalUrl).toContain(`Hexagram ${number} Line 6`);
      if (html.includes("data-relationship-module")) relationshipNumbers.push(number);
      expect(html, seo.canonicalUrl).toContain(`data-seo-home-link="/"`);
      expect(html, seo.canonicalUrl).toContain(`data-seo-hub-link="/hexagrams"`);
    }
    expect(relationshipNumbers).toEqual([1, 26, 37, 41, 42, 49, 54, 56]);
  });

  it("uses protected Chinese Primary phrases in all six line headings", async () => {
    for (let number = 1; number <= 64; number += 1) {
      const knowledge = await loadPublicHexagramKnowledge(number);
      const seo = hexagramSeoFor(number, "zh-Hans");
      const html = renderToStaticMarkup(
        <HexagramDetailPageView
          locale="zh-Hans"
          knowledge={knowledge}
          seo={seo}
          content={zhHansHexagramContent(number)}
          previous={number > 1 ? CLASSICAL_HEXAGRAMS[number - 2] : null}
          next={number < 64 ? CLASSICAL_HEXAGRAMS[number] : null}
        />,
      );
      expect(html, seo.canonicalUrl).toContain(`${seo.primaryKeyword}初爻`);
      expect(html, seo.canonicalUrl).toContain(`${seo.primaryKeyword}上爻`);
      expect(html, seo.canonicalUrl).toContain(`data-seo-home-link="/zh"`);
      expect(html, seo.canonicalUrl).toContain(`data-seo-hub-link="/zh/hexagrams"`);
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

  it("includes only the new workbook special English phrases", async () => {
    const knowledge23 = await loadPublicHexagramKnowledge(23);
    const knowledge54 = await loadPublicHexagramKnowledge(54);
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
    expect(visibleText(hexagram23Html).toLocaleLowerCase("en-US")).toContain("i ching hexagram 23 meaning splitting apart bo");
    expect(visibleText(render(54, knowledge54)).toLocaleLowerCase("en-US")).toContain("hexagram 54 in romance reading");
    for (const number of [52, 61, 64]) {
      const knowledge = await loadPublicHexagramKnowledge(number);
      expect(render(number, knowledge)).not.toContain(`data-special-serp-module="hexagram-${number}"`);
    }
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
