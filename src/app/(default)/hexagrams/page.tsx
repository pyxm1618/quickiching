import React from "react";
import type { Metadata } from "next";
import { CLASSICAL_HEXAGRAMS } from "@/domain/public-reading/classical";
import { hexagramSeoFor } from "@/content/hexagrams/seo";
import { alternateLanguages } from "@/i18n/helpers";
import { isAuthCapabilityEnabled } from "@/server/auth/capability";
import { HexagramsExperience } from "./hexagrams-experience";

export const metadata: Metadata = {
  title: "64 I Ching Hexagrams — King Wen Sequence Guide",
  description: "Explore all 64 I Ching hexagrams in the King Wen sequence with concise original theme summaries and links to free online casting methods.",
  alternates: {
    canonical: "/hexagrams",
    languages: alternateLanguages("hexagrams-hub"),
  },
  openGraph: { title: "64 I Ching Hexagrams — King Wen Sequence Guide", description: "A concise hub for all 64 I Ching hexagrams in the King Wen sequence.", url: "/hexagrams", type: "website" },
};

export default function HexagramsHubPage() {
  const hexagrams = CLASSICAL_HEXAGRAMS.map((hexagram) => {
    const seo = hexagramSeoFor(hexagram.number, "en");
    return {
      number: hexagram.number,
      englishName: hexagram.englishName,
      slug: hexagram.slug,
      lower: hexagram.trigrams.lower,
      upper: hexagram.trigrams.upper,
      primaryKeyword: seo.primaryKeyword,
    };
  });

  return <HexagramsExperience hexagrams={hexagrams} authEnabled={isAuthCapabilityEnabled()} />;
}
