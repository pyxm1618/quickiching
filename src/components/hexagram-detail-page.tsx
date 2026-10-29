import React from "react";
import { BookOpen, Cloud, Lightbulb, Sun, TriangleAlert, Triangle } from "lucide-react";
import styles from "./hexagram-detail-page.module.css";
import Link from "next/link";
import { HexagramLines } from "@/components/hex/hexagram-lines";
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

function ChineseSceneModule({ content }: { content: ZhHansHexagramDetailContent }) {
  if (!content.sceneModule) return null;
  return (
    <section className="mystic-card mt-10 p-6" aria-labelledby="zh-scene-module">
      <p className="mystic-kicker">场景理解</p>
      <h2 id="zh-scene-module" className="mt-2 font-display text-2xl font-normal">{chineseCopy(content.sceneModule.heading)}</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">{chineseCopy(content.sceneModule.body)}</p>
    </section>
  );
}

function ChineseRealityCheckModule({ seo }: { seo: HexagramSeoEntry }) {
  const secondary = preferredSecondary(seo);
  return (
    <section className="mystic-card mt-10 p-6" aria-labelledby="zh-reality-check-title">
      <p className="mystic-kicker">现实证据复核</p>
      <h2 id="zh-reality-check-title" className="mt-2 font-display text-2xl font-normal">把象征提示转成可以检查的步骤</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">
        阅读{secondary}时，先把卦名当作整理问题的结构索引，不把它当成事件结论。作为易经第{seo.number}卦，这一页把经典文本、现代说明和现实证据分开；你可以记录已经发生的事实、尚待确认的信息、受影响的人以及需要停止的条件，再判断当前解释是否站得住。
      </p>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">
        复核第{seo.number}卦时，先列出支持行动与反对行动的证据，区分愿望、推测和可观察事实。涉及他人时，以明确沟通、自主选择和安全边界为先；若新信息改变了条件，应当及时修改判断。回到{secondary}的主题，是为了看清下一步的责任和分寸，而不是维护第一次解释。
      </p>
      <ul className="mt-5 grid gap-3 text-sm leading-7 text-[var(--ink-2)] sm:grid-cols-2">
        <li>写下一项能够在现实中核对的事实。</li>
        <li>标出仍然未知、不能由卦象代答的部分。</li>
        <li>确认行动会影响谁，以及对方是否有选择空间。</li>
        <li>预先说明何种证据会让你暂停或改变方向。</li>
      </ul>
      {seo.number === 57 ? <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">面对持续渗透的主题，还应记录时间、资源与他人反馈怎样改变判断，避免只凭第一印象推进。</p> : null}
    </section>
  );
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

function DetailLineBars({ lines, related = false }: { lines: number[]; related?: boolean }) {
  return <div className={styles.hexagramBars} role="img" aria-label={lines.slice().reverse().map((value, index) => `Line ${6 - index}: ${value === 7 ? "yang" : "yin"}`).join("; ")}>
    {lines.slice().reverse().map((value, index) => <span key={index} data-hexagram-line={related ? undefined : 6 - index} data-related-line={related ? 6 - index : undefined} className={value === 7 ? styles.yang : styles.yin}><i /><i /></span>)}
  </div>;
}

function DetailScrollFrame() {
  return <div className={styles.frame} aria-hidden="true">
    <div className={styles.leftEdge} data-scroll-side="left"><span /><span /><span /></div>
    <div className={styles.rightEdge} data-scroll-side="right"><span /><span /><span /></div>
    <div className={styles.topScroll} />
    <div className={styles.bottomScroll} />
    <div className={styles.cherryTop} />
    <div className={styles.cherryBottom} />
    <div className={styles.pine} />
  </div>;
}

export function HexagramDetailPageView({
  locale,
  knowledge,
  seo,
  content,
  previous,
  next,
}: HexagramDetailPageViewProps) {
  const isChinese = locale === "zh-Hans";
  const hubPath = isChinese ? "/zh/hexagrams" : "/hexagrams";
  const secondary = preferredSecondary(seo);
  const intro = isChinese
    ? seo.primaryKeyword + "（" + secondary + "）是易经第" + knowledge.number + "卦。本页结合卦象、卦辞、大象和六条经典爻辞，提供简体中文的结构说明与现实反思；它不是确定性预言。"
    : secondary + ", " + knowledge.englishName + ", is the entity this page examines. The primary structure, classical text, changing lines, and modern interpretation are kept together so you can reflect without treating the result as a fixed prediction.";
  const structuredData = buildStructuredData({ locale, knowledge, seo, hubPath });
  const staticLines = detailLineValues(knowledge.trigrams);
  if (!isChinese) {
    const detail = knowledge.detail;
    const hasLineRenderings = Boolean(detail?.lines?.some((line) => line.rendering.editorialRendering));
    const hasStageStates = Boolean(detail?.lines?.some((line) => line.stageState?.text));
    const readingCases = detail?.specialReadingCases?.filter((entry) => entry.rendering.editorialRendering) ?? [];
    const relationships = detail?.relationships?.filter((entry) => CLASSICAL_HEXAGRAMS.some((hexagram) => hexagram.number === entry.relatedHexagram)) ?? [];
    const sections = [
      { id: "basic-identity", number: "01", label: "Basic Identity" },
      { id: "hexagram-meaning-title", number: "02", label: "Meaning" },
      { id: "hexagram-classical-title", number: "03", label: "Classical Text" },
      { id: "hexagram-lines-title", number: "04", label: "Six Lines" },
      ...(readingCases.length > 0 ? [{ id: "hexagram-cases-title", number: "05", label: "Reading Cases" }] : []),
      ...(relationships.length > 0 ? [{ id: "hexagram-relations-title", number: "06", label: "Related Hexagrams" }] : []),
    ];
    return (
      <article className={styles.detail} data-hexagram-detail data-seo-copy data-locale={locale} data-seo-primary={seo.primaryKeyword}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
        <DetailScrollFrame />
        <nav className={styles.sectionNav} aria-label="On this page">
          {sections.map((section) => <a key={section.id} href={"#" + section.id}><span>{section.number}</span>{section.label}</a>)}
        </nav>
        <div className={styles.paper}>
          <header id="basic-identity" className={styles.identity} data-basic-identity>
            <div className={styles.numberBadge}><span>Hexagram</span><strong>{knowledge.number}</strong></div>
            <div className={styles.identityCopy}>
              <p className={styles.pinyin}>{knowledge.pinyin.charAt(0).toUpperCase() + knowledge.pinyin.slice(1)}</p>
              <h1>{knowledge.englishName}</h1>
              {knowledge.practicalMeaning ? <p className={styles.heroMeaning}>{knowledge.practicalMeaning}</p> : null}
            </div>
            <section className={styles.form} aria-label="Hexagram Form">
              <h2>Hexagram Form</h2>
              <div className={styles.formBody}>
                <DetailLineBars lines={staticLines} />
                <dl><div><dt>Upper Trigram:</dt><dd>{ENGLISH_TRIGRAM_NAMES[knowledge.trigrams.upper]}</dd></div><div><dt>Lower Trigram:</dt><dd>{ENGLISH_TRIGRAM_NAMES[knowledge.trigrams.lower]}</dd></div></dl>
              </div>
            </section>
          </header>

          <section className={styles.section} aria-labelledby="hexagram-meaning-title">
            <DetailSectionTitle number="02" id="hexagram-meaning-title">What This Hexagram Means</DetailSectionTitle>
            <div className={styles.meaningGrid}>
              {knowledge.interpretation.coreTheme || knowledge.interpretation.coreMeaning ? <section><h3><Triangle aria-hidden="true" />Core Theme</h3>{knowledge.interpretation.coreTheme ? <strong>{knowledge.interpretation.coreTheme}</strong> : null}{knowledge.interpretation.coreMeaning ? <p>{knowledge.interpretation.coreMeaning}</p> : null}</section> : null}
              {knowledge.interpretation.strength ? <section><h3><Sun aria-hidden="true" />Main Advantages</h3><p>{knowledge.interpretation.strength}</p></section> : null}
              {knowledge.interpretation.challenge ? <section><h3><TriangleAlert aria-hidden="true" />Main Challenges</h3><p>{knowledge.interpretation.challenge}</p></section> : null}
              {knowledge.interpretation.orientation ? <section><h3><Lightbulb aria-hidden="true" />Key Advice</h3><p>{knowledge.interpretation.orientation}</p></section> : null}
            </div>
          </section>

          <section className={styles.section} aria-labelledby="hexagram-classical-title" data-seo-exclude>
            <DetailSectionTitle number="03" id="hexagram-classical-title">Classical Text &amp; Modern Interpretation</DetailSectionTitle>
            {detail?.judgment?.rendering?.editorialAttribution ? <p id="english-rendering-attribution" className={styles.renderingAttribution}>{detail.judgment.rendering.editorialAttribution}</p> : null}
            <div className={styles.classicalGrid}>
              {([
                { label: "Judgment", icon: BookOpen, field: detail?.judgment },
                { label: "Image", icon: Cloud, field: detail?.image },
              ] as const).map(({ label, icon: Icon, field }) => (
                <section key={label} data-classical-field={label.toLowerCase()}>
                  <h3><Icon aria-hidden="true" />{label}</h3>
                  {field?.rendering?.editorialRendering ? <div className={styles.classicalEntry}><span className={styles.textLabel}>English Rendering / Translation</span><blockquote aria-describedby="english-rendering-attribution"><p data-classical-rendering>{field.rendering.editorialRendering}</p></blockquote></div> : null}
                  {field?.modernInterpretation?.text ? <div className={styles.classicalEntry}><span className={styles.textLabel}>Modern Interpretation</span><p data-classical-modern>{field.modernInterpretation.text}</p></div> : null}
                  <a className={styles.lineSource} href={field?.rendering?.sourceUrl ?? knowledge.source.textSourceUrl} rel="noreferrer">Open the classical text source</a>
                </section>
              ))}
            </div>
            <p className={styles.attribution}><a href={knowledge.source.recordSourceUrl} rel="noreferrer">Record attribution</a></p>
          </section>

          <section className={styles.section} aria-labelledby="hexagram-lines-title">
            <DetailSectionTitle number="04" id="hexagram-lines-title">The Six Lines</DetailSectionTitle>
            <div className={[styles.linesTable, hasLineRenderings ? styles.linesWithRendering : "", hasStageStates ? styles.linesWithStage : ""].filter(Boolean).join(" ")} role="table" aria-label="The Six Lines">
              <div className={styles.lineTableHead} role="row"><span role="columnheader">Line</span>{hasLineRenderings ? <span role="columnheader">English Rendering / Translation</span> : null}<span role="columnheader">Modern Meaning</span>{hasStageStates ? <span role="columnheader">Stage / State</span> : null}<span role="columnheader">Caution / Practical Understanding</span></div>
              {knowledge.lines.slice().reverse().map((line) => {
                const suppliedLine = detail?.lines?.find((entry) => entry.position === line.position);
                return (
                  <section key={line.position} id={"line-" + line.position} className={styles.lineRow} role="row">
                    <div role="rowheader" className={styles.lineIdentity}><h3>{ENGLISH_LINE_POSITIONS[line.position - 1]}</h3><span className={staticLines[line.position - 1] === 7 ? styles.yang : styles.yin} aria-label={staticLines[line.position - 1] === 7 ? "Yang" : "Yin"}><i /><i /></span><a href={"#line-" + line.position} aria-label={"Link to line " + line.position}>#{line.position}</a></div>
                    {hasLineRenderings ? <div role="cell"><span className={styles.mobileLabel}>English Rendering / Translation</span>{suppliedLine?.rendering?.editorialRendering ? <p data-line-rendering aria-describedby="english-rendering-attribution">{suppliedLine.rendering.editorialRendering}</p> : null}</div> : null}
                    <div role="cell" className={styles.lineMeaning}><span className={styles.mobileLabel}>Modern Meaning</span><h4>{line.theme}</h4><p data-modern-meaning>{suppliedLine?.modernMeaning?.text ?? line.meaning}</p></div>
                    {hasStageStates ? <div role="cell">{suppliedLine?.stageState?.text ? <><span className={styles.mobileLabel}>Stage / State</span><p data-stage-state>{suppliedLine.stageState.text}</p></> : null}</div> : null}
                    <div role="cell"><span className={styles.mobileLabel}>Caution / Practical Understanding</span><p data-line-caution>{suppliedLine?.caution?.text ?? line.caution}</p><a className={styles.lineSource} href={suppliedLine?.rendering?.sourceUrl ?? knowledge.classicalLines[line.position - 1].source.textSourceUrl} rel="noreferrer" aria-label={"Source for classical line " + line.position}>Classical source</a></div>
                  </section>
                );
              })}
            </div>
          </section>

          {readingCases.length > 0 || relationships.length > 0 ? <div className={styles.optionalSections}>
            {readingCases.length > 0 ? <section className={styles.section} aria-labelledby="hexagram-cases-title" data-reading-cases>
              <DetailSectionTitle number="05" id="hexagram-cases-title">Hexagram-Specific Reading Cases</DetailSectionTitle>
              {readingCases.map((readingCase) => <div key={readingCase.kind} className={styles.readingCase}>
                <h3>{knowledge.useLine?.label === "用九" ? "Use of Nine" : knowledge.useLine?.label === "用六" ? "Use of Six" : "Use Line"}</h3>
                <span className={styles.textLabel}>English Rendering / Translation</span>
                <p aria-describedby="english-rendering-attribution">{readingCase.rendering.editorialRendering}</p>
                <a className={styles.lineSource} href={readingCase.rendering.sourceUrl} rel="noreferrer">Classical source</a>
              </div>)}
            </section> : null}
            {relationships.length > 0 ? <section className={[styles.section, styles.relationshipsSection].join(" ")} aria-labelledby="hexagram-relations-title" data-hexagram-relations>
              <DetailSectionTitle number="06" id="hexagram-relations-title">Relationships with Other Hexagrams</DetailSectionTitle>
              <div className={styles.relationsGrid}>
                {relationships.map((relation) => {
                  const related = CLASSICAL_HEXAGRAMS.find((entry) => entry.number === relation.relatedHexagram);
                  if (!related) return null;
                  return <div key={relation.relationType} className={styles.relation}>
                    <DetailLineBars lines={detailLineValues(related.trigrams)} related />
                    <div><h3>{relation.relationType === "structural-complement" ? "Structural Complement" : "Line Reversal"}</h3><Link href={detailPath(locale, related.slug)}>Hexagram {related.number} — {related.englishName}</Link><p>{relation.explanation}</p></div>
                  </div>;
                })}
              </div>
            </section> : null}
          </div> : null}
          <nav className={styles.auxiliaryNav} data-auxiliary-navigation aria-label="Hexagram navigation">
            {previous ? <Link href={detailPath(locale, previous.slug)} aria-label={"Previous: Hexagram " + previous.number + " " + previous.englishName}><span aria-hidden="true">← </span>Previous</Link> : <span aria-disabled="true">Previous</span>}
            <Link href={hubPath} data-seo-hub-link={hubPath}><span aria-hidden="true">↑ </span>Back to 64 Hexagrams</Link>
            {next ? <Link href={detailPath(locale, next.slug)} aria-label={"Next: Hexagram " + next.number + " " + next.englishName}>Next<span aria-hidden="true"> →</span></Link> : <span aria-disabled="true">Next</span>}
          </nav>
        </div>
      </article>
    );
  }
  return (
    <article className="mx-auto max-w-6xl px-4 py-12 sm:py-16" data-hexagram-detail data-seo-copy data-locale={locale} data-seo-primary={seo.primaryKeyword}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <nav className="text-sm text-[var(--ink-3)]" aria-label={"面包屑"}><Link href={hubPath} className="hover:text-[var(--jade)]">{"中文卦库"}</Link><span className="mx-2">/</span><span>{seo.primaryKeyword}</span></nav>

      <header className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.1fr),minmax(17rem,.65fr)] lg:items-end">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">{"周易 · 第" + knowledge.number + "卦 · " + knowledge.symbol}</p>
          <h1 className="mt-3 font-display text-4xl font-medium tracking-tight sm:text-6xl">{seo.finalH1}</h1>
          <p className="mt-3 font-mono text-sm text-[var(--ink-3)]">
            {"下卦" + (CHINESE_TRIGRAM_NAMES[knowledge.trigrams.lower] ?? "卦") + " · 上卦" + (CHINESE_TRIGRAM_NAMES[knowledge.trigrams.upper] ?? "卦")}
          </p>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[var(--ink-2)]" data-seo-early-copy>{intro}</p>
        </div>
        <div className="mystic-card-soft p-5" data-seo-exclude>
          <HexagramLines lines={staticLines} size="lg" showLabels locale={locale} className="mb-6" />
          {(
            <>
              <p className="mystic-kicker">经典文本</p>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]"><strong className="text-[var(--gold-2)]">卦辞 · </strong>{knowledge.judgment}</p>
              <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]"><strong className="text-[var(--gold-2)]">大象 · </strong>{knowledge.image}</p>
              <p className="mt-4 border-t border-white/[0.08] pt-4 text-xs leading-6 text-[var(--ink-3)]">经典文字保留固定来源记录。<a href={knowledge.source.textSourceUrl} rel="noreferrer" className="inline-flex min-h-11 items-center text-[var(--cyan)] hover:underline">查看经典原文</a>。<a href={knowledge.source.recordSourceUrl} rel="noreferrer" className="inline-flex min-h-11 items-center text-[var(--cyan)] hover:underline">查看数据说明</a>。</p>
            </>
          )}
        </div>
      </header>

      <section className="mt-10" aria-labelledby="hexagram-meaning-title">
        <p className="mystic-kicker">{seo.meaningKeyword + "与现实理解"}</p>
        <h2 id="hexagram-meaning-title" className="mt-2 font-display text-3xl font-normal">{seo.primaryKeyword} · {"如何理解这一本卦"}</h2>
        {(
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <section className="mystic-card p-6"><h3 className="font-display text-2xl font-normal">{chineseCopy(content?.theme)}</h3><p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">{chineseCopy(content?.coreMeaning)}</p><p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">{chineseCopy(content?.practicalUnderstanding)}</p><p className="mt-4 border-t border-white/[0.08] pt-4 text-sm leading-7 text-[var(--ink-2)]">{chineseCopy(content?.realityUnderstanding)}</p></section>
            <section className="mystic-card p-6"><h3 className="font-display text-2xl font-normal">可以支持什么，需警惕什么</h3><ul className="mt-4 space-y-3 text-sm leading-7 text-[var(--ink-2)]"><li>{chineseCopy(content?.supports[0])}</li><li>{chineseCopy(content?.supports[1])}</li><li>{chineseCopy(content?.watchFor[0])}</li><li>{chineseCopy(content?.watchFor[1])}</li></ul></section>
          </div>
        )}
      </section>

      {(
        <>
          <ChineseSceneModule content={content as ZhHansHexagramDetailContent} />
          <ChineseRealityCheckModule seo={seo} />
        </>
      )}

      <section className="mt-10" aria-labelledby="hexagram-classical-lines-title" data-seo-exclude>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="mystic-kicker">{"六条经典爻辞"}</p><h2 id="hexagram-classical-lines-title" className="mt-2 font-display text-3xl font-normal">{"来自固定来源的经典文本"}</h2></div>
          <p className="max-w-xl text-sm leading-7 text-[var(--ink-2)]">{"经典文本与下面的现代结构说明分开呈现。每条原文仍链接到固定来源记录，但不重复展示修订号，以免来源标签压过正文主题。"}</p>
        </div>
        <div className="mt-6 divide-y divide-white/[0.08] rounded-2xl border border-[var(--gold)]/25 bg-[var(--gold)]/[0.04] px-5 sm:px-6">
          {knowledge.classicalLines.map((line) => (
            <div key={line.position} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div>
                <h3 className="font-display text-lg font-medium">{line.label + " · 第" + line.position + "爻"}</h3>
                {<p className="mt-2 text-sm leading-7 text-[var(--ink)]">{line.text}</p>}
              </div>
              <a href={line.source.textSourceUrl} rel="noreferrer" aria-label={"第" + line.position + "爻经典原文来源"} title={"查看经典原文来源"} className="inline-flex min-h-11 shrink-0 items-center text-xs font-semibold text-[var(--jade)] hover:underline">{"查看原文"}</a>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="hexagram-lines-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="mystic-kicker">{"六条爻的同页锚点"}</p><h2 id="hexagram-lines-title" className="mt-2 font-display text-3xl font-normal">{"逐条结构说明"}</h2></div>
          <p className="max-w-xl text-sm leading-7 text-[var(--ink-2)]">{"六条爻都保留稳定的同页深链接；它们用于阅读结构，不创建独立爻网址。若起卦时出现动爻，请把变化当作线索，用现实证据复核，不把爻辞当成确定答案。"}</p>
        </div>
        <nav className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm" aria-label={"相关阅读指南"}>{<><Link href="/zh/guides/changing-lines" className="font-semibold text-[var(--jade)] hover:underline">动爻说明</Link><Link href="/zh/guides/primary-relating-hexagrams" className="font-semibold text-[var(--jade)] hover:underline">本卦与之卦</Link><Link href="/zh/methods/mei-hua-yi-shu" className="font-semibold text-[var(--jade)] hover:underline">开始中文起卦</Link></>}</nav>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {knowledge.lines.map((line, index) => (
            <article key={line.position} id={"line-" + line.position} className="scroll-mt-28 rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-5 sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-3"><h3 className="font-display text-xl font-medium">{seo.primaryKeyword + POSITIONS[index]}</h3><a href={"#line-" + line.position} aria-label={"链接到第" + line.position + "爻"} className="font-mono text-xs text-[var(--jade)] hover:underline">#{line.position}</a></div>
              {<><p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">{chineseCopy(content?.lineNotes[index])}</p><p className="mt-4 border-t border-white/[0.08] pt-4 text-sm leading-7 text-[var(--ink-2)]"><span className="font-semibold text-[var(--gold-2)]">经典爻辞：</span>{knowledge.classicalLines[index]?.text}</p></>}
            </article>
          ))}
        </div>
      </section>

      {(
        <section className="mystic-card-soft mt-10 p-6" aria-labelledby="zh-unchanging-title">
          <p className="mystic-kicker">无动爻时如何理解</p>
          <h2 id="zh-unchanging-title" className="mt-2 font-display text-2xl font-normal">{seo.unchangingKeyword}</h2>
          <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">围绕{seo.unchangingKeyword}，{chineseCopy(content?.unchanging)}</p>
          <div className="mt-6 border-t border-white/[0.08] pt-5"><p className="mystic-kicker">带走的问题</p><ul className="mt-3 space-y-3 text-sm leading-7 text-[var(--ink-2)]">{content?.reflectionQuestions.map((question) => <li key={question} className="border-l border-[var(--gold)]/40 pl-4">{chineseCopy(question)}</li>)}</ul></div>
        </section>
      )}

      <section className="mystic-card-soft mt-10 p-6">
        <div className="grid gap-5 sm:grid-cols-2"><div><p className="mystic-kicker">{"变化"}</p><p className="mt-2 text-sm leading-7 text-[var(--ink-2)]">{"动爻提示结构变化的位置；之卦只在确有动爻时产生，仍需要回到现实信息中理解。"}</p></div><div><p className="mystic-kicker">{"稳定"}</p><p className="mt-2 text-sm leading-7 text-[var(--ink-2)]">{"本卦保留当前结构的观察重点，解释应当尊重事实、他人的选择和必要的专业意见。"}</p></div></div>
        <nav className="mt-6 flex flex-wrap gap-x-6 gap-y-3 border-t border-white/[0.08] pt-5 text-sm" aria-label={"中文卦详情导航"}>
          <Link href={hubPath} data-seo-hub-link={hubPath} className="font-semibold text-[var(--cyan)] hover:underline">{"返回中文卦库"}</Link>
          {previous ? <Link href={detailPath(locale, previous.slug)} className="font-semibold text-[var(--cyan)] hover:underline">← {"第" + previous.number + "卦 · " + previous.chineseName}</Link> : null}
          {next ? <Link href={detailPath(locale, next.slug)} className="font-semibold text-[var(--cyan)] hover:underline">{"第" + next.number + "卦 · " + next.chineseName} →</Link> : null}
          <Link href={"/zh/methods/three-coin"} className="font-semibold text-[var(--cyan)] hover:underline">{"三枚铜钱起卦"}</Link>
          <Link href={"/zh"} data-seo-home-link={"/zh"} className="font-semibold text-[var(--cyan)] hover:underline">{"返回中文入口"}</Link>
        </nav>
        <p className="mt-5 border-t border-white/[0.08] pt-5 text-sm leading-7 text-[var(--ink-2)]" data-legal-disclaimer>{"这是用于反思的经典与结构性内容，不是确定性预言，也不能替代医疗、法律、财务或安全建议。"}</p>
      </section>

    </article>
  );
}
