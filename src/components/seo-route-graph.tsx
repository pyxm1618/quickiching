"use client";

import React from "react";
import Link from "next/link";
import type { ContentLocale } from "@/i18n/config";

/**
 * Crawlable route graph.
 *
 * It is an SEO device, not a navigation capability: it is hidden, inert for
 * assistive technology and not focusable, so it adds no visible navigation
 * owner. It exists so every surface keeps the indexable destination graph in
 * its HTML even when the Surface Contract renders a shell without discovery
 * navigation — or no shell at all.
 */
export function SeoRouteGraph({ locale = "en" }: { locale?: ContentLocale }) {
  const zh = locale === "zh-Hans";
  const localize = (path: string) => zh ? `/zh${path === "/" ? "" : path}` : path;
  return (
    <nav hidden aria-hidden="true" data-scene-route-graph>
      <Link href={localize("/")} prefetch={false}>{zh ? "首页" : "Home"}</Link>
      <Link href={localize("/hexagrams")} prefetch={false}>{zh ? "六十四卦" : "64 Hexagrams"}</Link>
      <Link href={localize("/methods/three-coin")} prefetch={false}>{zh ? "三枚铜钱" : "Three Coin Method"}</Link>
      <Link href={localize("/methods/yarrow-stalks")} prefetch={false}>{zh ? "蓍草法" : "Yarrow Stalks"}</Link>
      <Link href={localize("/methods/mei-hua-yi-shu")} prefetch={false}>{zh ? "梅花易数" : "Mei Hua Yi Shu"}</Link>
      <Link href={localize("/methods/manual-cast")} prefetch={false}>{zh ? "手动起卦" : "Manual Cast"}</Link>
      <Link href={localize("/guides/how-to-ask-the-i-ching")} prefetch={false}>{zh ? "如何向易经提问" : "How to Ask the I Ching"}</Link>
      <Link href={localize("/guides/changing-lines")} prefetch={false}>{zh ? "变爻" : "Changing Lines"}</Link>
      <Link href={localize("/guides/primary-relating-hexagrams")} prefetch={false}>{zh ? "本卦与变卦" : "Primary & Relating Hexagrams"}</Link>
      <Link href={localize("/help")} prefetch={false}>{zh ? "帮助与支持" : "Help & Support"}</Link>
      <a href="mailto:support@quickiching.com">{zh ? "联系支持" : "Contact Support"}</a>
      <Link href={localize("/privacy")} prefetch={false}>{zh ? "隐私政策" : "Privacy Policy"}</Link>
      <Link href={localize("/terms")} prefetch={false}>{zh ? "服务条款" : "Terms of Service"}</Link>
      <Link href={localize("/acceptable-use")} prefetch={false}>{zh ? "可接受使用政策" : "Acceptable Use"}</Link>
    </nav>
  );
}
