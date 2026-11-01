import type { Metadata } from "next";
import Link from "next/link";
import { alternateLanguages, canonicalUrl } from "@/i18n/helpers";
import { zhSeoFor } from "@/content/seo/zh-pages";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import { hexagramByNumber } from "@/domain/casting/hexagrams/king-wen";
import { InfoPageShell } from "@/components/info-pages/info-page-shell";
import { PrimaryRelatingPrimer } from "@/components/info-pages/info-diagrams";
import { PaperArtwork } from "@/components/info-pages/paper-artwork";
import styles from "@/components/info-pages/info-pages.module.css";

const SEO = zhSeoFor("guides-primary-relating");
const CANONICAL = canonicalUrl(SEO.canonicalUrl);

export const metadata: Metadata = {
  title: { absolute: SEO.finalTitle }, description: SEO.finalDescription,
  alternates: { canonical: CANONICAL, languages: alternateLanguages("guides-primary-relating") },
  openGraph: { title: SEO.finalTitle, description: SEO.finalDescription, url: CANONICAL, type: "article", locale: "zh_CN" },
  robots: { index: true, follow: true },
};

const STRUCTURE_EXAMPLE = buildHexagramResult({ lineValuesBottomUp: [7, 8, 9, 7, 6, 8], method: "three_coin" });
const STRUCTURE_PRIMARY = hexagramByNumber(STRUCTURE_EXAMPLE.primaryHexagramNumber);
if (STRUCTURE_EXAMPLE.relatingHexagramNumber === null) throw new Error("ZH_GUIDE_STRUCTURE_EXAMPLE_REQUIRES_RELATING_HEXAGRAM");
const STRUCTURE_RELATING = hexagramByNumber(STRUCTURE_EXAMPLE.relatingHexagramNumber);

export default function ChinesePrimaryRelatingGuidePage() {
  return (
    <InfoPageShell
      title={SEO.finalH1}
      seoPrimary={SEO.primaryKeyword}
      lead={<span data-seo-early-copy>理解本卦变卦时，先把它们看成同一次起卦里的两个六爻结构：本卦是最初得到的六爻，动爻是真正发生阴阳翻转的位置，翻转后的结构在本站统一称为之卦，并注明它也常被称为变卦。</span>}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "WebPage", name: SEO.finalH1, description: SEO.finalDescription, url: CANONICAL, inLanguage: "zh-Hans" }) }} />
        <section className={styles.guideMain}>
          <PaperArtwork />
          <PrimaryRelatingPrimer locale="zh-Hans" descriptions={[
            <div key="0"><h2 className={styles.paperSubheading}>本卦变卦的第一步：理解本卦结构</h2><p className={styles.paperText}>无论你使用三枚铜钱、蓍草、梅花易数还是手动输入，起卦首先都会得到一个本卦。它记录六个位置当前的阴阳状态，是后续判断哪些位置变化、怎样形成之卦的基础。</p></div>,
            <div key="1"><h2 className={styles.paperSubheading}>动爻：连接本卦和变卦的位置</h2><p className={styles.paperText}>如果使用 6、7、8、9 的爻值体系，6 和 9 是动爻。它们不是第二套卦象，而是本卦内部需要翻转的具体位置。只有这些位置发生阴阳变化，其余爻保持不变。</p></div>,
            <div key="2"><h2 className={styles.paperSubheading}>之卦：动爻翻转后的结构</h2><p className={styles.paperText}>把所有动爻同时翻转后得到之卦。很多中文资料把它称为变卦；为了项目术语一致，Quick I Ching 的中文界面统一显示“之卦”，首次解释时会注明“之卦（变卦）”。它用于观察变化后的结构参照，不等同于一个必然发生的未来。</p></div>,
          ]} />
        </section>
        <section className={styles.guideSecondary}>
          <PaperArtwork kind="secondary" />
          <h2 className={styles.paperHeading}>本卦变卦的结构例子</h2>
          <p className={styles.paperText}>假设本卦六爻自下而上为阳、阴、阳、阳、阴、阴，其中第 3 爻和第 5 爻为动爻。那么第 3 爻由阳转阴、第 5 爻由阴转阳，其他位置不变。翻转后的六爻就是之卦。整个过程只依赖已经确定的六爻与动爻位置。</p>
          <div className={styles.questionGrid}>
            <section className={styles.exampleCard}><h3>本卦</h3><p><strong>第 {STRUCTURE_PRIMARY.number} 卦 · {STRUCTURE_PRIMARY.chineseName}</strong></p><p>这是任何动爻翻转前的原始六爻结构。</p></section>
            <section className={styles.exampleCard}><h3>动爻</h3><p><strong>第 {STRUCTURE_EXAMPLE.movingLinePositions.join("、")} 爻</strong></p><p>只有这些实际动爻翻转，其余位置保持本卦原来的阴阳。</p></section>
            <section className={styles.exampleCard}><h3>之卦</h3><p><strong>第 {STRUCTURE_RELATING.number} 卦 · {STRUCTURE_RELATING.chineseName}</strong></p><p>这个结构来自同一次起卦中的实际动爻，不是重新随机生成。</p></section>
          </div>
          <section className={styles.sectionBreak}><h2 className={styles.paperHeading}>没有动爻时怎么办</h2><p className={styles.paperText}>没有动爻就没有需要翻转的位置，因此本站不会为了“完整”而人工制造一个之卦。阅读停留在本卦即可，把注意力放在当前结构、卦辞、大象和现实处境的对应上。</p></section>
          <section className={styles.sectionBreak}><h2 className={styles.paperHeading}>一个实用的阅读顺序</h2>
            <ol className={styles.paperOrdered}><li>先看本卦，确认当前结构与主题。</li><li>再定位动爻，观察变化集中在哪里。</li><li>结合相关爻位和经典爻辞理解变化。</li><li>最后看之卦，把它作为变化方向的结构参照。</li><li>把所有象征性内容重新放回现实证据、时间范围和自己的可控行动中。</li></ol>
          </section>
          <nav className={styles.relatedNav} aria-label="相关卦象指南"><Link href="/zh/guides/changing-lines">易经动爻说明</Link><Link href="/zh/hexagrams">易经六十四卦</Link><Link href="/zh/methods/three-coin">开始三枚铜钱起卦</Link></nav>
        </section>
    </InfoPageShell>
  );
}
