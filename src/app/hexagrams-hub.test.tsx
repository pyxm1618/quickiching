import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HEXAGRAM_SEO_REGISTRY } from "@/content/hexagrams/seo";
import EnglishHexagramsHubPage from "@/app/(default)/hexagrams/page";
import ChineseHexagramsHubPage from "@/app/(localized)/zh/hexagrams/page";
import EnglishHomePage from "@/app/(default)/page";
import ChineseHomePage from "@/app/(localized)/zh/page";

function visibleAnchorText(anchor: string): string {
  return anchor.replace(/<[^>]*>/gu, " ").replace(/\s+/gu, " ").trim();
}

function anchorFor(html: string, href: string, primary: string): string | undefined {
  const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const escapedPrimary = primary.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = html.match(new RegExp(`<a\\b[^>]*(?:href=["']${escapedHref}["'][^>]*data-seo-inbound-anchor=["']${escapedPrimary}["']|data-seo-inbound-anchor=["']${escapedPrimary}["'][^>]*href=["']${escapedHref}["'])[^>]*>[\\s\\S]*?<\\/a>`, "iu"));
  return match?.[0];
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

function renderWithClassicReact(element: React.ReactNode): string {
  const classicGlobal = globalThis as typeof globalThis & { React?: typeof React };
  const previousReact = classicGlobal.React;
  classicGlobal.React = React;
  try {
    return renderToStaticMarkup(element);
  } finally {
    if (previousReact) classicGlobal.React = previousReact;
    else Reflect.deleteProperty(classicGlobal, "React");
  }
}

describe("hexagram hub inbound anchors", () => {
  it("places every exact Primary in a real Hub-to-detail anchor", () => {
    const hubs = [
      { locale: "en" as const, html: renderToStaticMarkup(<EnglishHexagramsHubPage />), prefix: "/hexagrams/" },
      { locale: "zh-Hans" as const, html: renderToStaticMarkup(<ChineseHexagramsHubPage />), prefix: "/zh/hexagrams/" },
    ];

    for (const hub of hubs) {
      for (const entry of HEXAGRAM_SEO_REGISTRY.filter((candidate) => candidate.locale === hub.locale)) {
        const anchor = anchorFor(hub.html, hub.prefix + entry.slug, entry.primaryKeyword);
        expect(anchor, `${entry.locale} ${entry.number} ${entry.canonicalUrl}`).toBeDefined();
        expect(visibleAnchorText(anchor ?? "")).toContain(entry.primaryKeyword);
      }
    }
  });

  it("connects each locale home, hub, and all 64 detail routes", () => {
    const englishHome = renderWithClassicReact(<EnglishHomePage />);
    const chineseHome = renderWithClassicReact(<ChineseHomePage />);
    const englishHub = renderToStaticMarkup(<EnglishHexagramsHubPage />);
    const chineseHub = renderToStaticMarkup(<ChineseHexagramsHubPage />);

    expect(englishHome).toContain('href="/hexagrams"');
    expect(englishHome).toContain('data-seo-hub-link="/hexagrams"');
    expect(chineseHome).toContain('href="/zh/hexagrams"');
    expect(chineseHome).toContain('data-seo-hub-link="/zh/hexagrams"');
    expect(englishHub).toContain('data-seo-home-link="/"');
    expect(chineseHub).toContain('data-seo-home-link="/zh"');

    expect((englishHub.match(/data-seo-inbound-anchor=/gu) ?? [])).toHaveLength(64);
    expect((chineseHub.match(/data-seo-inbound-anchor=/gu) ?? [])).toHaveLength(64);
  });

  it("keeps each hexagram hub in its own visible language", () => {
    const englishCopy = visibleText(renderToStaticMarkup(<EnglishHexagramsHubPage />));
    const chineseCopy = visibleText(renderToStaticMarkup(<ChineseHexagramsHubPage />));
    expect(englishCopy).not.toMatch(/\p{Script=Han}/u);
    expect(chineseCopy).not.toMatch(/\b\p{Script=Latin}{2,}\b/u);
    expect(englishCopy).not.toMatch(/Quick ?I ?Ching/iu);
    expect(chineseCopy).not.toMatch(/Quick ?I ?Ching/iu);
  });
});
