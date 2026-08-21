import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { CLASSICAL_HEXAGRAMS } from "@/domain/public-reading/classical";
import { zhHansHexagramContent } from "@/content/hexagrams/zh-Hans";
import { hexagramSeoFor } from "@/content/hexagrams/seo";
import { canonicalUrl } from "@/i18n/helpers";

const CANONICAL = canonicalUrl("/zh/hexagrams");

export const metadata: Metadata = {
  title: { absolute: "简体中文易经卦库｜Quick I Ching" },
  description: "简体中文 64 卦详情导航，查看每一卦的经典文本、结构说明与现实反思入口。本 Hub 的独立关键词研究状态为 PENDING_RESEARCH。",
  alternates: { canonical: CANONICAL },
  openGraph: {
    title: "简体中文易经卦库｜Quick I Ching",
    description: "简体中文 64 卦详情导航与经典文本入口。",
    url: CANONICAL,
    type: "website",
    locale: "zh_CN",
  },
  robots: { index: true, follow: true },
};

export default function ChineseHexagramsHubPage() {
  return (
    <article className="mx-auto max-w-6xl px-4 py-12 sm:py-16" data-tdh-status="PENDING_RESEARCH">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "简体中文易经卦库｜Quick I Ching",
        description: "简体中文 64 卦详情导航与经典文本入口。",
        url: CANONICAL,
        inLanguage: "zh-Hans",
      }) }} />
      <nav className="text-sm text-[var(--ink-3)]" aria-label="面包屑"><Link href="/zh" className="hover:text-[var(--jade)]">中文首页</Link><span className="mx-2">/</span><span>中文卦库</span></nav>
      <header className="mt-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">周易 · 简体中文导航</p>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight sm:text-5xl">简体中文易经卦库</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[var(--ink-2)]">这里按通行卦序列出六十四个中文卦详情入口。每个详情页保留有来源的卦辞、大象和六条爻辞，并提供独立的结构说明、无动爻阅读与现实反思问题。</p>
      </header>

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
              <p className="mt-2 text-sm leading-6 text-[var(--ink-2)]">{content.coreMeaning.replace(/QuickIChing/gu, "本站")}</p>
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
