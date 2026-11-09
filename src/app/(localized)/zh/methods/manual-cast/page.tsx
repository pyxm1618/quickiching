import type { Metadata } from "next";
import Link from "next/link";
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
    <article className={"manual-cast-page " + ritualBrush.variable} data-seo-primary={SEO.primaryKeyword}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "WebPage", name: SEO.finalH1, description: SEO.finalDescription, url: CANONICAL, inLanguage: "zh-Hans" }) }} />
      <link rel="preload" as="image" href="/performance/stageDesktop.e37364561615e31f.webp" media="not all and (max-aspect-ratio:11/20)" fetchPriority="high" />
      <link rel="preload" as="image" href="/performance/stagePortrait.bde3e415eb141bc8.webp" media="(min-width:601px) and (max-aspect-ratio:11/20)" fetchPriority="high" />
      <link rel="preload" as="image" href="/performance/stageMobile.285965e6cb8c7840.webp" media="(max-width:600px) and (max-aspect-ratio:11/20)" fetchPriority="low" />
      <section className="manual-cast-stage">
        <div className="manual-cast-room" aria-hidden="true" />
        <div className="manual-cast-frame">
          <header className="manual-cast-title">
            <h1>{copy.title}</h1>
            <p>{copy.subtitle}</p>
          </header>
          <QuestionFirst
            storageKey="quickiching:public-v1:manual-cast"
            dictionary={dictionary}
            deepReadingEligible
            activeQuestionPresentation="hidden"
          >
            <ManualCastTool dictionary={dictionary} />
          </QuestionFirst>
        </div>
      </section>

      <div className="manual-cast-supporting">
        <section className="mx-auto grid max-w-5xl gap-8 px-4 py-12 md:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl font-medium">手动起卦的两种输入方式</h2>
            <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">方式一直接输入从初爻到上爻的六个数值：6、7、8、9。方式二选择一个本卦，再勾选零到六个动爻位置；稳定阴阳会映射为 8 和 7，发生变化的阴阳会映射为 6 和 9。</p>
          </div>
          <div>
            <h2 className="font-display text-2xl font-medium">同一套确定性卦象计算</h2>
            <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">两种方式都进入同一套本卦、动爻、之卦计算。没有动爻时不会额外生成之卦。形成六爻本身不需要调用人工智能服务，也不会改写你输入的爻值。</p>
            <nav className="mt-5 flex flex-wrap gap-5 text-sm">
              <Link href="/zh/guides/changing-lines" className="font-semibold text-[var(--jade)] hover:underline">动爻说明</Link>
              <Link href="/zh/hexagrams" className="font-semibold text-[var(--jade)] hover:underline">易经六十四卦</Link>
            </nav>
          </div>
        </section>
      </div>
    </article>
  );
}
