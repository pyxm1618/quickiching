import type { Metadata } from "next";
import Link from "next/link";
import { alternateLanguages, canonicalUrl } from "@/i18n/helpers";
import { zhSeoFor } from "@/content/seo/zh-pages";

const SEO = zhSeoFor("guides-changing-lines");
const CANONICAL = canonicalUrl(SEO.canonicalUrl);

export const metadata: Metadata = {
  title: { absolute: SEO.finalTitle }, description: SEO.finalDescription,
  alternates: { canonical: CANONICAL, languages: alternateLanguages("guides-changing-lines") },
  openGraph: { title: SEO.finalTitle, description: SEO.finalDescription, url: CANONICAL, type: "article", locale: "zh_CN" },
  robots: { index: true, follow: true },
};

const values = [
  ["6", "老阴", "阴爻", "会变为阳爻"],
  ["7", "少阳", "阳爻", "保持不变"],
  ["8", "少阴", "阴爻", "保持不变"],
  ["9", "老阳", "阳爻", "会变为阴爻"],
] as const;

export default function ChineseChangingLinesGuidePage() {
  return (
    <article className="mx-auto max-w-5xl px-4 py-12 sm:py-16" data-seo-primary={SEO.primaryKeyword}><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "WebPage", name: SEO.finalH1, description: SEO.finalDescription, url: CANONICAL, inLanguage: "zh-Hans" }) }} />
      <nav className="text-sm text-[var(--ink-3)]" aria-label="面包屑"><Link href="/zh" className="hover:text-[var(--jade)]">中文首页</Link><span className="mx-2">/</span><span>使用指南</span></nav>
      <header className="mt-6 max-w-4xl">
        <p className="mystic-kicker">六爻中的变化位置</p>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight sm:text-5xl">{SEO.finalH1}</h1>
        <p data-seo-early-copy className="mt-5 text-lg leading-8 text-[var(--ink-2)]">易经动爻指六爻中实际发生阴阳翻转的位置。三枚铜钱和蓍草法常用 6、7、8、9 表示四种爻值，其中 6 与 9 会变化，7 与 8 保持稳定。把动爻翻转后，才得到之卦（也常称变卦）。</p>
      </header>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-medium">易经动爻的四种爻值</h2>
        <div className="mt-5 overflow-x-auto rounded-2xl border border-[var(--line)]">
          <table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-white/[0.03]"><tr><th className="p-4">爻值</th><th className="p-4">名称</th><th className="p-4">当前阴阳</th><th className="p-4">是否变化</th></tr></thead><tbody>{values.map((row) => <tr key={row[0]} className="border-t border-[var(--line)]">{row.map((cell) => <td key={cell} className="p-4 text-[var(--ink-2)]">{cell}</td>)}</tr>)}</tbody></table>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-medium">从动爻到之卦怎么生成</h2>
        <p className="mt-4 max-w-4xl text-sm leading-7 text-[var(--ink-2)]">先保留本卦的六个位置不动，只翻转属于 6 或 9 的爻：老阴由阴转阳，老阳由阳转阴。所有需要翻转的位置同时处理后形成新的六爻结构，这个结构就是本站所称的之卦。它是由实际动爻计算出来的，不是另外再起一次卦。</p>
      </section>

      <section className="mt-12 rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-6">
        <h2 className="font-display text-2xl font-medium">例子：7 / 8 / 9 / 7 / 6 / 8</h2>
        <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">按自下而上的顺序，这组六爻里第 3 爻为 9、第 5 爻为 6，因此只有第 3、5 爻是动爻。生成之卦时，第 3 爻由阳转阴，第 5 爻由阴转阳，其余四爻保持原样。阅读时先确认本卦，再集中看这两个变化位置，最后把之卦作为变化后的结构参照。</p>
      </section>

      <section className="mt-12 grid gap-6 md:grid-cols-3">
        <div className="mystic-card-soft p-5"><h2 className="font-display text-xl font-medium">没有动爻</h2><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">六爻全部稳定，只读本卦，不强行生成之卦。</p></div>
        <div className="mystic-card-soft p-5"><h2 className="font-display text-xl font-medium">一个动爻</h2><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">变化位置很集中，可以结合该爻的爻位、经典爻辞与本卦整体一起看。</p></div>
        <div className="mystic-card-soft p-5"><h2 className="font-display text-xl font-medium">多个动爻</h2><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">不要把每一爻拆成互相无关的预言；先看变化集中在哪些位置，再观察它们如何共同改变六爻结构。</p></div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-medium">动爻的阅读顺序</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-6 text-sm leading-7 text-[var(--ink-2)]"><li>先确认本卦的核心结构和所问处境。</li><li>标出 6 与 9 所在的动爻位置。</li><li>阅读相关爻位和爻辞，但不要脱离本卦单独断句。</li><li>再查看动爻翻转形成的之卦，理解结构往哪里变化。</li><li>最后回到现实证据和可执行行动，不把象征性变化当作确定结果。</li></ol>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-medium">如何克制地理解变化</h2>
        <p className="mt-4 max-w-4xl text-sm leading-7 text-[var(--ink-2)]">易经动爻说明“哪里发生结构变化”，并不能证明某个未来事件一定发生。关系中的另一方仍有自主选择，工作与财务也受现实条件影响。把动爻当作需要核对的位置，会比把它当成命令更有用。</p>
        <nav className="mt-6 flex flex-wrap gap-5 text-sm"><Link href="/zh/guides/primary-relating-hexagrams" className="font-semibold text-[var(--jade)] hover:underline">继续了解本卦与之卦</Link><Link href="/zh/methods/three-coin" className="font-semibold text-[var(--jade)] hover:underline">三枚铜钱起卦</Link><Link href="/zh/methods/yarrow-stalks" className="font-semibold text-[var(--jade)] hover:underline">蓍草起卦</Link></nav>
      </section>
    </article>
  );
}
