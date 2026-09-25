import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { CLASSICAL_HEXAGRAMS } from "@/domain/public-reading/classical";
import { zhHansHexagramContent } from "@/content/hexagrams/zh-Hans";
import { hexagramSeoFor } from "@/content/hexagrams/seo";
import { alternateLanguages, canonicalUrl } from "@/i18n/helpers";
import { zhSeoFor } from "@/content/seo/zh-pages";

const SEO = zhSeoFor("hexagrams-hub");
const CANONICAL = canonicalUrl(SEO.canonicalUrl);

export const metadata: Metadata = {
  title: { absolute: SEO.finalTitle },
  description: SEO.finalDescription,
  alternates: {
    canonical: CANONICAL,
    languages: alternateLanguages("hexagrams-hub"),
  },
  openGraph: {
    title: SEO.finalTitle,
    description: SEO.finalDescription,
    url: CANONICAL,
    type: "website",
    locale: "zh_CN",
  },
  robots: { index: true, follow: true },
};

export default function ChineseHexagramsHubPage() {
  return (
    <article className="mx-auto max-w-6xl px-4 py-12 sm:py-16" data-seo-primary={SEO.primaryKeyword}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: SEO.finalH1,
        description: SEO.finalDescription,
        url: CANONICAL,
        inLanguage: "zh-Hans",
      }) }} />
      <nav className="text-sm text-[var(--ink-3)]" aria-label="面包屑"><Link href="/zh" className="hover:text-[var(--jade)]">中文首页</Link><span className="mx-2">/</span><span>中文卦库</span></nav>
      <header className="mt-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">周易 · 简体中文导航</p>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight sm:text-5xl">{SEO.finalH1}</h1>
        <p data-seo-early-copy className="mt-5 max-w-3xl text-lg leading-8 text-[var(--ink-2)]">易经六十四卦按通行的文王卦序排列，从乾卦、坤卦一直到未济卦。这里集中提供 64 个中文卦象详情入口；每页保留有来源的卦辞、大象和六条爻辞，并补充结构说明、无动爻阅读与现实反思。</p>
      </header>

      <section className="mt-10 max-w-4xl">
        <h2 className="font-display text-2xl font-medium">如何使用易经六十四卦目录</h2>
        <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">可以按文王卦序浏览易经六十四卦，也可以从起卦结果直接进入对应本卦或之卦。每个详情页使用独立中文关键词和固定卦序，并连接前后卦与相关中文指南。</p>
      </section>

      <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CLASSICAL_HEXAGRAMS.map((hexagram) => {
          const seo = hexagramSeoFor(hexagram.number, "zh-Hans");
          const content = zhHansHexagramContent(hexagram.number);
          const fullName = seo.hexagramName.split("｜")[1] ?? seo.hexagramName;
          return (
            <li key={hexagram.number} className="rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-5">
              <p className="font-mono text-xs text-[var(--bronze)]">第 {hexagram.number} 卦 · {hexagram.symbol}</p>
              <h2 className="mt-2 font-display text-lg font-medium"><Link href={"/zh/hexagrams/" + hexagram.slug} data-seo-inbound-anchor={seo.primaryKeyword} className="hover:text-[var(--jade)]">{seo.primaryKeyword}：{fullName}（{hexagram.chineseName}）</Link></h2>
              <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{content.theme}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--ink-2)]">{content.coreMeaning.replace(/Quick ?I ?Ching|QuickIChing/giu, "本站")}</p>
              <Link href={"/zh/hexagrams/" + hexagram.slug} className="mt-4 inline-flex text-sm font-semibold text-[var(--jade)] hover:underline">查看第 {hexagram.number} 卦详情 →</Link>
            </li>
          );
        })}
      </ol>

      <div className="mt-12 rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-6">
        <h2 className="font-display text-2xl font-medium">从问题开始起卦</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-2)]">卦详情页用于理解经典实体和反思结构，不会保存或公开你的问题。要开始一条中文起卦流程，可以前往梅花易数公历时间起卦入口。</p>
        <nav className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm" aria-label="中文卦库相关入口"><Link href="/zh/methods/mei-hua-yi-shu" className="font-semibold text-[var(--jade)] hover:underline">开始中文起卦 →</Link><Link href="/zh" data-seo-home-link="/zh" className="font-semibold text-[var(--jade)] hover:underline">返回中文首页</Link></nav>
      </div>
    </article>
  );
}
