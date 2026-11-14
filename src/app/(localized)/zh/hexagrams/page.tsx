import React from "react";
import type { Metadata } from "next";
import { CLASSICAL_HEXAGRAMS } from "@/domain/public-reading/classical";
import { hexagramSeoFor } from "@/content/hexagrams/seo";
import { alternateLanguages, canonicalUrl } from "@/i18n/helpers";
import { zhSeoFor } from "@/content/seo/zh-pages";
import { HexagramsExperience } from "@/app/(default)/hexagrams/hexagrams-experience";

const SEO = zhSeoFor("hexagrams-hub");
const CANONICAL = canonicalUrl(SEO.canonicalUrl);

export const metadata: Metadata = {
  title: { absolute: SEO.finalTitle },
  description: SEO.finalDescription,
  alternates: {
    canonical: CANONICAL,
    languages: alternateLanguages("hexagrams-hub"),
  },
  openGraph: {
    title: SEO.finalTitle,
    description: SEO.finalDescription,
    url: CANONICAL,
    type: "website",
    locale: "zh_CN",
  },
  robots: { index: true, follow: true },
};

export default function ChineseHexagramsHubPage() {
  const hexagrams = CLASSICAL_HEXAGRAMS.map((hexagram) => {
    const seo = hexagramSeoFor(hexagram.number, "zh-Hans");
    return {
      number: hexagram.number,
      name: hexagram.chineseName,
      slug: hexagram.slug,
      lower: hexagram.trigrams.lower,
      upper: hexagram.trigrams.upper,
      primaryKeyword: seo.primaryKeyword,
    };
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: SEO.finalH1,
            description: SEO.finalDescription,
            url: CANONICAL,
            inLanguage: "zh-Hans",
          }),
        }}
      />
      <HexagramsExperience
        hexagrams={hexagrams}
        locale="zh-Hans"
        title={SEO.finalH1}
        description={SEO.finalDescription}
        detailRoutePrefix="/zh/hexagrams/"
        seoPrimaryKeyword={SEO.primaryKeyword}
        sectionHeading="易经六十四卦文王卦序"
      />
    </>
  );
}
