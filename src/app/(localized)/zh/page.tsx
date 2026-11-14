import type { Metadata } from "next";
import { ThreeCoinRitual } from "@/components/public-reading/three-coin-ritual";
import { ThreeCoinTool } from "@/components/public-reading/three-coin-tool";
import { getDictionary } from "@/i18n/dictionaries";
import { alternateLanguages, canonicalUrl } from "@/i18n/helpers";
import { zhSeoFor } from "@/content/seo/zh-pages";

const SEO = zhSeoFor("homepage");
const CANONICAL = canonicalUrl(SEO.canonicalUrl);

export const metadata: Metadata = {
  title: { absolute: SEO.finalTitle },
  description: SEO.finalDescription,
  alternates: { canonical: CANONICAL, languages: alternateLanguages("homepage") },
  openGraph: { title: SEO.finalTitle, description: SEO.finalDescription, url: CANONICAL, type: "website", locale: "zh_CN" },
  robots: { index: true, follow: true },
};

const WEBPAGE_STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: SEO.finalH1,
  description: SEO.finalDescription,
  url: CANONICAL,
  inLanguage: "zh-Hans",
};

export default function ChineseHomePage() {
  const dictionary = getDictionary("zh-Hans");

  return (
    <article className="home-oracle" data-seo-primary={SEO.primaryKeyword} data-three-coin-home-experience>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBPAGE_STRUCTURED_DATA) }}
      />
      <ThreeCoinRitual
        dictionary={dictionary}
        homeHeading={SEO.finalH1}
        homeDescription="写下一个核心问题，确认后自下而上完成六次起爻。问题只会在第一次真实起爻生成时锁定。"
      >
        <ThreeCoinTool dictionary={dictionary} />
      </ThreeCoinRitual>
    </article>
  );
}
