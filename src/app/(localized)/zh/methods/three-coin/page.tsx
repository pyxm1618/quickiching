import type { Metadata } from "next";
import Link from "next/link";
import { QuestionFirst } from "@/components/public-reading/question-first";
import { ThreeCoinTool } from "@/components/public-reading/three-coin-tool";
import { getDictionary } from "@/i18n/dictionaries";
import { alternateLanguages, canonicalUrl } from "@/i18n/helpers";
import { ZH_HANS_READING_CONTENT } from "@/content/mei-hua-yi-shu/zh-Hans";
import { zhSeoFor } from "@/content/seo/zh-pages";

const SEO = zhSeoFor("three-coin-method");
const CANONICAL = canonicalUrl(SEO.canonicalUrl);

export const metadata: Metadata = {
  title: { absolute: SEO.finalTitle },
  description: SEO.finalDescription,
  alternates: { canonical: CANONICAL, languages: alternateLanguages("three-coin-method") },
  openGraph: { title: SEO.finalTitle, description: SEO.finalDescription, url: CANONICAL, type: "article", locale: "zh_CN" },
  robots: { index: true, follow: true },
};

export default function ChineseThreeCoinMethodPage() {
  const dictionary = getDictionary("zh-Hans");
  return (
    <article data-seo-primary={SEO.primaryKeyword}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "HowTo", name: SEO.finalH1, description: SEO.finalDescription,
        url: CANONICAL, inLanguage: "zh-Hans",
      }) }} />
      <header className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
        <p className="font-mono text-[11px] tracking-[0.14em] text-[var(--bronze)]">周易起卦 · 三枚铜钱法</p>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight sm:text-5xl">{SEO.finalH1}</h1>
        <p data-seo-early-copy className="mt-5 max-w-3xl text-lg leading-8 text-[var(--ink-2)]">三枚铜钱起卦把六次掷币依次转换成六爻。第一次结果是最下方的初爻，之后逐爻向上；爻值 6 和 9 是动爻，会翻转形成之卦（变卦）。下面的工具直接完成完整流程，不需要切换到英文页面。</p>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-12">
        <QuestionFirst storageKey="quickiching:public-v1:three-coin" legacyStorageKeys={["quickiching:question:home-three-coin", "quickiching:question:three-coin"]} dictionary={dictionary}>
          <ThreeCoinTool dictionary={dictionary} localizedContent={ZH_HANS_READING_CONTENT} />
        </QuestionFirst>
      </section>

      <section className="mx-auto grid max-w-5xl gap-8 px-4 py-12 md:grid-cols-2">
        <div>
          <h2 className="font-display text-2xl font-medium">三枚铜钱起卦怎么算</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-6 text-sm leading-7 text-[var(--ink-2)]">
            <li>每一爻同时得到三枚铜钱的阴阳面，阳面记 3，阴面记 2。</li>
            <li>三枚相加只会得到 6、7、8、9 四种爻值。</li>
            <li>6 为老阴、9 为老阳，二者属于动爻；7 为少阳、8 为少阴。</li>
            <li>从初爻开始连续完成六次，形成完整本卦。</li>
            <li>把所有动爻阴阳翻转后得到之卦，用来观察结构变化，而不是把它当作保证发生的结果。</li>
          </ol>
        </div>
        <div>
          <h2 className="font-display text-2xl font-medium">在线铜钱起卦会保存什么</h2>
          <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">每次已经落定的掷币结果都会保存在当前浏览器会话中，刷新后可以继续。免费结果包含六爻、本卦、动爻位置、存在时的之卦，以及中文结构说明。</p>
          <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">已经生成的单爻不能手工改写；只有明确选择重新起卦时，才会丢弃当前六爻并从头开始。这样可以避免为了得到偏好的结果反复修改同一卦。</p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="font-display text-2xl font-medium">三枚铜钱起卦完成后怎么读</h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--ink-2)]">先看本卦描述的原始结构，再看哪些爻发生变化，最后对照之卦。没有动爻时就停留在本卦，不额外制造第二个结果。你也可以继续查阅六十四卦中文详情和动爻说明。</p>
        <nav className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm" aria-label="三枚铜钱起卦相关指南">
          <Link href="/zh/guides/changing-lines" className="font-semibold text-[var(--jade)] hover:underline">易经动爻说明</Link>
          <Link href="/zh/guides/primary-relating-hexagrams" className="font-semibold text-[var(--jade)] hover:underline">本卦、动爻与之卦</Link>
          <Link href="/zh/guides/how-to-ask-the-i-ching" className="font-semibold text-[var(--jade)] hover:underline">易经怎么问</Link>
          <Link href="/zh/methods/yarrow-stalks" className="font-semibold text-[var(--jade)] hover:underline">比较蓍草起卦</Link>
        </nav>
      </section>
    </article>
  );
}
