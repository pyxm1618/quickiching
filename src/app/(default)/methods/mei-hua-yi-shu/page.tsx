import type { Metadata } from "next";
import { MeiHuaNumberFlow } from "@/components/public-reading/mei-hua-number-flow";
import { alternateLanguages, canonicalUrl } from "@/i18n/helpers";
import { EN_MEI_HUA_CONTENT } from "@/content/mei-hua-yi-shu/en";

const CONTENT = EN_MEI_HUA_CONTENT;
export const metadata: Metadata = {
  title: CONTENT.metadata.title,
  description: CONTENT.metadata.description,
  alternates: { canonical: canonicalUrl("/methods/mei-hua-yi-shu"), languages: alternateLanguages("mei-hua-yi-shu") },
  openGraph: { title: CONTENT.metadata.title, description: "Cast a Plum Blossom I Ching hexagram from one chosen number and the confirmed local moment using the documented object-number rule.", url: canonicalUrl("/methods/mei-hua-yi-shu"), type: "website" },
};

export default function MeiHuaPage() {
  return (
    <div style={{ paddingBottom: 96 }}>
      <MeiHuaNumberFlow />
    </div>
  );
}
