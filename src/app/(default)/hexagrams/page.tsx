import React from "react";
import type { Metadata } from "next";
import { CLASSICAL_HEXAGRAMS } from "@/domain/public-reading/classical";
import { hexagramSeoFor } from "@/content/hexagrams/seo";
import { alternateLanguages } from "@/i18n/helpers";
import { isAuthCapabilityEnabled } from "@/server/auth/capability";
import { HexagramsExperience } from "./hexagrams-experience";

export const metadata: Metadata = {
  title: "64 I Ching Hexagrams — King Wen Sequence Guide",
  description: "Explore all 64 I Ching hexagrams in King Wen order through an interactive 8×8 scroll and wheel, then open any hexagram detail page.",
  alternates: {
    canonical: "/hexagrams",
    languages: alternateLanguages("hexagrams-hub"),
  },
  openGraph: { title: "64 I Ching Hexagrams — King Wen Sequence Guide", description: "Browse all 64 I Ching hexagrams in King Wen order and open any hexagram detail page.", url: "/hexagrams", type: "website" },
};

export default function HexagramsHubPage() {
  const hexagrams = CLASSICAL_HEXAGRAMS.map((hexagram) => {
    const seo = hexagramSeoFor(hexagram.number, "en");
    return {
      number: hexagram.number,
      name: hexagram.englishName,
      slug: hexagram.slug,
      lower: hexagram.trigrams.lower,
      upper: hexagram.trigrams.upper,
      primaryKeyword: seo.primaryKeyword,
    };
  });

  return (
    <HexagramsExperience
      hexagrams={hexagrams}
      authEnabled={isAuthCapabilityEnabled()}
      locale="en"
      title="64 I Ching Hexagrams"
      description="Browse all 64 hexagrams in King Wen order and open any one to explore its detail page."
      detailRoutePrefix="/hexagrams/"
      languageSwitchHref="/zh/hexagrams"
      sectionHeading="All 64 I Ching hexagrams in King Wen order"
    />
  );
}
