import type { Metadata } from "next";
import { MeiHuaNumberFlow } from "@/components/public-reading/mei-hua-number-flow";
import { alternateLanguages, canonicalUrl } from "@/i18n/helpers";
import { ZH_HANS_MEI_HUA_CONTENT } from "@/content/mei-hua-yi-shu/zh-Hans";
import { zhSeoFor } from "@/content/seo/zh-pages";

export function generateMetadata(): Metadata {
  const seo = zhSeoFor("mei-hua-yi-shu");
  const canonical = canonicalUrl(seo.canonicalUrl);
  return {
    title: { absolute: seo.finalTitle },
    description: seo.finalDescription,
    alternates: { canonical, languages: alternateLanguages("mei-hua-yi-shu") },
    openGraph: { title: seo.finalTitle, description: seo.finalDescription, url: canonical, type: "article", locale: "zh_CN" },
  };
}

export default function ChineseMeiHuaPage() {
  const content = ZH_HANS_MEI_HUA_CONTENT;

  return (
    <>
      <MeiHuaNumberFlow locale="zh-Hans" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: content.metadata.title,
        description: content.metadata.description,
        url: canonicalUrl("/zh/methods/mei-hua-yi-shu"),
        inLanguage: "zh-Hans",
        isPartOf: { "@type": "WebSite", name: "Quick I Ching", url: canonicalUrl("/") },
      }) }} />
    </>
  );
}
