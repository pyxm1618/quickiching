import type { Metadata } from "next";
import Link from "next/link";
import { alternateLanguages, canonicalUrl } from "@/i18n/helpers";
import { zhSeoFor } from "@/content/seo/zh-pages";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import { hexagramByNumber } from "@/domain/casting/hexagrams/king-wen";
import { InfoPageShell } from "@/components/info-pages/info-page-shell";
import { ChangingLinesPrimer } from "@/components/info-pages/info-diagrams";
import { PaperArtwork } from "@/components/info-pages/paper-artwork";
import styles from "@/components/info-pages/info-pages.module.css";

const SEO = zhSeoFor("guides-changing-lines");
const CANONICAL = canonicalUrl(SEO.canonicalUrl);

export const metadata: Metadata = {
  title: { absolute: SEO.finalTitle }, description: SEO.finalDescription,
  alternates: { canonical: CANONICAL, languages: alternateLanguages("guides-changing-lines") },
  openGraph: { title: SEO.finalTitle, description: SEO.finalDescription, url: CANONICAL, type: "article", locale: "zh_CN" },
  robots: { index: true, follow: true },
};

const values = [
  ["6", "老阴", "阴爻", "会变为阳爻"], ["7", "少阳", "阳爻", "保持不变"],
  ["8", "少阴", "阴爻", "保持不变"], ["9", "老阳", "阳爻", "会变为阴爻"],
] as const;
const WORKED_EXAMPLE = buildHexagramResult({ lineValuesBottomUp: [7, 8, 9, 7, 6, 8], method: "three_coin" });
const WORKED_PRIMARY = hexagramByNumber(WORKED_EXAMPLE.primaryHexagramNumber);
if (WORKED_EXAMPLE.relatingHexagramNumber === null) throw new Error("ZH_GUIDE_WORKED_EXAMPLE_REQUIRES_RELATING_HEXAGRAM");
const WORKED_RELATING = hexagramByNumber(WORKED_EXAMPLE.relatingHexagramNumber);

export default function ChineseChangingLinesGuidePage() {
  return (
    <InfoPageShell title={SEO.finalH1}
      seoPrimary={SEO.primaryKeyword} lead={<span data-seo-early-copy>易经动爻指六爻中实际发生阴阳翻转的位置。三枚铜钱和蓍草法常用 6、7、8、9 表示四种爻值，其中 6 与 9 会变化，7 与 8 保持稳定。把动爻翻转后，才得到之卦（也常称变卦）。</span>}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "WebPage", name: SEO.finalH1, description: SEO.finalDescription, url: CANONICAL, inLanguage: "zh-Hans" }) }} />
        <section className={styles.guideMain}>
          <PaperArtwork />
          <h2 className={styles.paperHeading}>易经动爻的四种爻值</h2>
          <ChangingLinesPrimer locale="zh-Hans">
            <h2 className={styles.paperHeading}>从动爻到之卦怎么生成</h2>
            <p className={styles.paperText}>先保留本卦的六个位置不动，只翻转属于 6 或 9 的爻：老阴由阴转阳，老阳由阳转阴。所有需要翻转的位置同时处理后形成新的六爻结构，这个结构就是本站所称的之卦。它是由实际动爻计算出来的，不是另外再起一次卦。</p>
          </ChangingLinesPrimer>
        </section>
        <section className={styles.guideSecondary}>
          <PaperArtwork kind="secondary" />
          <table className={styles.dataTable}><thead><tr><th>爻值</th><th>名称</th><th>当前阴阳</th><th>是否变化</th></tr></thead>
            <tbody>{values.map(row => <tr key={row[0]}>{row.map(cell => <td key={cell}>{cell}</td>)}</tr>)}</tbody></table>
          <section className={styles.sectionBreak}>
            <h2 className={styles.paperHeading}>例子：7 / 8 / 9 / 7 / 6 / 8</h2>
            <p className={styles.paperText}>按自下而上的顺序，这组六爻里第 3 爻为 9、第 5 爻为 6，因此只有第 3、5 爻是动爻。生成之卦时，第 3 爻由阳转阴，第 5 爻由阴转阳，其余四爻保持原样。阅读时先确认本卦，再集中看这两个变化位置，最后把之卦作为变化后的结构参照。</p>
            <div className={styles.callout}><p><strong>本卦：</strong>第 {WORKED_PRIMARY.number} 卦 · {WORKED_PRIMARY.chineseName}</p><p><strong>动爻：</strong>第 {WORKED_EXAMPLE.movingLinePositions.join("、")} 爻</p><p><strong>之卦：</strong>第 {WORKED_RELATING.number} 卦 · {WORKED_RELATING.chineseName}</p></div>
          </section>
          <div className={styles.questionGrid}>
            <section className={styles.exampleCard}><h3>没有动爻</h3><p>六爻全部稳定，只读本卦，不强行生成之卦。</p></section>
            <section className={styles.exampleCard}><h3>一个动爻</h3><p>变化位置很集中，可以结合该爻的爻位、经典爻辞与本卦整体一起看。</p></section>
            <section className={styles.exampleCard}><h3>多个动爻</h3><p>不要把每一爻拆成互相无关的预言；先看变化集中在哪些位置，再观察它们如何共同改变六爻结构。</p></section>
          </div>
          <section className={styles.sectionBreak}><h2 className={styles.paperHeading}>易经动爻的阅读顺序</h2>
            <ol className={styles.paperOrdered}><li>先确认本卦的核心结构和所问处境。</li><li>标出 6 与 9 所在的动爻位置。</li><li>阅读相关爻位和爻辞，但不要脱离本卦单独断句。</li><li>再查看动爻翻转形成的之卦，理解结构往哪里变化。</li><li>最后回到现实证据和可执行行动，不把象征性变化当作确定结果。</li></ol>
          </section>
          <section className={styles.sectionBreak}><h2 className={styles.paperHeading}>如何克制地理解变化</h2><p className={styles.paperText}>易经动爻说明“哪里发生结构变化”，并不能证明某个未来事件一定发生。关系中的另一方仍有自主选择，工作与财务也受现实条件影响。把动爻当作需要核对的位置，会比把它当成命令更有用。</p></section>
          <nav className={styles.relatedNav} aria-label="相关动爻页面"><Link href="/zh/guides/primary-relating-hexagrams">继续了解本卦与之卦</Link><Link href="/zh/methods/three-coin">三枚铜钱起卦</Link><Link href="/zh/methods/yarrow-stalks">蓍草起卦</Link></nav>
        </section>
    </InfoPageShell>
  );
}
