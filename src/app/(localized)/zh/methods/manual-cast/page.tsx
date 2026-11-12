import type { Metadata } from "next";
import "@/components/public-reading/manual-cast.css";
import { QuestionFirst } from "@/components/public-reading/question-first";
import { ManualCastTool } from "@/components/public-reading/manual-cast-tool";
import { ritualBrush } from "@/components/public-reading/ritual-font";
import { getDictionary } from "@/i18n/dictionaries";
import { alternateLanguages, canonicalUrl } from "@/i18n/helpers";
import { zhSeoFor } from "@/content/seo/zh-pages";

const SEO = zhSeoFor("manual-cast-method");
const CANONICAL = canonicalUrl(SEO.canonicalUrl);

export const metadata: Metadata = {
  title: { absolute: SEO.finalTitle }, description: SEO.finalDescription,
  alternates: { canonical: CANONICAL, languages: alternateLanguages("manual-cast-method") },
  openGraph: { title: SEO.finalTitle, description: SEO.finalDescription, url: CANONICAL, type: "article", locale: "zh_CN" },
  robots: { index: true, follow: true },
};

export default function ChineseManualCastPage() {
  const dictionary = getDictionary("zh-Hans");
  const copy = dictionary.manualCast;
  return (
    <article className={"manual-cast-page manual-cast-page-zh " + ritualBrush.variable} data-seo-primary={SEO.primaryKeyword}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "WebPage", name: SEO.finalH1, description: SEO.finalDescription, url: CANONICAL, inLanguage: "zh-Hans" }) }} />
      <link rel="preload" as="image" href="/performance/stageDesktop.e37364561615e31f.webp" media="not all and (max-aspect-ratio:11/20)" fetchPriority="high" />
      <link rel="preload" as="image" href="/performance/stagePortrait.bde3e415eb141bc8.webp" media="(min-width:601px) and (max-aspect-ratio:11/20)" fetchPriority="high" />
      <link rel="preload" as="image" href="/performance/stageMobile.285965e6cb8c7840.webp" media="(max-width:600px) and (max-aspect-ratio:11/20)" fetchPriority="low" />
      <section className="manual-cast-stage">
        <div className="manual-cast-room" aria-hidden="true" />
        <div className="manual-cast-frame">
          <header className="manual-cast-title">
            <h1>{SEO.finalH1}</h1>
            <p>{copy.subtitle}</p>
          </header>
          <QuestionFirst
            storageKey="quickiching:public-v1:manual-cast"
            dictionary={dictionary}
            activeQuestionPresentation="hidden"
          >
            <ManualCastTool dictionary={dictionary} />
          </QuestionFirst>
        </div>
      </section>
    </article>
  );
}
