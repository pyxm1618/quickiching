import React from "react";
import type { Metadata } from "next";
import { QuestionFirst } from "@/components/public-reading/question-first";
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
    <article className="home-oracle" data-three-coin-home-experience>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_STRUCTURED_DATA) }}
      />
      <QuestionFirst
        storageKey="quickiching:public-v1:three-coin"
        legacyStorageKeys={["quickiching:question:home-three-coin", "quickiching:question:three-coin"]}
        deepReadingEligible
        presentation="home-ritual"
        homeHeading={HOME_H1}
        homeDescription="Ask one question, confirm it, then cast six lines from bottom to top. Your question is frozen only when the first real cast is generated."
      >
        <ThreeCoinTool compactIntro presentation="home-ritual" />
      </QuestionFirst>
    </article>
  );
}
