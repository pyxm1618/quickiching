import React from "react";
import Link from "next/link";
import type { ContentLocale } from "@/i18n/config";
import type { ClassicalHexagram } from "@/domain/public-reading/classical";
import type { PublicHexagramKnowledge } from "@/domain/public-reading/knowledge";
import type { HexagramSeoEntry } from "@/content/hexagrams/seo";
import type { ZhHansHexagramDetailContent } from "@/content/hexagrams/types";
import { absoluteUrl } from "@/lib/seo";

export type HexagramDetailPageViewProps = {
  locale: ContentLocale;
  knowledge: PublicHexagramKnowledge;
  seo: HexagramSeoEntry;
  content?: ZhHansHexagramDetailContent;
  previous: ClassicalHexagram | null;
  next: ClassicalHexagram | null;
};

const POSITIONS = ["初爻", "二爻", "三爻", "四爻", "五爻", "上爻"] as const;

function detailPath(locale: ContentLocale, slug: string): string {
  return locale === "zh-Hans" ? "/zh/hexagrams/" + slug : "/hexagrams/" + slug;
}

function fullChineseName(seo: HexagramSeoEntry): string {
  return seo.hexagramName.split("｜")[1] ?? seo.hexagramName;
}

function EnglishSpecialModule({ number, knowledge }: { number: number; knowledge: PublicHexagramKnowledge }) {
  if (number === 23) {
    return (
      <section className="mystic-card mt-10 p-6" data-special-serp-module="hexagram-23" aria-labelledby="special-serp-module">
        <p className="mystic-kicker">Bo · Splitting Apart</p>
        <h2 id="special-serp-module" className="mt-2 font-display text-2xl font-normal">When support is eroding</h2>
        <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Bo, often rendered as Splitting Apart, is useful for examining what is losing support and what still deserves protection. It does not make decline a fate; it asks you to preserve the essential, reduce avoidable load, and look for a sounder base before expanding.</p>
      </section>
    );
  }
  if (number === 52) {
    return (
      <section className="mystic-card mt-10 p-6" data-special-serp-module="hexagram-52" aria-labelledby="special-serp-module">
        <p className="mystic-kicker">Purposeful stillness</p>
        <h2 id="special-serp-module" className="mt-2 font-display text-2xl font-normal">Line 3 · purposeful stillness in practice</h2>
        <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Line 3 is where inner pressure and outward movement meet. For Keeping Still Mountain, pause long enough to notice what your body, schedule, and commitments are carrying; a useful stillness can interrupt an automatic reaction without turning away from a responsibility that still needs a clear next step.</p>
        <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">{knowledge.lines[2]?.meaning}</p>
      </section>
    );
  }
  if (number === 54) {
    return (
      <section className="mystic-card mt-10 p-6" data-special-serp-module="hexagram-54" aria-labelledby="special-serp-module">
        <p className="mystic-kicker">Relationships and romance</p>
        <h2 id="special-serp-module" className="mt-2 font-display text-2xl font-normal">Position, reciprocity, consent, and dignity</h2>
        <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">The Marrying Maiden can prompt a careful look at unequal positions, role expectations, and whether a relationship gives both people room to choose. In romance, attraction or a formal label is not proof of a durable outcome; watch for reciprocity, clear consent, dignity, and the freedom to say no.</p>
        <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Use the image and line texts as reflective material, then compare them with the actual pattern of communication and care in the relationship.</p>
      </section>
    );
  }
  if (number === 61) {
    return (
      <section className="mystic-card mt-10 p-6" data-special-serp-module="hexagram-61" aria-labelledby="special-serp-module">
        <p className="mystic-kicker">Evidence-backed sincerity</p>
        <h2 id="special-serp-module" className="mt-2 font-display text-2xl font-normal">Line 5 · trust that can be checked</h2>
        <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Line 5 brings Inner Truth into a visible position of responsibility. Trust is stronger when words, repeated actions, and the other person’s freely given response agree; sincerity is not a demand that someone accept your story without evidence.</p>
        <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">{knowledge.lines[4]?.meaning}</p>
      </section>
    );
  }
  if (number === 64) {
    return (
      <section className="mystic-card mt-10 p-6" data-special-serp-module="hexagram-64" aria-labelledby="special-serp-module">
        <p className="mystic-kicker">One unfinished entity</p>
        <h2 id="special-serp-module" className="mt-2 font-display text-2xl font-normal">Before Completion as a singular structure</h2>
        <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">This page addresses Before Completion itself: an unfinished transition that benefits from careful sequencing, attention to detail, and a final check before the next crossing. Keep the entity in view rather than turning it into a broad index or a promise about how a situation must end.</p>
      </section>
    );
  }
  return null;
}

function ChineseSceneModule({ content }: { content: ZhHansHexagramDetailContent }) {
  if (!content.sceneModule) return null;
  return (
    <section className="mystic-card mt-10 p-6" aria-labelledby="zh-scene-module">
      <p className="mystic-kicker">场景理解</p>
      <h2 id="zh-scene-module" className="mt-2 font-display text-2xl font-normal">{content.sceneModule.heading}</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">{content.sceneModule.body}</p>
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
  const fullName = fullChineseName(seo);
  const intro = isChinese
    ? seo.primaryKeyword + "（" + fullName + "）是易经第" + knowledge.number + "卦。本页结合卦象、卦辞、大象和六条经典爻辞，提供简体中文的结构说明与现实反思；它不是确定性预言。"
    : "Hexagram " + knowledge.number + ", " + knowledge.englishName + ", is the entity this page examines. The primary structure, classical text, changing lines, and modern interpretation are kept together so you can reflect without treating the result as a fixed prediction.";
  const structuredData = buildStructuredData({ locale, knowledge, seo, hubPath });
  const linkLabel = isChinese
    ? seo.primaryKeyword + "：" + fullName + "（第" + knowledge.number + "卦）"
    : "Hexagram " + knowledge.number + ": " + knowledge.englishName;

  return (
    <article className="mx-auto max-w-6xl px-4 py-12 sm:py-16" data-hexagram-detail data-locale={locale} data-seo-primary={seo.primaryKeyword}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <nav className="text-sm text-[var(--ink-3)]" aria-label={isChinese ? "面包屑" : "Breadcrumb"}><Link href={hubPath} className="hover:text-[var(--jade)]">{isChinese ? "中文卦库" : "Hexagram index"}</Link><span className="mx-2">/</span><span>{seo.primaryKeyword}</span></nav>

      <header className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.1fr),minmax(17rem,.65fr)] lg:items-end">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">{isChinese ? "周易 · 第" + knowledge.number + "卦 · " + knowledge.symbol : "King Wen " + knowledge.number + " · " + knowledge.symbol}</p>
          <h1 className="mt-3 font-display text-4xl font-medium tracking-tight sm:text-6xl">{seo.finalH1}</h1>
          <p className="mt-3 font-mono text-sm text-[var(--ink-3)]">{knowledge.pinyin} · {isChinese ? "下卦" : "lower"} {knowledge.trigrams.lower} · {isChinese ? "上卦" : "upper"} {knowledge.trigrams.upper}</p>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[var(--ink-2)]" data-seo-early-copy>{intro}</p>
        </div>
        <div className="mystic-card-soft p-5">
          <p className="mystic-kicker">{isChinese ? "经典文本" : "Classical text"}</p>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]"><strong className="text-[var(--gold-2)]">{isChinese ? "卦辞 · " : "Judgment · "}</strong>{knowledge.judgment}</p>
          <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]"><strong className="text-[var(--gold-2)]">{isChinese ? "大象 · " : "Image · "}</strong>{knowledge.image}</p>
          <p className="mt-4 border-t border-white/[0.08] pt-4 text-xs leading-6 text-[var(--ink-3)]">{isChinese ? "经典文字来源：" : "Source: "}<a href={knowledge.source.textSourceUrl} rel="noreferrer" className="text-[var(--cyan)] hover:underline">周易 · Wikisource</a>。{knowledge.source.textStatus} <a href={knowledge.source.recordSourceUrl} rel="noreferrer" className="text-[var(--cyan)] hover:underline">{isChinese ? "数据记录" : "Record attribution"}</a>。</p>
        </div>
      </header>

      <section className="mt-10" aria-labelledby="hexagram-meaning-title">
        <p className="mystic-kicker">{isChinese ? "核心含义与现实理解" : "Meaning and practical reading"}</p>
        <h2 id="hexagram-meaning-title" className="mt-2 font-display text-3xl font-normal">{seo.primaryKeyword} · {isChinese ? "如何理解这一本卦" : "what this structure emphasizes"}</h2>
        {isChinese ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <section className="mystic-card p-6"><h3 className="font-display text-2xl font-normal">{content?.theme}</h3><p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">{content?.coreMeaning}</p><p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">{content?.practicalUnderstanding}</p><p className="mt-4 border-t border-white/[0.08] pt-4 text-sm leading-7 text-[var(--ink-2)]">{content?.realityUnderstanding}</p></section>
            <section className="mystic-card p-6"><h3 className="font-display text-2xl font-normal">可以支持什么，需警惕什么</h3><ul className="mt-4 space-y-3 text-sm leading-7 text-[var(--ink-2)]"><li>{content?.supports[0]}</li><li>{content?.supports[1]}</li><li>{content?.watchFor[0]}</li><li>{content?.watchFor[1]}</li></ul></section>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <section className="mystic-card p-6"><h3 className="font-display text-2xl font-normal">What this structure emphasizes</h3><dl className="mt-5 space-y-4 text-sm leading-7 text-[var(--ink-2)]"><div><dt className="font-semibold text-[var(--gold-2)]">Strength</dt><dd>{knowledge.interpretation.strength}</dd></div><div><dt className="font-semibold text-[var(--gold-2)]">Challenge</dt><dd>{knowledge.interpretation.challenge}</dd></div><div><dt className="font-semibold text-[var(--gold-2)]">Practical meaning</dt><dd>{knowledge.practicalMeaning}</dd></div><div><dt className="font-semibold text-[var(--gold-2)]">Structure</dt><dd>{knowledge.interpretation.structureInterpretation}</dd></div></dl></section>
            <section className="mystic-card p-6"><p className="mystic-kicker">Practical reflection</p><h3 className="mt-2 font-display text-2xl font-normal">Questions to carry</h3><ul className="mt-5 space-y-4 text-sm leading-7 text-[var(--ink-2)]">{knowledge.interpretation.reflectionQuestions.map((question) => <li key={question} className="border-l border-[var(--gold)]/40 pl-4">{question}</li>)}</ul><div className="mt-6 border-t border-white/[0.08] pt-5"><p className="mystic-kicker">Watch for</p><ul className="mt-3 space-y-2 text-sm leading-7 text-[var(--ink-2)]">{knowledge.interpretation.watchFor.map((item) => <li key={item}>· {item}</li>)}</ul></div></section>
          </div>
        )}
      </section>

      {isChinese ? <ChineseSceneModule content={content as ZhHansHexagramDetailContent} /> : <EnglishSpecialModule number={knowledge.number} knowledge={knowledge} />}

      <section className="mt-10" aria-labelledby="hexagram-classical-lines-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="mystic-kicker">{isChinese ? "卦辞、大象与六条经典爻辞" : "Classical line text"}</p><h2 id="hexagram-classical-lines-title" className="mt-2 font-display text-3xl font-normal">{isChinese ? "来自固定来源的经典文本" : "Six lines from the fixed source"}</h2></div>
          <p className="max-w-xl text-sm leading-7 text-[var(--ink-2)]">{isChinese ? "经典文本与下面的现代结构说明分开呈现。来源记录保留固定修订版，避免把产品解释冒充成古典文本的唯一今译。" : "These are the classical line texts. The product explanations below are separate authored content and are not presented as a modern translation."}</p>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {knowledge.classicalLines.map((line) => (
            <article key={line.position} className="rounded-2xl border border-[var(--gold)]/25 bg-[var(--gold)]/[0.04] p-5 sm:p-6">
              <h3 className="font-display text-xl font-medium">{isChinese ? line.label + " · 第" + line.position + "爻" : line.label + " · Line " + line.position}</h3>
              <p className="mt-3 text-base leading-7 text-[var(--ink)]">{line.text}</p>
              <a href={line.source.textSourceUrl} rel="noreferrer" className="mt-3 inline-flex text-xs font-semibold text-[var(--jade)] hover:underline">{isChinese ? "Wikisource 固定修订版 · oldid " : "Wikisource fixed revision · oldid "}{line.source.textSourceRevision}</a>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="hexagram-lines-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="mystic-kicker">{isChinese ? "六条爻的同页锚点" : "Six changing-line anchors"}</p><h2 id="hexagram-lines-title" className="mt-2 font-display text-3xl font-normal">{isChinese ? "逐条结构说明" : "Line-by-line interpretation"}</h2></div>
          <p className="max-w-xl text-sm leading-7 text-[var(--ink-2)]">{isChinese ? "六条爻保留在本页的 #line-1 到 #line-6 锚点中；它们用于阅读结构，不创建独立爻 URL。若起卦时出现动爻，请把变化当作线索，用现实证据复核，不把爻辞当成确定答案。" : "These six records are authored static content for this hexagram. Reading links target stable same-page anchors; no separate line pages are created."}</p>
        </div>
        <nav className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm" aria-label={isChinese ? "相关中文与英文指南" : "Reading structure guides"}>{isChinese ? <><Link href="/guides/changing-lines" className="font-semibold text-[var(--jade)] hover:underline">动爻说明（English）</Link><Link href="/guides/primary-relating-hexagrams" className="font-semibold text-[var(--jade)] hover:underline">本卦与之卦（English）</Link><Link href="/zh/methods/mei-hua-yi-shu" className="font-semibold text-[var(--jade)] hover:underline">开始中文起卦</Link></> : <><Link href="/guides/changing-lines" className="font-semibold text-[var(--jade)] hover:underline">How changing lines work</Link><Link href="/guides/primary-relating-hexagrams" className="font-semibold text-[var(--jade)] hover:underline">Primary &amp; relating hexagrams</Link><Link href="/guides/how-to-ask-the-i-ching" className="font-semibold text-[var(--jade)] hover:underline">How to ask the I Ching</Link></>}</nav>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {knowledge.lines.map((line, index) => (
            <article key={line.position} id={"line-" + line.position} className="scroll-mt-28 rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-5 sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-3"><h3 className="font-display text-xl font-medium">{isChinese ? POSITIONS[index] + " · " + line.position + "爻" : "Line " + line.position + " · " + line.theme}</h3><a href={"#line-" + line.position} className="font-mono text-xs text-[var(--jade)] hover:underline">#line-{line.position}</a></div>
              {isChinese ? <><p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">{content?.lineNotes[index]}</p><p className="mt-4 border-t border-white/[0.08] pt-4 text-sm leading-7 text-[var(--ink-2)]"><span className="font-semibold text-[var(--gold-2)]">经典爻辞：</span>{knowledge.classicalLines[index]?.text}</p></> : <><p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">{line.meaning}</p><dl className="mt-5 grid gap-4 text-sm leading-7 text-[var(--ink-2)] sm:grid-cols-2"><div><dt className="font-semibold text-[var(--gold-2)]">Change dynamic</dt><dd>{line.changeDynamic}</dd></div><div><dt className="font-semibold text-[var(--gold-2)]">Caution</dt><dd>{line.caution}</dd></div><div><dt className="font-semibold text-[var(--gold-2)]">Reflection</dt><dd>{line.reflection}</dd></div><div><dt className="font-semibold text-[var(--gold-2)]">Synthesis</dt><dd>{line.synthesisPhrase}</dd></div></dl></>}
            </article>
          ))}
        </div>
      </section>

      {isChinese ? (
        <section className="mystic-card-soft mt-10 p-6" aria-labelledby="zh-unchanging-title">
          <p className="mystic-kicker">无动爻时如何理解</p>
          <h2 id="zh-unchanging-title" className="mt-2 font-display text-2xl font-normal">{seo.primaryKeyword}没有动爻</h2>
          <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">{content?.unchanging}</p>
          <div className="mt-6 border-t border-white/[0.08] pt-5"><p className="mystic-kicker">带走的问题</p><ul className="mt-3 space-y-3 text-sm leading-7 text-[var(--ink-2)]">{content?.reflectionQuestions.map((question) => <li key={question} className="border-l border-[var(--gold)]/40 pl-4">{question}</li>)}</ul></div>
        </section>
      ) : (
        <section className="mystic-card-soft mt-10 p-6" aria-labelledby="unchanging-title">
          <p className="mystic-kicker">Unchanging reading</p>
          <h2 id="unchanging-title" className="mt-2 font-display text-2xl font-normal">{seo.primaryKeyword} without changing lines</h2>
          <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">When no lines move, the primary hexagram remains the stable structure for reflection. Read its Judgment, Image, and six lines as a whole, then ask which part of the situation is actually observable before choosing a next step. This is an interpretive frame, not a guarantee about an event.</p>
          <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">{knowledge.interpretation.stabilityTheme}</p>
        </section>
      )}

      <section className="mystic-card-soft mt-10 p-6">
        <div className="grid gap-5 sm:grid-cols-2"><div><p className="mystic-kicker">{isChinese ? "变化" : "Transition"}</p><p className="mt-2 text-sm leading-7 text-[var(--ink-2)]">{isChinese ? "动爻提示结构变化的位置；之卦只在确有动爻时产生，仍需要回到现实信息中理解。" : knowledge.interpretation.transitionTheme}</p></div><div><p className="mystic-kicker">{isChinese ? "稳定" : "Stability"}</p><p className="mt-2 text-sm leading-7 text-[var(--ink-2)]">{isChinese ? "本卦保留当前结构的观察重点，解释应当尊重事实、他人的选择和必要的专业意见。" : knowledge.interpretation.stabilityTheme}</p></div></div>
        <nav className="mt-6 flex flex-wrap gap-x-6 gap-y-3 border-t border-white/[0.08] pt-5 text-sm" aria-label={isChinese ? "中文卦详情导航" : "Hexagram detail navigation"}>
          <Link href={hubPath} className="font-semibold text-[var(--cyan)] hover:underline">{isChinese ? "返回中文卦库" : "Back to the hexagram index"}</Link>
          {previous ? <Link href={detailPath(locale, previous.slug)} className="font-semibold text-[var(--cyan)] hover:underline">← {isChinese ? "第" + previous.number + "卦 · " + previous.chineseName : previous.number + " · " + previous.englishName}</Link> : null}
          {next ? <Link href={detailPath(locale, next.slug)} className="font-semibold text-[var(--cyan)] hover:underline">{isChinese ? "第" + next.number + "卦 · " + next.chineseName : next.number + " · " + next.englishName} →</Link> : null}
          <Link href={isChinese ? "/zh/methods/mei-hua-yi-shu" : "/methods/manual-cast"} className="font-semibold text-[var(--cyan)] hover:underline">{isChinese ? "开始中文起卦" : "Try Manual Cast"}</Link>
          <Link href={isChinese ? "/zh" : "/"} className="font-semibold text-[var(--cyan)] hover:underline">{isChinese ? "返回中文入口" : "Start a reading"}</Link>
        </nav>
        <p className="mt-5 border-t border-white/[0.08] pt-5 text-sm leading-7 text-[var(--ink-2)]" data-legal-disclaimer>{isChinese ? "这是用于反思的经典与结构性内容，不是确定性预言，也不能替代医疗、法律、财务或安全建议。" : "This page is a reflective interpretation of a classical structure. It is not deterministic prediction and does not replace medical, legal, financial, or safety advice."}</p>
      </section>

      <div className="mt-6 text-sm"><Link href={hubPath} className="font-semibold text-[var(--jade)] hover:underline">{linkLabel}</Link></div>
    </article>
  );
}
