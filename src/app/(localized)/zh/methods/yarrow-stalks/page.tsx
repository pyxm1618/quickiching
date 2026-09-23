import type { Metadata } from "next";
import Link from "next/link";
import { QuestionFirst } from "@/components/public-reading/question-first";
import { YarrowTool } from "@/components/public-reading/yarrow-tool";
import { getDictionary } from "@/i18n/dictionaries";
import { alternateLanguages, canonicalUrl } from "@/i18n/helpers";
import { ZH_HANS_READING_CONTENT } from "@/content/mei-hua-yi-shu/zh-Hans";
import { zhSeoFor } from "@/content/seo/zh-pages";

const SEO = zhSeoFor("yarrow-stalks-method");
const CANONICAL = canonicalUrl(SEO.canonicalUrl);

export const metadata: Metadata = {
  title: { absolute: SEO.finalTitle }, description: SEO.finalDescription,
  alternates: { canonical: CANONICAL, languages: alternateLanguages("yarrow-stalks-method") },
  openGraph: { title: SEO.finalTitle, description: SEO.finalDescription, url: CANONICAL, type: "article", locale: "zh_CN" },
  robots: { index: true, follow: true },
};

export default function ChineseYarrowStalksPage() {
  const dictionary = getDictionary("zh-Hans");
  return (
    <article data-seo-primary={SEO.primaryKeyword}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "HowTo", name: SEO.finalH1, description: SEO.finalDescription,
        url: CANONICAL, inLanguage: "zh-Hans",
      }) }} />
      <header className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
        <p className="font-mono text-[11px] tracking-[0.14em] text-[var(--bronze)]">周易筮法 · 四十九蓍</p>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight sm:text-5xl">{SEO.finalH1}</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[var(--ink-2)]">蓍草起卦不是点击一次就直接得到六爻。每一爻经过三变，六爻合计十八变。本站把每次分堆、余数和剩余蓍草都展示出来，并把进度保存在浏览器会话中。</p>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-12">
        <QuestionFirst storageKey="quickiching:public-v1:yarrow-v2" legacyStorageKeys={["quickiching:question:yarrow-stalks"]} dictionary={dictionary}>
          <YarrowTool dictionary={dictionary} localizedContent={ZH_HANS_READING_CONTENT} />
        </QuestionFirst>
      </section>

      <section className="mx-auto grid max-w-5xl gap-8 px-4 py-12 md:grid-cols-2">
        <div>
          <h2 className="font-display text-2xl font-medium">蓍草起卦的49蓍草流程</h2>
          <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">实际运算从 49 根蓍草开始。每一变包含分二、挂一和按四计数后的余数处理；三变完成后，剩余数量除以四得到该爻的 6、7、8 或 9。</p>
          <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">本站采用公开说明的朱熹式数字概率约定：第一变对应去 5 或 9，后两变对应去 4 或 8。工具保留每一步计算，方便核对，而不是把蓍草法包装成不可检查的随机按钮。</p>
        </div>
        <div>
          <h2 className="font-display text-2xl font-medium">为什么要保留十八变记录</h2>
          <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">蓍草起卦的过程本身就是方法的一部分。每一步都应保持数量守恒，并能说明这一爻为什么得到当前数值。中途中断后，浏览器记录让你从下一变继续，而不是重新生成前面的结果。</p>
          <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">实体蓍草的分堆动作可能受实际操作影响；在线版本因此明确自己的数字约定，不声称复制所有传统流派的具体手法。</p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="font-display text-2xl font-medium">蓍草起卦结果怎么读</h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--ink-2)]">完成十八变后，阅读顺序与其他方法一致：先看本卦，再看动爻，存在动爻时再看之卦。工具方法不同，但最终六爻结构使用同一套确定性计算。</p>
        <nav className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm" aria-label="蓍草起卦相关指南">
          <Link href="/zh/guides/changing-lines" className="font-semibold text-[var(--jade)] hover:underline">易经动爻</Link>
          <Link href="/zh/guides/primary-relating-hexagrams" className="font-semibold text-[var(--jade)] hover:underline">本卦与之卦</Link>
          <Link href="/zh/methods/three-coin" className="font-semibold text-[var(--jade)] hover:underline">三枚铜钱起卦</Link>
          <Link href="/zh" className="font-semibold text-[var(--jade)] hover:underline">易经在线起卦首页</Link>
        </nav>
      </section>
    </article>
  );
}
