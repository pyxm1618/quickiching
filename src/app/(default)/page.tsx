import { ritualBrush } from "@/components/public-reading/ritual-font";
import React from "react";
import type { Metadata } from "next";
import { ThreeCoinRitual } from "@/components/public-reading/three-coin-ritual";
import { ThreeCoinTool } from "@/components/public-reading/three-coin-tool";
import { alternateLanguages, canonicalUrl } from "@/i18n/helpers";
import { HOME_DESCRIPTION, HOME_H1, HOME_TITLE } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: HOME_TITLE },
  description: HOME_DESCRIPTION,
  alternates: { canonical: canonicalUrl("/"), languages: alternateLanguages("homepage") },
  openGraph: { title: HOME_TITLE, description: HOME_DESCRIPTION, url: canonicalUrl("/"), type: "website" },
};

const WEBSITE_STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Quick I Ching",
  url: canonicalUrl("/"),
};

export default function HomePage() {

  return (
    <article className={`home-oracle ${ritualBrush.variable}`} data-three-coin-home-experience>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_STRUCTURED_DATA) }}
      />
      <ThreeCoinRitual
        homeHeading={HOME_H1}
        homeDescription="Use the I Ching online through one focused ritual: ask one question, confirm it, then cast six lines from bottom to top. Your question is frozen only when the first real cast is generated."
      >
        <ThreeCoinTool />
      </ThreeCoinRitual>
    </article>
  );
}
