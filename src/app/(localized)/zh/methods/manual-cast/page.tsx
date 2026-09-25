import type { Metadata } from "next";
import Link from "next/link";
import { QuestionFirst } from "@/components/public-reading/question-first";
import { ManualCastTool } from "@/components/public-reading/manual-cast-tool";
import { getDictionary } from "@/i18n/dictionaries";
import { alternateLanguages, canonicalUrl } from "@/i18n/helpers";
import { ZH_HANS_READING_CONTENT } from "@/content/mei-hua-yi-shu/zh-Hans";
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
  return (
    <article data-seo-primary={SEO.primaryKeyword}><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "WebPage", name: SEO.finalH1, description: SEO.finalDescription, url: CANONICAL, inLanguage: "zh-Hans" }) }} />
      <header className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
        <p className="font-mono text-[11px] tracking-[0.14em] text-[var(--bronze)]">易经 · 手动输入卦象</p>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight sm:text-5xl">{SEO.finalH1}</h1>
        <p data-seo-early-copy className="mt-5 max-w-3xl text-lg leading-8 text-[var(--ink-2)]">手动起卦适合你已经有六个爻值、纸上卦象或明确的本卦与动爻位置时使用。它不会重新随机生成任何信息，只把你输入的结构转换成本卦、动爻和之卦。</p>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-12">
        <QuestionFirst storageKey="quickiching:public-v1:manual-cast" legacyStorageKeys={["quickiching:question:manual-cast"]} dictionary={dictionary}>
          <ManualCastTool dictionary={dictionary} localizedContent={ZH_HANS_READING_CONTENT} />
        </QuestionFirst>
      </section>

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
    </article>
  );
}
