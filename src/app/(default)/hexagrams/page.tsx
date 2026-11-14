import React from "react";
import type { Metadata } from "next";
import { CLASSICAL_HEXAGRAMS } from "@/domain/public-reading/classical";
import { hexagramSeoFor } from "@/content/hexagrams/seo";
import { alternateLanguages } from "@/i18n/helpers";
import { HexagramsExperience } from "./hexagrams-experience";

export const metadata: Metadata = {
  title: "64 I Ching Hexagrams — King Wen Guide",
  description: "Explore all 64 I Ching hexagrams in King Wen order, with names, meanings, and links to detailed hexagram pages and casting methods.",
  alternates: {
    canonical: "/hexagrams",
    languages: alternateLanguages("hexagrams-hub"),
  },
  openGraph: { title: "64 I Ching Hexagrams — King Wen Guide", description: "Explore all 64 I Ching hexagrams in King Wen order, with names, meanings, and links to detailed hexagram pages and casting methods.", url: "/hexagrams", type: "website" },
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
      locale="en"
      title="64 I Ching Hexagrams"
      description="Browse all 64 hexagrams in King Wen order and open any one to explore its detail page."
      detailRoutePrefix="/hexagrams/"
      sectionHeading="All 64 I Ching hexagrams in King Wen order"
    />
  );
}
