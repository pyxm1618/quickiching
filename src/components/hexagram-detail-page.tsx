import React from "react";
import { BookOpen, Cloud, Lightbulb, Sun, TriangleAlert, Triangle } from "lucide-react";
import styles from "./hexagram-detail-page.module.css";
import Link from "next/link";
import { preload } from "react-dom";
import { TRIGRAM_BITS } from "@/domain/casting/hexagrams/king-wen";
import type { ContentLocale } from "@/i18n/config";
import { CLASSICAL_HEXAGRAMS, type ClassicalHexagram } from "@/domain/public-reading/classical";
import type { PublicHexagramKnowledge } from "@/domain/public-reading/knowledge";
import type { HexagramSeoEntry } from "@/content/hexagrams/seo";
import type { ZhHansHexagramDetailContent } from "@/content/hexagrams/types";
import { absoluteUrl } from "@/lib/seo";

export type HexagramDetailPageViewProps = {
  locale: ContentLocale;
  knowledge: Omit<PublicHexagramKnowledge, "detail"> & { detail?: PublicHexagramKnowledge["detail"] };
  seo: HexagramSeoEntry;
  content?: ZhHansHexagramDetailContent;
  previous: ClassicalHexagram | null;
  next: ClassicalHexagram | null;
};

const ENGLISH_LINE_POSITIONS = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth"] as const;
const POSITIONS = ["初爻", "二爻", "三爻", "四爻", "五爻", "上爻"] as const;
const ENGLISH_TRIGRAM_NAMES: Record<string, string> = {
  qian: "Heaven",
  kun: "Earth",
  zhen: "Thunder",
  xun: "Wind",
  kan: "Water",
  li: "Fire",
  gen: "Mountain",
  dui: "Lake",
};
const CHINESE_TRIGRAM_NAMES: Record<string, string> = {
  qian: "乾",
  kun: "坤",
  zhen: "震",
  xun: "巽",
  kan: "坎",
  li: "离",
  gen: "艮",
  dui: "兑",
};
function detailPath(locale: ContentLocale, slug: string): string {
  return locale === "zh-Hans" ? "/zh/hexagrams/" + slug : "/hexagrams/" + slug;
}

function fullChineseName(seo: HexagramSeoEntry): string {
  return seo.hexagramName.split("｜")[1] ?? seo.hexagramName;
}

function keywordPhrases(value: string): string[] {
  return value.split(/[;；]/u).map((phrase) => phrase.trim()).filter(Boolean);
}

function preferredSecondary(seo: HexagramSeoEntry): string {
  if (seo.locale === "en") return seo.secondaryCore;
  return keywordPhrases(seo.secondaryCore)[0] ?? fullChineseName(seo);
}

function chineseCopy(value: string | undefined): string {
  return (value ?? "")
    .replace(/Quick\s*I\s*Ching/giu, "本站")
    .replace(/QuickIChing/giu, "本站")
    .replace(/\bURL\b/gu, "网址");
}

function buildStructuredData({
  locale,
  knowledge,
  seo,
  hubPath,
}: Pick<HexagramDetailPageViewProps, "locale" | "knowledge" | "seo"> & { hubPath: string }) {
  const canonical = absoluteUrl(detailPath(locale, knowledge.slug));
  const breadcrumbName = locale === "zh-Hans" ? seo.hexagramName : "Hexagram " + knowledge.number + " " + knowledge.englishName;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": canonical + "#webpage",
        name: seo.finalTitle,
        description: seo.finalDescription,
        url: canonical,
        inLanguage: locale === "zh-Hans" ? "zh-Hans" : "en",
        isPartOf: { "@type": "WebSite", name: "Quick I Ching", url: absoluteUrl("/") },
      },
      {
        "@type": "BreadcrumbList",
        "@id": canonical + "#breadcrumb",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: locale === "zh-Hans" ? "中文卦库" : "Hexagram index", item: absoluteUrl(hubPath) },
          { "@type": "ListItem", position: 2, name: breadcrumbName, item: canonical },
        ],
      },
    ],
  };
}

function DetailSectionTitle({ number, id, children }: { number: string; id: string; children: React.ReactNode }) {
  return <h2 id={id} className={styles.sectionTitle}><span aria-hidden="true">{number}</span>{children}</h2>;
}

function detailLineValues(trigrams: ClassicalHexagram["trigrams"]): number[] {
  const bits = (TRIGRAM_BITS[trigrams.upper as keyof typeof TRIGRAM_BITS] << 3) | TRIGRAM_BITS[trigrams.lower as keyof typeof TRIGRAM_BITS];
  return Array.from({ length: 6 }, (_, index) => (bits & (1 << index)) !== 0 ? 7 : 8);
}

function DetailLineBars({ lines, related = false, locale = "en" }: { lines: number[]; related?: boolean; locale?: ContentLocale }) {
  const isChinese = locale === "zh-Hans";
  return <div className={styles.hexagramBars} role="img" aria-label={lines.slice().reverse().map((value, index) => isChinese ? "第" + (6 - index) + "爻：" + (value === 7 ? "阳" : "阴") : "Line " + (6 - index) + ": " + (value === 7 ? "yang" : "yin")).join("; ")}>
    {lines.slice().reverse().map((value, index) => <span key={index} data-hexagram-line={related ? undefined : 6 - index} data-related-line={related ? 6 - index : undefined} className={value === 7 ? styles.yang : styles.yin}><i /><i /></span>)}
  </div>;
}

/* Native images use pre-encoded approved art; offscreen ornaments load near the viewport. */
/* eslint-disable @next/next/no-img-element */
function DetailScrollFrame() {
  return <div className={styles.frame} aria-hidden="true">
    <div className={styles.leftEdge} data-scroll-side="left"><span><img src="/hexagram-detail/delivery/left-top-160.avif" alt="" width={160} height={354} fetchPriority="low" decoding="async" /></span><span /><span><img src="/hexagram-detail/delivery/left-bottom-160.avif" alt="" width={160} height={267} fetchPriority="low" loading="lazy" decoding="async" /></span></div>
    <div className={styles.rightEdge} data-scroll-side="right"><span><img src="/hexagram-detail/delivery/right-top-162.avif" alt="" width={162} height={354} fetchPriority="low" decoding="async" /></span><span /><span><img src="/hexagram-detail/delivery/right-bottom-162.avif" alt="" width={162} height={267} fetchPriority="low" loading="lazy" decoding="async" /></span></div>
    <div className={styles.topScroll}><picture><source media="(max-width: 960px)" srcSet="/hexagram-detail/delivery/top-scroll-480.avif 1x, /hexagram-detail/delivery/top-scroll-960.avif 2x" /><img src="/hexagram-detail/delivery/top-scroll-1557.avif" alt="" width={1557} height={297} fetchPriority="low" decoding="async" /></picture></div>
    <div className={styles.bottomScroll}><picture><source media="(max-width: 960px)" srcSet="/hexagram-detail/delivery/bottom-scroll-480.avif 1x, /hexagram-detail/delivery/bottom-scroll-960.avif 2x" /><img src="/hexagram-detail/delivery/bottom-scroll-1575.avif" alt="" width={1575} height={223} loading="lazy" decoding="async" /></picture></div>
    <div className={styles.cherryTop}><img src="/hexagram-detail/delivery/cherry-top-190.avif" srcSet="/hexagram-detail/delivery/cherry-top-24.avif 24w, /hexagram-detail/delivery/cherry-top-48.avif 48w, /hexagram-detail/delivery/cherry-top-190.avif 190w, /hexagram-detail/delivery/cherry-top-380.avif 380w" sizes="(max-width: 540px) 17px, (max-width: 960px) 24px, (max-width: 1440px) 13vw, 190px" alt="" width={1334} height={1179} fetchPriority="low" decoding="async" /></div>
    <div className={styles.cherryBottom}><img src="/hexagram-detail/delivery/cherry-bottom-144.avif" srcSet="/hexagram-detail/delivery/cherry-bottom-24.avif 24w, /hexagram-detail/delivery/cherry-bottom-48.avif 48w, /hexagram-detail/delivery/cherry-bottom-144.avif 144w, /hexagram-detail/delivery/cherry-bottom-288.avif 288w" sizes="(max-width: 540px) 17px, (max-width: 1440px) 10vw, 144px" alt="" width={1334} height={1179} loading="lazy" decoding="async" /></div>
    <div className={styles.pine}><img src="/hexagram-detail/delivery/pine-40.avif" srcSet="/hexagram-detail/delivery/pine-40.avif 1x, /hexagram-detail/delivery/pine-80.avif 2x" alt="" width={1334} height={1179} loading="lazy" decoding="async" /></div>
  </div>;
}

function DetailHeroArtwork() {
  return <picture className={styles.taiji}>
    <source media="(max-width: 540px)" srcSet="/hexagram-detail/delivery/taiji-290.avif 1x, /hexagram-detail/delivery/taiji-580.avif 2x" />
    <source media="(max-width: 960px)" srcSet="/hexagram-detail/delivery/taiji-360.avif 1x, /hexagram-detail/delivery/taiji-720.avif 2x" />
    <img src="/hexagram-detail/delivery/taiji-660.avif" srcSet="/hexagram-detail/delivery/taiji-660.avif 1x, /hexagram-detail/delivery/taiji-1320.avif 2x" alt="" width={2048} height={2048} fetchPriority="low" decoding="async" />
  </picture>;
}

/* eslint-enable @next/next/no-img-element */

export function HexagramDetailPageView({
  locale,
  knowledge,
  seo,
  content,
  previous,
  next,
}: HexagramDetailPageViewProps) {
  const isChinese = locale === "zh-Hans";
  if (isChinese && !content) throw new Error("ZH_HANS_HEXAGRAM_CONTENT_REQUIRED: " + knowledge.number);
  const zhContent = isChinese ? content! : undefined;
  const hubPath = isChinese ? "/zh/hexagrams" : "/hexagrams";
  const secondary = preferredSecondary(seo);
  const structuredData = buildStructuredData({ locale, knowledge, seo, hubPath });
  const staticLines = detailLineValues(knowledge.trigrams);
  const detail = knowledge.detail;
  const englishH1Prefix = !isChinese && seo.finalH1.endsWith(knowledge.englishName) ? seo.finalH1.slice(0, -knowledge.englishName.length) : "";

  preload("/hexagram-detail/delivery/paper-627.webp", { as: "image", imageSrcSet: "/hexagram-detail/delivery/paper-627.webp 1x, /hexagram-detail/delivery/paper-1254.webp 2x", fetchPriority: "high", media: "(min-width: 961px)" });
  preload("/hexagram-detail/delivery/paper-mobile-627.webp", { as: "image", imageSrcSet: "/hexagram-detail/delivery/paper-mobile-627.webp 1x, /hexagram-detail/delivery/paper-mobile-1254.webp 2x", fetchPriority: "high", media: "(max-width: 960px)" });
  preload("/hexagram-detail/delivery/scene-mobile-512.avif", { as: "image", imageSrcSet: "/hexagram-detail/delivery/scene-mobile-512.avif 1x, /hexagram-detail/delivery/scene-mobile-1024.avif 2x", media: "(min-width: 541px) and (max-width: 960px)", fetchPriority: "low" });
  preload("/hexagram-detail/delivery/scene-mobile-640.avif", { as: "image", media: "(max-width: 540px)", fetchPriority: "low" });
  preload("/hexagram-detail/delivery/left-repeat-160.webp", { as: "image", fetchPriority: "low" });
  preload("/hexagram-detail/delivery/right-repeat-162.webp", { as: "image", fetchPriority: "low" });

  const hasEnglishLineRenderings = !isChinese && Boolean(detail?.lines?.some((line) => line.rendering.editorialRendering));
  const hasStageStates = !isChinese && Boolean(detail?.lines?.some((line) => line.stageState?.text));
  const readingCases = detail?.specialReadingCases?.filter((entry) => entry.rendering.editorialRendering) ?? [];
  const relationships = detail?.relationships?.filter((entry) => CLASSICAL_HEXAGRAMS.some((hexagram) => hexagram.number === entry.relatedHexagram)) ?? [];
  const sections = [
    { id: "basic-identity", number: "01", label: isChinese ? "基本信息" : "Basic Identity" },
    { id: "hexagram-meaning-title", number: "02", label: isChinese ? "卦意" : "Meaning" },
    { id: "hexagram-classical-title", number: "03", label: isChinese ? "经典文本" : "Classical Text" },
    { id: "hexagram-lines-title", number: "04", label: isChinese ? "六爻" : "Six Lines" },
    ...(readingCases.length > 0 ? [{ id: "hexagram-cases-title", number: "05", label: isChinese ? "特殊用例" : "Reading Cases" }] : []),
    ...(relationships.length > 0 ? [{ id: "hexagram-relations-title", number: "06", label: isChinese ? "相关卦" : "Related Hexagrams" }] : []),
  ];
  const classicalFields = [
    {
      key: "judgment" as const,
      label: isChinese ? "卦辞" : "Judgment",
      icon: BookOpen,
      field: detail?.judgment,
      sourceText: knowledge.judgment,
      localizedModern: zhContent?.practicalUnderstanding,
    },
    {
      key: "image" as const,
      label: isChinese ? "大象" : "Image",
      icon: Cloud,
      field: detail?.image,
      sourceText: knowledge.image,
      localizedModern: zhContent?.realityUnderstanding,
    },
  ];

  return (
    <article className={styles.detail} data-hexagram-detail data-seo-copy data-locale={locale} data-seo-primary={seo.primaryKeyword}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <DetailScrollFrame />
      <nav className={styles.sectionNav} aria-label={isChinese ? "本页目录" : "On this page"}>
        {sections.map((section) => <a key={section.id} href={"#" + section.id}><span>{section.number}</span>{section.label}</a>)}
      </nav>
      <div className={styles.paper}>
        <header id="basic-identity" className={styles.identity} data-basic-identity>
          <DetailHeroArtwork />
          <div className={styles.numberBadge}><span>{isChinese ? "易经第" : "Hexagram"}</span><strong>{knowledge.number}</strong></div>
          <div className={styles.identityCopy}>
            <p className={styles.pinyin} data-seo-latin-allowed={isChinese ? "pinyin" : undefined}>{isChinese ? knowledge.chineseName + " · " + knowledge.pinyin : knowledge.pinyin.charAt(0).toUpperCase() + knowledge.pinyin.slice(1)}</p>
            <h1>{isChinese || !englishH1Prefix ? seo.finalH1 : <><span className={styles.h1Prefix}>{englishH1Prefix}</span><span>{knowledge.englishName}</span></>}</h1>
            <p className={styles.heroMeaning} data-seo-early-copy={isChinese ? "true" : undefined}>
              {isChinese
                ? seo.primaryKeyword + "（" + secondary + "）是易经第" + knowledge.number + "卦。" + chineseCopy(zhContent?.coreMeaning)
                : knowledge.practicalMeaning}
            </p>
          </div>
          <section className={styles.form} aria-label={isChinese ? "卦象结构" : "Hexagram Form"}>
            <h2>{isChinese ? "卦象结构" : "Hexagram Form"}</h2>
            <div className={styles.formBody}>
              <DetailLineBars lines={staticLines} locale={locale} />
              <dl>
                <div><dt>{isChinese ? "上卦：" : "Upper Trigram:"}</dt><dd>{isChinese ? CHINESE_TRIGRAM_NAMES[knowledge.trigrams.upper] : ENGLISH_TRIGRAM_NAMES[knowledge.trigrams.upper]}</dd></div>
                <div><dt>{isChinese ? "下卦：" : "Lower Trigram:"}</dt><dd>{isChinese ? CHINESE_TRIGRAM_NAMES[knowledge.trigrams.lower] : ENGLISH_TRIGRAM_NAMES[knowledge.trigrams.lower]}</dd></div>
              </dl>
            </div>
          </section>
        </header>

        <section className={styles.section} aria-labelledby="hexagram-meaning-title">
          <DetailSectionTitle number="02" id="hexagram-meaning-title">{isChinese ? seo.primaryKeyword + "的含义" : "What This Hexagram Means"}</DetailSectionTitle>
          <div className={styles.meaningGrid}>
            {isChinese ? (
              <>
                <section><h3><Triangle aria-hidden="true" />核心主题</h3><strong>{chineseCopy(zhContent?.theme)}</strong><p>{chineseCopy(zhContent?.coreMeaning)}</p></section>
                <section><h3><Sun aria-hidden="true" />可支持的方向</h3><p>{zhContent?.supports.map((item) => chineseCopy(item)).join(" ")}</p></section>
                <section><h3><TriangleAlert aria-hidden="true" />需要警惕</h3><p>{zhContent?.watchFor.map((item) => chineseCopy(item)).join(" ")}</p></section>
                <section><h3><Lightbulb aria-hidden="true" />关键提醒</h3><p>{chineseCopy(zhContent?.practicalUnderstanding)}</p></section>
              </>
            ) : (
              <>
                {knowledge.interpretation.coreTheme || knowledge.interpretation.coreMeaning ? <section><h3><Triangle aria-hidden="true" />Core Theme</h3>{knowledge.interpretation.coreTheme ? <strong>{knowledge.interpretation.coreTheme}</strong> : null}{knowledge.interpretation.coreMeaning ? <p>{knowledge.interpretation.coreMeaning}</p> : null}</section> : null}
                {knowledge.interpretation.strength ? <section><h3><Sun aria-hidden="true" />Main Advantages</h3><p>{knowledge.interpretation.strength}</p></section> : null}
                {knowledge.interpretation.challenge ? <section><h3><TriangleAlert aria-hidden="true" />Main Challenges</h3><p>{knowledge.interpretation.challenge}</p></section> : null}
                {knowledge.interpretation.orientation ? <section><h3><Lightbulb aria-hidden="true" />Key Advice</h3><p>{knowledge.interpretation.orientation}</p></section> : null}
              </>
            )}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="hexagram-classical-title" data-seo-exclude>
          <DetailSectionTitle number="03" id="hexagram-classical-title">{isChinese ? "经典文本与现代解读" : "Classical Text & Modern Interpretation"}</DetailSectionTitle>
          {(isChinese || detail?.judgment?.rendering?.editorialAttribution) ? <p id="rendering-attribution" className={styles.renderingAttribution}>{isChinese ? "经典原文来自固定来源记录；现代解读来自简体中文本地化内容层。" : detail?.judgment?.rendering?.editorialAttribution}</p> : null}
          <div className={styles.classicalGrid}>
            {classicalFields.map(({ key, label, icon: Icon, field, sourceText, localizedModern }) => {
              const rendering = isChinese ? sourceText : field?.rendering?.editorialRendering;
              const modern = isChinese ? localizedModern : field?.modernInterpretation?.text;
              return (
                <section key={key} data-classical-field={key}>
                  <h3><Icon aria-hidden="true" />{label}</h3>
                  {rendering ? <div className={styles.classicalEntry}><span className={styles.textLabel}>{isChinese ? "经典原文" : "English Rendering / Translation"}</span><blockquote aria-describedby="rendering-attribution"><p data-classical-rendering>{rendering}</p></blockquote></div> : null}
                  {modern ? <div className={styles.classicalEntry}><span className={styles.textLabel}>{isChinese ? "现代解读" : "Modern Interpretation"}</span><p data-classical-modern>{modern}</p></div> : null}
                  <a className={styles.lineSource} href={field?.rendering?.sourceUrl ?? knowledge.source.textSourceUrl} rel="noreferrer">{isChinese ? "查看经典原文来源" : "Open the classical text source"}</a>
                </section>
              );
            })}
          </div>
          <p className={styles.attribution}><a href={knowledge.source.recordSourceUrl} rel="noreferrer">{isChinese ? "查看数据来源说明" : "Record attribution"}</a></p>
        </section>

        <section className={styles.section} aria-labelledby="hexagram-lines-title">
          <DetailSectionTitle number="04" id="hexagram-lines-title">{isChinese ? "六条爻辞与现代含义" : "The Six Lines"}</DetailSectionTitle>
          <div className={[styles.linesTable, hasEnglishLineRenderings ? styles.linesWithRendering : "", hasStageStates ? styles.linesWithStage : ""].filter(Boolean).join(" ")} role="table" aria-label={isChinese ? "六条爻辞" : "The Six Lines"}>
            <div className={styles.lineTableHead} role="row">
              <span role="columnheader">{isChinese ? "爻位" : "Line"}</span>
              {isChinese ? <span role="columnheader">经典爻辞</span> : hasEnglishLineRenderings ? <span role="columnheader">English Rendering / Translation</span> : null}
              <span role="columnheader">{isChinese ? "现代含义" : "Modern Meaning"}</span>
              {hasStageStates ? <span role="columnheader">Stage / State</span> : null}
              {!isChinese ? <span role="columnheader">Caution / Practical Understanding</span> : null}
            </div>
            {knowledge.lines.slice().reverse().map((line) => {
              const suppliedLine = detail?.lines?.find((entry) => entry.position === line.position);
              const classicalLine = knowledge.classicalLines[line.position - 1];
              return (
                <section key={line.position} id={"line-" + line.position} className={styles.lineRow} role="row">
                  <div role="rowheader" className={styles.lineIdentity}>
                    <h3>{isChinese ? seo.primaryKeyword + POSITIONS[line.position - 1] : ENGLISH_LINE_POSITIONS[line.position - 1]}</h3>
                    <span className={staticLines[line.position - 1] === 7 ? styles.yang : styles.yin} aria-label={isChinese ? (staticLines[line.position - 1] === 7 ? "阳爻" : "阴爻") : (staticLines[line.position - 1] === 7 ? "Yang" : "Yin")}><i /><i /></span>
                    <a href={"#line-" + line.position} aria-label={isChinese ? "链接到第" + line.position + "爻" : "Link to line " + line.position}>#{line.position}</a>
                  </div>
                  {isChinese ? (
                    <div role="cell">
                      <span className={styles.mobileLabel}>经典爻辞</span>
                      <p>{classicalLine.text}</p>
                      <a className={styles.lineSource} href={classicalLine.source.textSourceUrl} rel="noreferrer" aria-label={"第" + line.position + "爻经典原文来源"}>查看原文</a>
                    </div>
                  ) : hasEnglishLineRenderings ? (
                    <div role="cell"><span className={styles.mobileLabel}>English Rendering / Translation</span>{suppliedLine?.rendering?.editorialRendering ? <p data-line-rendering aria-describedby="rendering-attribution">{suppliedLine.rendering.editorialRendering}</p> : null}</div>
                  ) : null}
                  <div role="cell" className={styles.lineMeaning}>
                    <span className={styles.mobileLabel}>{isChinese ? "现代含义" : "Modern Meaning"}</span>
                    <h4>{isChinese ? "现代理解" : line.theme}</h4>
                    <p data-modern-meaning>{isChinese ? chineseCopy(zhContent?.lineNotes[line.position - 1]) : suppliedLine?.modernMeaning?.text ?? line.meaning}</p>
                  </div>
                  {hasStageStates ? <div role="cell">{suppliedLine?.stageState?.text ? <><span className={styles.mobileLabel}>Stage / State</span><p data-stage-state>{suppliedLine.stageState.text}</p></> : null}</div> : null}
                  {!isChinese ? <div role="cell"><span className={styles.mobileLabel}>Caution / Practical Understanding</span><p data-line-caution>{suppliedLine?.caution?.text ?? line.caution}</p><a className={styles.lineSource} href={suppliedLine?.rendering?.sourceUrl ?? classicalLine.source.textSourceUrl} rel="noreferrer" aria-label={"Source for classical line " + line.position}>Classical source</a></div> : null}
                </section>
              );
            })}
          </div>
        </section>

        {readingCases.length > 0 || relationships.length > 0 ? <div className={styles.optionalSections}>
          {readingCases.length > 0 ? <section className={styles.section} aria-labelledby="hexagram-cases-title" data-reading-cases>
            <DetailSectionTitle number="05" id="hexagram-cases-title">{isChinese ? "本卦特殊阅读情况" : "Hexagram-Specific Reading Cases"}</DetailSectionTitle>
            {readingCases.map((readingCase) => <div key={readingCase.kind} className={styles.readingCase}>
              <h3>{isChinese ? knowledge.useLine?.label ?? "用爻" : knowledge.useLine?.label === "用九" ? "Use of Nine" : knowledge.useLine?.label === "用六" ? "Use of Six" : "Use Line"}</h3>
              <span className={styles.textLabel}>{isChinese ? "经典原文" : "English Rendering / Translation"}</span>
              <p aria-describedby="rendering-attribution">{isChinese ? knowledge.useLine?.text : readingCase.rendering.editorialRendering}</p>
              <a className={styles.lineSource} href={isChinese ? (knowledge.useLine?.source.textSourceUrl ?? readingCase.rendering.sourceUrl) : readingCase.rendering.sourceUrl} rel="noreferrer">{isChinese ? "查看经典原文来源" : "Classical source"}</a>
            </div>)}
          </section> : null}
          {relationships.length > 0 ? <section className={[styles.section, styles.relationshipsSection].join(" ")} aria-labelledby="hexagram-relations-title" data-hexagram-relations>
            <DetailSectionTitle number="06" id="hexagram-relations-title">{isChinese ? "与其他卦的结构关系" : "Relationships with Other Hexagrams"}</DetailSectionTitle>
            <div className={styles.relationsGrid}>
              {relationships.map((relation) => {
                const related = CLASSICAL_HEXAGRAMS.find((entry) => entry.number === relation.relatedHexagram);
                if (!related) return null;
                const relationLabel = relation.relationType === "structural-complement"
                  ? (isChinese ? "结构互补" : "Structural Complement")
                  : (isChinese ? "六爻反转" : "Line Reversal");
                return <div key={relation.relationType} className={styles.relation}>
                  <DetailLineBars lines={detailLineValues(related.trigrams)} related locale={locale} />
                  <div><h3>{relationLabel}</h3><Link href={detailPath(locale, related.slug)}>{isChinese ? "第" + related.number + "卦 · " + related.chineseName : "Hexagram " + related.number + " — " + related.englishName}</Link><p>{isChinese ? (relation.relationType === "structural-complement" ? "与本卦构成结构互补关系。" : "与本卦构成六爻次序反转关系。") : relation.explanation}</p></div>
                </div>;
              })}
            </div>
          </section> : null}
        </div> : null}

        <nav className={styles.auxiliaryNav} data-auxiliary-navigation aria-label={isChinese ? "单卦导航" : "Hexagram navigation"}>
          {previous ? <Link href={detailPath(locale, previous.slug)} aria-label={isChinese ? "上一卦：第" + previous.number + "卦 " + previous.chineseName : "Previous: Hexagram " + previous.number + " " + previous.englishName}><span aria-hidden="true">← </span>{isChinese ? "上一卦" : "Previous"}</Link> : <span aria-disabled="true">{isChinese ? "上一卦" : "Previous"}</span>}
          <Link href={hubPath} data-seo-hub-link={hubPath}><span aria-hidden="true">↑ </span>{isChinese ? "返回六十四卦" : "Back to 64 Hexagrams"}</Link>
          {next ? <Link href={detailPath(locale, next.slug)} aria-label={isChinese ? "下一卦：第" + next.number + "卦 " + next.chineseName : "Next: Hexagram " + next.number + " " + next.englishName}>{isChinese ? "下一卦" : "Next"}<span aria-hidden="true"> →</span></Link> : <span aria-disabled="true">{isChinese ? "下一卦" : "Next"}</span>}
        </nav>
      </div>
    </article>
  );
}
