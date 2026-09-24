import React from "react";
import type { CommercialReadingReport } from "@/domain/generation/schemas";

export function CommercialReadingReportView({ report, locale = "en" }: { report: CommercialReadingReport; locale?: "en" | "zh-Hans" }) {
  const zh = locale === "zh-Hans";
  const label = (bilingual: string, chinese: string) => zh ? chinese : bilingual;
  return (
    <section className="mt-12 space-y-6" aria-labelledby="deep-reading-title">
      <div className="rounded-3xl border border-[var(--gold)]/30 bg-gradient-to-b from-[rgba(235,178,85,0.08)] to-transparent p-6 sm:p-10 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
          <div>
            <p className="mystic-kicker">{label("AI 深度洞察报告 · 十模块结构化解读", "智能深度洞察报告 · 十模块结构化解读")}</p>
            <h2 id="deep-reading-title" className="mt-2 font-display text-2xl font-normal text-white sm:text-3xl">
              深度义理与决策推演报告
            </h2>
          </div>
          <span className="inline-flex items-center rounded-full border border-[var(--gold)]/40 bg-[var(--gold)]/10 px-3.5 py-1 font-mono text-xs font-semibold text-[var(--gold-2)]">
            {label("Verified Commercial Report", "已验证商业报告")}
          </span>
        </div>

        {/* 1. 核心洞察摘要 */}
        <div className="mt-8 rounded-2xl border border-[var(--gold)]/25 bg-black/30 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--gold-2)]">{label("核心洞察摘要 · Core Summary", "核心洞察摘要")}</p>
          <p className="mt-3 text-base leading-8 text-[var(--ink)] sm:text-lg">
            {report.coreSummary}
          </p>
        </div>

        {/* 2 & 3. 当前阶段 & 本卦格局 */}
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--cyan)]">{label("当前所处阶段 · Current Stage", "当前所处阶段")}</p>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-2)] sm:text-base">
              {report.currentStage}
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--cyan)]">{label("本卦格局推演 · Hexagram Pattern", "本卦格局推演")}</p>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-2)] sm:text-base">
              {report.primaryHexagramPattern}
            </p>
          </div>
        </div>

        {/* 4 & 5. 变爻机制 & 可能走向 */}
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--gold-2)]">{label("变爻动向机制 · Change Mechanism", "动爻变化机制")}</p>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-2)] sm:text-base">
              {report.changeMechanism}
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--gold-2)]">{label("未来可能走向 · Possible Direction", "未来可能走向")}</p>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-2)] sm:text-base">
              {report.possibleDirection}
            </p>
          </div>
        </div>

        {/* 6 & 7. 盲区与阻碍 & 转机条件 */}
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-red-500/20 bg-red-950/10 p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-red-400">{label("盲区与潜在阻碍 · Obstacles & Blind Spots", "盲区与潜在阻碍")}</p>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-2)] sm:text-base">
              {report.obstaclesAndBlindSpots}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">{label("转机出现的关键条件 · Turning Conditions", "转机出现的关键条件")}</p>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-2)] sm:text-base">
              {report.turningConditions}
            </p>
          </div>
        </div>

        {/* 8. 行动建议 */}
        <div className="mt-6 rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold)]/[0.04] p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--gold)]">{label("针对性行动建议 · Action Direction", "针对性行动建议")}</p>
          <p className="mt-3 text-base leading-8 text-white sm:text-lg">
            {report.conditionalActionDirection}
          </p>
        </div>

        {/* 9. 不确定性边界 */}
        <div className="mt-6 rounded-2xl border border-white/[0.08] bg-black/20 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--ink-3)]">{label("不确定性与观察边界 · Uncertainty & Boundaries", "不确定性与观察边界")}</p>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">
            {report.uncertaintyAndBoundaries}
          </p>
        </div>

        {/* 10. 底线免责说明 */}
        <p className="mt-8 border-t border-white/[0.08] pt-6 text-xs leading-6 text-[var(--ink-3)]">
          {report.disclaimer}
        </p>
      </div>
    </section>
  );
}
