import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HEXAGRAM_SEO_REGISTRY } from "@/content/hexagrams/seo";
import EnglishHexagramsHubPage from "@/app/(default)/hexagrams/page";
import ChineseHexagramsHubPage from "@/app/(localized)/zh/hexagrams/page";

function visibleAnchorText(anchor: string): string {
  return anchor.replace(/<[^>]*>/gu, " ").replace(/\s+/gu, " ").trim();
}

function anchorFor(html: string, href: string, primary: string): string | undefined {
  const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const escapedPrimary = primary.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = html.match(new RegExp(`<a\\b[^>]*(?:href=["']${escapedHref}["'][^>]*data-seo-inbound-anchor=["']${escapedPrimary}["']|data-seo-inbound-anchor=["']${escapedPrimary}["'][^>]*href=["']${escapedHref}["'])[^>]*>[\\s\\S]*?<\\/a>`, "iu"));
  return match?.[0];
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
});
