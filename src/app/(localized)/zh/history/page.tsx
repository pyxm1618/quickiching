import type { Metadata } from "next";
import { HistoryClient } from "@/components/public-reading/history-client";
import { isAuthCapabilityEnabled } from "@/server/auth/capability";

export const metadata: Metadata = {
  title: "本地起卦记录 | Quick I Ching",
  description: "查看、重命名和删除仅保存在当前浏览器中的 Quick I Ching 本地起卦记录。",
  robots: { index: false, follow: true },
};

export default function ChineseHistoryPage() {
  const showCloudBanner = isAuthCapabilityEnabled();
  return (
    <article>
      <header className="mx-auto max-w-4xl px-4 py-12 sm:py-16"><p className="font-mono text-[11px] tracking-[0.14em] text-[var(--bronze)]">私密 · 仅当前浏览器</p><h1 className="mt-3 font-display text-4xl font-medium tracking-tight sm:text-5xl">本地起卦记录</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-[var(--ink-2)]">无需创建账户，也可以返回当前浏览器里主动保存过的起卦结果。这些本地记录不会自动变成云端账户记录。</p></header>
      <section className="mx-auto max-w-6xl px-4 pb-16"><HistoryClient showCloudBanner={showCloudBanner} locale="zh-Hans" /></section>
    </article>
  );
}
