import type { Metadata } from "next";
import Link from "next/link";
import { alternateLanguages, canonicalUrl } from "@/i18n/helpers";
import { zhSeoFor } from "@/content/seo/zh-pages";
import styles from "@/app/method-seo-shell.module.css";
import { GildedTitle } from "@/components/typography/gilded-title";

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
  return (
    <article className={styles.methodPage} data-seo-primary={SEO.primaryKeyword}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "HowTo", name: SEO.finalH1, description: SEO.finalDescription,
        url: CANONICAL, inLanguage: "zh-Hans",
      }) }} />
      <header className={styles.intro}>
        <p className={styles.eyebrow}>周易起卦 · 三枚铜钱法</p>
        <GildedTitle size="lg" className={styles.title}>{SEO.finalH1}</GildedTitle>
        <p data-seo-early-copy className={styles.lead}>三枚铜钱起卦把六次掷币依次转换成六爻。第一次结果是最下方的初爻，之后逐爻向上；爻值 6 和 9 是动爻，会翻转形成之卦（变卦）。本页说明起卦原理与读法，完整起卦在首页进行。</p>
      </header>

      <section className={styles.toolStage} data-three-coin-method-detail-cta>
        <div className={styles.folio}>
          <h2 className={styles.sectionTitle}>开始三枚铜钱起卦</h2>
          <p className={styles.bodyText}>完整起卦在 Quick I Ching 首页进行。本页说明起卦方法；真正的起卦只有一个权威入口。</p>
          <Link href="/zh" className={styles.relatedLink} data-three-coin-cta>前往首页开始起卦 →</Link>
        </div>
      </section>

      <section className={styles.readingGrid}>
        <div className={styles.folio}>
          <h2 className={styles.sectionTitle}>三枚铜钱起卦怎么算</h2>
          <ol className={styles.orderedList}>
            <li>每一爻同时得到三枚铜钱的阴阳面，阳面记 3，阴面记 2。</li>
            <li>三枚相加只会得到 6、7、8、9 四种爻值。</li>
            <li>6 为老阴、9 为老阳，二者属于动爻；7 为少阳、8 为少阴。</li>
            <li>从初爻开始连续完成六次，形成完整本卦。</li>
            <li>把所有动爻阴阳翻转后得到之卦，用来观察结构变化，而不是把它当作保证发生的结果。</li>
          </ol>
        </div>
        <div className={styles.folio}>
          <h2 className={styles.sectionTitle}>在线铜钱起卦会保存什么</h2>
          <p className={styles.bodyText}>每次已经落定的掷币结果都会保存在当前浏览器会话中，刷新后可以继续。免费结果包含六爻、本卦、动爻位置、存在时的之卦，以及中文结构说明。</p>
          <p className={styles.bodyText}>已经生成的单爻不能手工改写；只有明确选择重新起卦时，才会丢弃当前六爻并从头开始。这样可以避免为了得到偏好的结果反复修改同一卦。</p>
        </div>
      </section>

      <section className={styles.readingSection}>
        <h2 className={styles.sectionTitle}>三枚铜钱起卦完成后怎么读</h2>
        <p className={styles.bodyText}>先看本卦描述的原始结构，再看哪些爻发生变化，最后对照之卦。没有动爻时就停留在本卦，不额外制造第二个结果。你也可以继续查阅六十四卦中文详情和动爻说明。</p>
        <nav className={styles.relatedNav} aria-label="三枚铜钱起卦相关指南">
          <Link href="/zh/guides/changing-lines" className={styles.relatedLink}>易经动爻说明</Link>
          <Link href="/zh/guides/primary-relating-hexagrams" className={styles.relatedLink}>本卦、动爻与之卦</Link>
          <Link href="/zh/guides/how-to-ask-the-i-ching" className={styles.relatedLink}>易经怎么问</Link>
          <Link href="/zh/methods/yarrow-stalks" className={styles.relatedLink}>比较蓍草起卦</Link>
        </nav>
      </section>
    </article>
  );
}
