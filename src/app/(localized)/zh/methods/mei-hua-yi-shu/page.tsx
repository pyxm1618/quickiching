import type { Metadata } from "next";
import Link from "next/link";
import { MeiHuaTool } from "@/components/public-reading/mei-hua-tool";
import { QuestionFirst } from "@/components/public-reading/question-first";
import { getDictionary } from "@/i18n/dictionaries";
import { alternateLanguages, canonicalUrl } from "@/i18n/helpers";
import { ZH_HANS_MEI_HUA_CONTENT } from "@/content/mei-hua-yi-shu/zh-Hans";

export function generateMetadata(): Metadata {
  const canonical = canonicalUrl("/zh/methods/mei-hua-yi-shu");
  return {
    title: { absolute: ZH_HANS_MEI_HUA_CONTENT.metadata.title },
    description: ZH_HANS_MEI_HUA_CONTENT.metadata.description,
    alternates: { canonical, languages: alternateLanguages("mei-hua-yi-shu") },
    openGraph: { title: ZH_HANS_MEI_HUA_CONTENT.metadata.title, description: ZH_HANS_MEI_HUA_CONTENT.metadata.description, url: canonical, type: "article", locale: "zh_CN" },
  };
}

export default function ChineseMeiHuaPage() {
  const dictionary = getDictionary("zh-Hans");
  const content = ZH_HANS_MEI_HUA_CONTENT;

  return (
    <article>
      <header className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
        <p className="font-mono text-[11px] tracking-[0.14em] text-[var(--bronze)]">{content.eyebrow}</p>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight sm:text-5xl">{content.h1}</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[var(--ink-2)]">{content.introduction}</p>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-12">
        <QuestionFirst storageKey="quickiching:public-v1:mei-hua-v2" legacyStorageKeys={["quickiching:question:mei-hua-yi-shu"]} dictionary={dictionary}>
          <MeiHuaTool dictionary={dictionary} readingContent={content.reading} conventionContent={content.convention} />
        </QuestionFirst>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12" aria-labelledby="zh-positioning-title">
        <p className="mystic-kicker">方法范围</p>
        <h2 id="zh-positioning-title" className="mt-2 font-display text-3xl font-normal">{content.positioning.heading}</h2>
        {content.positioning.paragraphs.map((paragraph) => <p key={paragraph} className="mt-4 max-w-3xl text-sm leading-7 text-[var(--ink-2)]">{paragraph}</p>)}
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="mystic-card-soft p-6"><h3 className="font-display text-2xl font-normal">本页支持</h3><ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-[var(--ink-2)]">{content.scope.supported.map((item) => <li key={item}>{item}</li>)}</ul></div>
          <div className="mystic-card-soft p-6"><h3 className="font-display text-2xl font-normal">本页暂不支持</h3><ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-[var(--ink-2)]">{content.scope.notSupported.map((item) => <li key={item}>{item}</li>)}</ul></div>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-8 px-4 py-12 md:grid-cols-2" aria-labelledby="zh-convention-title">
        <div>
          <p className="mystic-kicker">公历时间约定</p>
          <h2 id="zh-convention-title" className="mt-2 font-display text-2xl font-normal">{content.convention.heading}</h2>
          {content.convention.paragraphs.map((paragraph) => <p key={paragraph} className="mt-4 text-sm leading-7 text-[var(--ink-2)]">{paragraph}</p>)}
        </div>
        <ul className="mystic-card p-6 list-disc space-y-3 pl-10 text-sm leading-7 text-[var(--ink-2)]">{content.convention.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12" aria-labelledby="zh-interpretation-title">
        <p className="mystic-kicker">阅读结果</p>
        <h2 id="zh-interpretation-title" className="mt-2 font-display text-2xl font-normal">{content.interpretation.heading}</h2>
        {content.interpretation.paragraphs.map((paragraph) => <p key={paragraph} className="mt-4 max-w-3xl text-sm leading-7 text-[var(--ink-2)]">{paragraph}</p>)}
        <nav className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm" aria-label="中文梅花易数相关链接"><Link href="/zh" className="font-semibold text-[var(--jade)] hover:underline">{content.navigation.home}</Link><Link href="/hexagrams" className="font-semibold text-[var(--jade)] hover:underline">{content.navigation.hexagrams}</Link><Link href="/guides/changing-lines" className="font-semibold text-[var(--jade)] hover:underline">{content.navigation.changingLines}</Link></nav>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: content.metadata.title,
        description: content.metadata.description,
        url: canonicalUrl("/zh/methods/mei-hua-yi-shu"),
        inLanguage: "zh-Hans",
        isPartOf: { "@type": "WebSite", name: "Quick I Ching", url: canonicalUrl("/") },
      }) }} />
    </article>
  );
}
