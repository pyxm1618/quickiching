import type { Metadata } from "next";
import Link from "next/link";
import { MeiHuaNumberFlow } from "@/components/public-reading/mei-hua-number-flow";
import { alternateLanguages, canonicalUrl } from "@/i18n/helpers";
import { ZH_HANS_MEI_HUA_CONTENT } from "@/content/mei-hua-yi-shu/zh-Hans";
import { zhSeoFor } from "@/content/seo/zh-pages";
import styles from "@/app/method-seo-shell.module.css";

export function generateMetadata(): Metadata {
  const seo = zhSeoFor("mei-hua-yi-shu");
  const canonical = canonicalUrl(seo.canonicalUrl);
  return {
    title: { absolute: seo.finalTitle },
    description: seo.finalDescription,
    alternates: { canonical, languages: alternateLanguages("mei-hua-yi-shu") },
    openGraph: { title: seo.finalTitle, description: seo.finalDescription, url: canonical, type: "article", locale: "zh_CN" },
  };
}

export default function ChineseMeiHuaPage() {
  const content = ZH_HANS_MEI_HUA_CONTENT;
  const seo = zhSeoFor("mei-hua-yi-shu");

  return (
    <>
      <MeiHuaNumberFlow locale="zh-Hans" />
      <article className={styles.methodPage} data-seo-primary={seo.primaryKeyword}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>{content.eyebrow}</p>
        <h1 className={styles.title}>{seo.finalH1}</h1>
        <p data-seo-early-copy className={styles.lead}>{content.introduction}</p>
      </header>

      <section className={styles.readingSection}>
        <h2 className={styles.sectionTitle}>梅花易数起卦：数字 + 时刻规则</h2>
        <p className={styles.bodyText}>本站正式流程使用一个用户数字和点击确认时的当地十二时辰序数起卦，并锁定 UTC 精确时刻与 IANA 时区，使同一份结果可以复现。</p>
      </section>

      <section className={styles.readingSection} aria-labelledby="zh-positioning-title">
        <p className={styles.sectionKicker}>方法范围</p>
        <h2 id="zh-positioning-title" className={styles.sectionTitle}>{content.positioning.heading}</h2>
        {content.positioning.paragraphs.map((paragraph) => <p key={paragraph} className={styles.bodyText}>{paragraph}</p>)}
        <div className={styles.scopeGrid}>
          <div className={styles.scopePanel}><h3 className={styles.subTitle}>本页支持</h3><ul className={styles.bulletList}>{content.scope.supported.map((item) => <li key={item}>{item}</li>)}</ul></div>
          <div className={styles.scopePanel}><h3 className={styles.subTitle}>本页暂不支持</h3><ul className={styles.bulletList}>{content.scope.notSupported.map((item) => <li key={item}>{item}</li>)}</ul></div>
        </div>
      </section>

      <section className={`${styles.readingSection} ${styles.conventionGrid}`} aria-labelledby="zh-convention-title">
        <div>
          <p className={styles.sectionKicker}>数字 + 时刻规则</p>
          <h2 id="zh-convention-title" className={styles.sectionTitle}>{content.convention.heading}</h2>
          {content.convention.paragraphs.map((paragraph) => <p key={paragraph} className={styles.bodyText}>{paragraph}</p>)}
        </div>
        <ul className={`${styles.listPanel} ${styles.bulletList}`}>{content.convention.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
      </section>

      <section className={styles.readingSection} aria-labelledby="zh-interpretation-title">
        <p className={styles.sectionKicker}>阅读结果</p>
        <h2 id="zh-interpretation-title" className={styles.sectionTitle}>{content.interpretation.heading}</h2>
        {content.interpretation.paragraphs.map((paragraph) => <p key={paragraph} className={styles.bodyText}>{paragraph}</p>)}
        <nav className={styles.relatedNav} aria-label="中文梅花易数相关链接"><Link href="/zh" className={styles.relatedLink}>{content.navigation.home}</Link><Link href="/zh/hexagrams" className={styles.relatedLink}>{content.navigation.hexagrams}</Link><Link href="/zh/guides/changing-lines" className={styles.relatedLink}>{content.navigation.changingLines}</Link></nav>
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
    </>
  );
}
