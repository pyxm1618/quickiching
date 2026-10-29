import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CLASSICAL_HEXAGRAMS } from "@/domain/public-reading/classical";
import { loadPublicHexagramKnowledge } from "@/domain/public-reading/knowledge";
import { hexagramSeoFor, hexagramSeoRows } from "@/content/hexagrams/seo";
import { evaluateKeywordQuality } from "@/content/hexagrams/seo-quality";
import { zhHansHexagramContent } from "@/content/hexagrams/zh-Hans";
import { HexagramDetailPageView, type HexagramDetailPageViewProps } from "./hexagram-detail-page";

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
      expect(html).toContain(">" + (item.locale === "en" ? knowledge.englishName : hexagramSeoFor(item.number, item.locale).finalH1) + "<");
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

  it("preserves existing Chinese early keyword coverage", async () => {
    for (const seo of hexagramSeoRows().filter((row) => row.locale === "zh-Hans")) {
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

  it("keeps all 128 eligible detail bodies in the intended main language while allowing cultural proper nouns", async () => {
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
      const quality = evaluateKeywordQuality({
        text: copy,
        locale: seo.locale,
        primary: seo.primaryKeyword,
        approvedFamily: approvedFamily(seo),
      });
      expect(quality.languageMostlyCorrect, seo.canonicalUrl).toBe(true);
      expect(copy, seo.canonicalUrl).not.toMatch(/Quick ?I ?Ching/iu);
    }
  });

  it("keeps the primary keyword present on all 128 server-rendered detail bodies without fixed density bands", async () => {
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

  it("uses the approved knowledge-page structure and only auxiliary sequence navigation for all 64 English pages", async () => {
    for (let number = 1; number <= 64; number += 1) {
      const knowledge = await loadPublicHexagramKnowledge(number);
      const html = renderToStaticMarkup(<HexagramDetailPageView locale="en" knowledge={knowledge} seo={hexagramSeoFor(number, "en")} previous={number > 1 ? CLASSICAL_HEXAGRAMS[number - 2] : null} next={number < 64 ? CLASSICAL_HEXAGRAMS[number] : null} />);
      expect(html).toContain("data-basic-identity");
      expect(html).toContain(">" + knowledge.englishName + "<");
      expect(html).toContain("What This Hexagram Means");
      expect(html).toContain("Classical Text &amp; Modern Interpretation");
      expect(html).toContain("The Six Lines");
      expect(html).toContain("Modern Meaning");
      expect(html).not.toContain("Classical Line Text");
      expect(html.includes("data-reading-cases")).toBe(knowledge.detail.specialReadingCases.length > 0);
      expect(html.includes("data-hexagram-relations")).toBe(knowledge.detail.relationships.length > 0);
      expect(html).not.toContain("data-love-module");
      expect(html).not.toContain("data-seo-home-link");
      expect(html).not.toContain("Start a Reading");
      const navigation = html.match(/<nav[^>]*data-auxiliary-navigation[^>]*>([\s\S]*?)<\/nav>/u)?.[1] ?? "";
      expect(navigation).toContain('href="/hexagrams"');
      expect(navigation).toContain("Previous");
      expect(navigation).toContain("Next");
      expect((navigation.match(/<a\b/gu) ?? []).length).toBe(number === 1 || number === 64 ? 2 : 3);
      for (const line of knowledge.lines) {
        expect(html).toContain(line.meaning.replaceAll("&", "&amp;").replaceAll("'", "&#x27;").replaceAll('"', "&quot;"));
      }
    }
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

  it("retains the exact fixed source and six individually labelled line links on all 128 detail pages", async () => {
    for (const classical of CLASSICAL_HEXAGRAMS) {
      const knowledge = await loadPublicHexagramKnowledge(classical.number);
      for (const locale of ["en", "zh-Hans"] as const) {
        const html = renderToStaticMarkup(<HexagramDetailPageView locale={locale} knowledge={knowledge} seo={hexagramSeoFor(classical.number, locale)} content={locale === "zh-Hans" ? zhHansHexagramContent(classical.number) : undefined} previous={null} next={null} />);
        const links = [...html.matchAll(/<a\b[^>]*>/gu)].map((match) => match[0]);
        const sourceLinks = links.filter((link) => link.includes("zh.wikisource.org"));
        const fixedHref = 'href="' + classical.source.textSourceUrl.replaceAll("&", "&amp;") + '"';
        expect(sourceLinks.length, `${locale}:${classical.number}`).toBeGreaterThanOrEqual(locale === "en" ? 8 : 7);
        for (const link of sourceLinks) expect(link).toContain(fixedHref);
        for (const line of classical.lines) {
          const label = locale === "en" ? `Source for classical line ${line.position}` : `第${line.position}爻经典原文来源`;
          const labelledSources = sourceLinks.filter((link) => link.includes(`aria-label="${label}"`));
          expect(labelledSources, `${locale}:${classical.number}:line-${line.position}`).toHaveLength(1);
          expect(labelledSources[0]).toContain('href="' + line.source.textSourceUrl.replaceAll("&", "&amp;") + '"');
        }
      }
    }
  });

  it("binds supplied editorial renderings and field-specific interpretations for all 64 English pages", async () => {
    for (const classical of CLASSICAL_HEXAGRAMS) {
      const knowledge = await loadPublicHexagramKnowledge(classical.number);
      const html = renderToStaticMarkup(<HexagramDetailPageView locale="en" knowledge={knowledge} seo={hexagramSeoFor(classical.number, "en")} previous={null} next={null} />);
      const encode = (text: string) => text.replaceAll("&", "&amp;").replaceAll("'", "&#x27;").replaceAll('"', "&quot;");
      expect(html).toContain("English Rendering / Translation");
      expect(html).not.toContain("Classical Line Text");
      expect(html).not.toContain("Stage / State");
      for (const field of [knowledge.detail.judgment, knowledge.detail.image]) {
        expect(html).toContain(encode(field.rendering.editorialRendering));
        expect(html).toContain(encode(field.modernInterpretation.text));
      }
      for (const line of knowledge.detail.lines) {
        expect(html).toContain(encode(line.rendering.editorialRendering));
        expect(html).toContain(encode(line.modernMeaning.text));
        expect(html).toContain(encode(line.caution.text));
      }
      for (const readingCase of knowledge.detail.specialReadingCases) expect(html).toContain(encode(readingCase.rendering.editorialRendering));
      for (const relation of knowledge.detail.relationships) expect(html).toContain(encode(relation.explanation));
      expect((html.match(/data-hexagram-line=/gu) ?? []).length).toBe(6);
    }
  });

  it("safely hides unavailable detail data and only shows a stage column when supplied", async () => {
    const knowledge = await loadPublicHexagramKnowledge(1);
    const { detail, ...previousContract } = knowledge;
    const render = (entry: HexagramDetailPageViewProps["knowledge"]) => renderToStaticMarkup(<HexagramDetailPageView locale="en" knowledge={entry} seo={hexagramSeoFor(1, "en")} previous={null} next={null} />);
    const absent = render(previousContract);
    expect(absent).not.toContain("English Rendering / Translation");
    expect(absent).not.toContain("data-reading-cases");
    expect(absent).not.toContain("data-hexagram-relations");
    expect(absent).not.toContain("Stage / State");
    expect(absent).toContain(knowledge.lines[0].meaning);
    const emptyOptional = render({ ...knowledge, detail: { ...detail, specialReadingCases: [], relationships: [] } });
    expect(emptyOptional).not.toContain("data-reading-cases");
    expect(emptyOptional).not.toContain("data-hexagram-relations");
    const testOnlyStage = structuredClone(knowledge);
    testOnlyStage.detail.lines[0].stageState = { dataClass: "editorial-derived", text: "Test-only optional stage", basis: "UI conditional-rendering fixture; never production content" };
    expect(render(testOnlyStage)).toContain("Stage / State");
    expect(render(testOnlyStage)).toContain("Test-only optional stage");
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
