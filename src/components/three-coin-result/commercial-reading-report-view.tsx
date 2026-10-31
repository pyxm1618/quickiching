import React from "react";
import type { DeepReadingContextSnapshot, DeepReadingReport } from "@/domain/generation/deep-reading-contract";
import { legacyDeepReadingReportSchema } from "@/domain/generation/deep-reading-contract";
import type { z } from "zod";
import type { CommercialReadingReport } from "@/domain/generation/schemas";

type HistoricalReport = z.infer<typeof legacyDeepReadingReportSchema>;
function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-white/[0.08] p-5"><h3 className="font-display text-xl">{title}</h3><div className="mt-3 whitespace-pre-wrap text-sm leading-7">{children}</div></section>;
}

export function CommercialReadingReportView({report, snapshot, locale = "en"}: {
  report: DeepReadingReport | HistoricalReport;
  snapshot?: DeepReadingContextSnapshot | null;
  locale?: "en" | "zh-Hans";
}) {
  const zh = locale === "zh-Hans";
  const t = (en: string, cn: string) => zh ? cn : en;
  const historical = report.schemaVersion === "deep-reading-v2";
  const evidenceById = new Map(snapshot?.knowledge.evidence.map(item => [item.id, item]) ?? []);
  // This adapter reads saved v2 reports only. The provider accepts v3 exclusively.
  const why = historical ? report.situationMapping : report.whyThisReading;
  const matters = historical ? report.keyTensions : report.whatMattersMost;
  const next = historical ? [...report.signalsToWatch, report.practicalReflection] : report.whatToDoNext;
  return <section className="space-y-5" data-deep-reading-report data-legacy-report={historical || undefined}>
    {historical ? <p>{t("Previously saved report · read only", "此前保存的报告 · 只读")}</p> : null}
    <p>{t("Based on your question and this cast.", "基于你的问题与本次卦象。")}</p>
    <ReportSection title={t("Direct Answer", "直接回应")}>{report.directAnswer}</ReportSection>
    <ReportSection title={t("Why", "为什么")}>{why}{historical ? <p>{report.conditionalDirection}</p> : null}</ReportSection>
    <ReportSection title={t("What Matters Most", "最值得关注的事")}><ul>{matters.map((item,index) => <li key={index}>{item}</li>)}</ul></ReportSection>
    <ReportSection title={t("What To Do Next", "接下来怎么做")}><ul>{next.map((item,index) => <li key={index}>{item}</li>)}</ul></ReportSection>
    <details><summary>{t("Uncertainty and boundaries", "不确定性与边界")}</summary><p>{report.uncertaintyAndBoundaries}</p></details>
    <details><summary>{t("Interpretive evidence", "解读依据")}</summary>
      {!snapshot ? <p data-evidence-restoring>{t("The saved evidence bundle is unavailable.", "已保存的解读依据暂时不可用。")}</p> : <ul>{report.interpretiveBasisReferences.map(({evidenceId}) => {
        const evidence = evidenceById.get(evidenceId);
        return <li key={evidenceId} data-evidence-id={evidenceId}>{evidence ? <><strong>{t("Hexagram", "卦")} {evidence.hexagramNumber}{evidence.linePosition ? ` · ${t("Line", "爻")} ${evidence.linePosition}` : ""}</strong><p>{evidence.content}</p></> : <p>{t("Unresolved evidence reference:", "无法解析的依据编号：")} {evidenceId}</p>}</li>;
      })}</ul>}
    </details>
    <p className="text-xs">{report.disclaimer}</p>
  </section>;
}

export function LegacyCommercialReadingReportView({ report, locale = "en" }: {
  report: CommercialReadingReport;
  locale?: "en" | "zh-Hans";
}) {
  const zh = locale === "zh-Hans";
  const t = (en: string, cn: string) => zh ? cn : en;
  const sections: Array<[string, string]> = [
    [t("Summary", "核心摘要"), report.coreSummary],
    [t("Current stage", "当前阶段"), report.currentStage],
    [t("Primary hexagram pattern", "本卦格局"), report.primaryHexagramPattern],
    [t("Change mechanism", "变化机制"), report.changeMechanism],
    [t("Possible direction", "可能走向"), report.possibleDirection],
    [t("Obstacles and blind spots", "阻碍与盲点"), report.obstaclesAndBlindSpots],
    [t("Turning conditions", "转机条件"), report.turningConditions],
    [t("Conditional action direction", "条件性行动方向"), report.conditionalActionDirection],
    [t("Uncertainty and boundaries", "不确定性与边界"), report.uncertaintyAndBoundaries],
  ];

  return (
    <section className="space-y-5" aria-labelledby="deep-reading-title" data-deep-reading-report data-legacy-report>
      <header className="rounded-3xl border border-white/[0.08] bg-black/15 p-6 sm:p-8">
        <p className="mystic-kicker">{t("Previously saved report", "此前保存的解读")}</p>
        <h2 id="deep-reading-title" className="mt-2 font-display text-2xl font-normal text-white sm:text-3xl">
          {t("Legacy report format", "旧版报告格式")}
        </h2>
        <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">
          {t("This report is preserved for your records. It predates the current context snapshot and evidence citation format, so those source details are unavailable.", "这份报告已为你保留。它生成于当前背景快照与依据引用格式启用之前，因此无法恢复相应来源细节。")}
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {sections.map(([title, content]) => <ReportSection key={title} title={title}>{content}</ReportSection>)}
      </div>
      <p className="px-2 text-xs leading-6 text-[var(--ink-3)]">{report.disclaimer}</p>
    </section>
  );
}
