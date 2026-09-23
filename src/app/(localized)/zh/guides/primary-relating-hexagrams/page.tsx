import type { Metadata } from "next";
import Link from "next/link";
import { alternateLanguages, canonicalUrl } from "@/i18n/helpers";
import { zhSeoFor } from "@/content/seo/zh-pages";

const SEO = zhSeoFor("guides-primary-relating");
const CANONICAL = canonicalUrl(SEO.canonicalUrl);

export const metadata: Metadata = {
  title: { absolute: SEO.finalTitle }, description: SEO.finalDescription,
  alternates: { canonical: CANONICAL, languages: alternateLanguages("guides-primary-relating") },
  openGraph: { title: SEO.finalTitle, description: SEO.finalDescription, url: CANONICAL, type: "article", locale: "zh_CN" },
  robots: { index: true, follow: true },
};

export default function ChinesePrimaryRelatingGuidePage() {
  return (
    <article className="mx-auto max-w-5xl px-4 py-12 sm:py-16" data-seo-primary={SEO.primaryKeyword}>
      <nav className="text-sm text-[var(--ink-3)]" aria-label="面包屑"><Link href="/zh" className="hover:text-[var(--jade)]">中文首页</Link><span className="mx-2">/</span><span>使用指南</span></nav>
      <header className="mt-6 max-w-4xl">
        <p className="mystic-kicker">六爻变化的两个结构</p>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight sm:text-5xl">{SEO.finalH1}</h1>
        <p className="mt-5 text-lg leading-8 text-[var(--ink-2)]">理解本卦变卦时，先把它们看成同一次起卦里的两个六爻结构：本卦是最初得到的六爻，动爻是真正发生阴阳翻转的位置，翻转后的结构在本站统一称为之卦，并注明它也常被称为变卦。</p>
      </header>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-medium">本卦：最初得到的六爻结构</h2>
        <p className="mt-4 max-w-4xl text-sm leading-7 text-[var(--ink-2)]">无论你使用三枚铜钱、蓍草、梅花易数还是手动输入，起卦首先都会得到一个本卦。它记录六个位置当前的阴阳状态，是后续判断哪些位置变化、怎样形成之卦的基础。</p>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-medium">动爻：连接本卦和变卦的位置</h2>
        <p className="mt-4 max-w-4xl text-sm leading-7 text-[var(--ink-2)]">如果使用 6、7、8、9 的爻值体系，6 和 9 是动爻。它们不是第二套卦象，而是本卦内部需要翻转的具体位置。只有这些位置发生阴阳变化，其余爻保持不变。</p>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-medium">之卦：动爻翻转后的结构</h2>
        <p className="mt-4 max-w-4xl text-sm leading-7 text-[var(--ink-2)]">把所有动爻同时翻转后得到之卦。很多中文资料把它称为变卦；为了项目术语一致，Quick I Ching 的中文界面统一显示“之卦”，首次解释时会注明“之卦（变卦）”。它用于观察变化后的结构参照，不等同于一个必然发生的未来。</p>
      </section>

      <section className="mt-12 rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-6">
        <h2 className="font-display text-2xl font-medium">本卦变卦的结构例子</h2>
        <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">假设本卦六爻自下而上为阳、阴、阳、阳、阴、阴，其中第 3 爻和第 5 爻为动爻。那么第 3 爻由阳转阴、第 5 爻由阴转阳，其他位置不变。翻转后的六爻就是之卦。整个过程只依赖已经确定的六爻与动爻位置。</p>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-medium">没有动爻时怎么办</h2>
        <p className="mt-4 max-w-4xl text-sm leading-7 text-[var(--ink-2)]">没有动爻就没有需要翻转的位置，因此本站不会为了“完整”而人工制造一个之卦。阅读停留在本卦即可，把注意力放在当前结构、卦辞、大象和现实处境的对应上。</p>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-medium">一个实用的阅读顺序</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-6 text-sm leading-7 text-[var(--ink-2)]"><li>先看本卦，确认当前结构与主题。</li><li>再定位动爻，观察变化集中在哪里。</li><li>结合相关爻位和经典爻辞理解变化。</li><li>最后看之卦，把它作为变化方向的结构参照。</li><li>把所有象征性内容重新放回现实证据、时间范围和自己的可控行动中。</li></ol>
        <nav className="mt-6 flex flex-wrap gap-5 text-sm"><Link href="/zh/guides/changing-lines" className="font-semibold text-[var(--jade)] hover:underline">易经动爻说明</Link><Link href="/zh/hexagrams" className="font-semibold text-[var(--jade)] hover:underline">易经六十四卦</Link><Link href="/zh/methods/three-coin" className="font-semibold text-[var(--jade)] hover:underline">开始三枚铜钱起卦</Link></nav>
      </section>
    </article>
  );
}
