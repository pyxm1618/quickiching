import React from "react";
import type { DeepReadingContextSnapshot, DeepReadingReport } from "@/domain/generation/deep-reading-contract";
import type { CommercialReadingReport } from "@/domain/generation/schemas";

function sourceName(source: string, zh: boolean): string {
  const names: Record<string, [string, string]> = {
    king_wen_judgment: ["Classical Judgment", "经典卦辞"],
    king_wen_image: ["Classical Image", "经典大象"],
    king_wen_line: ["Classical line text", "经典爻辞"],
    interpretation_theme: ["Hexagram theme", "卦象主题"],
    interpretation_meaning: ["Hexagram meaning", "卦象含义"],
    interpretation_strength: ["Strength", "有利条件"],
    interpretation_challenge: ["Challenge", "现实挑战"],
    interpretation_orientation: ["Orientation", "整体取向"],
    interpretation_structure: ["Structure", "结构解读"],
    interpretation_transition: ["Transition theme", "变化主题"],
    interpretation_stability: ["Stability theme", "稳定主题"],
    line_theme: ["Changing line theme", "动爻主题"],
    line_meaning: ["Changing line meaning", "动爻含义"],
    line_dynamic: ["Change dynamic", "变化关系"],
    line_caution: ["Line caution", "动爻提醒"],
    line_reflection: ["Line reflection", "动爻反思"],
    relating_judgment: ["Relating Judgment", "之卦卦辞"],
    relating_image: ["Relating Image", "之卦大象"],
    relating_meaning: ["Relating hexagram meaning", "之卦含义"],
  };
  const pair = names[source] ?? [source, source];
  return pair[zh ? 1 : 0];
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-black/20 p-5 sm:p-6">
      <h3 className="font-display text-xl font-normal text-[var(--gold-2)]">{title}</h3>
      <div className="mt-3 text-sm leading-7 text-[var(--ink-2)] sm:text-base sm:leading-8">{children}</div>
    </section>
  );
}

function buildBasisSummary(snapshot: DeepReadingContextSnapshot | null | undefined, zh: boolean): string {
  if (!snapshot) {
    return zh
      ? "本报告结合你起卦时保存的问题与现实背景、本次实际卦象、Quick I Ching 收录的经典文本，以及 Quick I Ching 的结构化解释材料生成。"
      : "This reading is grounded in your saved question and context, the exact cast, classical I Ching text included in Quick I Ching, and Quick I Ching's structured interpretation material.";
  }
  const p = snapshot.knowledge.primary;
  const pName = zh ? `第 ${p.number} 卦「${p.chineseName}」` : `Hexagram ${p.number} (${p.name})`;
  const lines = snapshot.facts.movingLinePositions;
  const r = snapshot.knowledge.relating;

  let castDetails = pName;
  if (lines.length === 0) {
    castDetails += zh ? "（无动爻静卦）" : " with no changing lines";
  } else {
    const lineStr = zh ? `第 ${lines.join("、")} 爻动` : `changing line${lines.length > 1 ? "s" : ""} ${lines.join(", ")}`;
    if (r) {
      const rName = zh ? `第 ${r.number} 卦「${r.chineseName}」` : `Hexagram ${r.number} (${r.name})`;
      castDetails += zh ? `，${lineStr}，向 ${rName}变化` : `, ${lineStr}, moving to ${rName}`;
    } else {
      castDetails += zh ? `，${lineStr}` : `, ${lineStr}`;
    }
  }

  return zh
    ? `本报告结合你起卦时保存的问题与现实背景、本次实际卦象（${castDetails}）、Quick I Ching 收录的经典文本，以及 Quick I Ching 的结构化解释材料生成。`
    : `This reading is grounded in your saved question and context, the exact cast (${castDetails}), classical I Ching text included in Quick I Ching, and Quick I Ching's structured interpretation material.`;
}

export function CommercialReadingReportView({
  report,
  snapshot,
  locale = "en",
}: {
  report: DeepReadingReport;
  snapshot?: DeepReadingContextSnapshot | null;
  locale?: "en" | "zh-Hans";
}) {
  const zh = locale === "zh-Hans";
  const t = (en: string, cn: string) => zh ? cn : en;
  const evidenceById = new Map(snapshot?.knowledge.evidence.map((evidence) => [evidence.id, evidence]) ?? []);
  const whySummary = buildBasisSummary(snapshot, zh);

  return (
    <section className="space-y-5" aria-labelledby="deep-reading-title" data-deep-reading-report>
      <header className="rounded-3xl border border-[var(--gold)]/35 bg-gradient-to-b from-[rgba(235,178,85,0.1)] to-transparent p-6 sm:p-9">
        <p className="mystic-kicker">{t("Personalized Deep Reading", "个性化深度解读")}</p>
        <h2 id="deep-reading-title" className="mt-2 font-display text-3xl font-normal text-white sm:text-4xl">
          {t("What this cast means for your situation", "这次卦象与你处境的关系")}
        </h2>
        {snapshot ? (
          <div className="mt-6 rounded-2xl border border-white/[0.08] bg-black/20 p-5" data-deep-reading-snapshot>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--cyan)]">{t("Question at cast", "起卦时的核心问题")}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-white">{snapshot.coreQuestionAtCast}</p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--cyan)]">{t("Situation you supplied", "你补充的现实背景")}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--ink-2)]">{snapshot.context.contextNotes}</p>
            {snapshot.context.options.length || snapshot.context.constraints.length || snapshot.context.concerns.length ? (
              <ul className="mt-3 grid gap-2 text-sm leading-6 text-[var(--ink-2)] sm:grid-cols-2">
                {snapshot.context.options.map((item) => <li key={`option:${item}`}><strong>{t("Option:", "选项：")}</strong> {item}</li>)}
                {snapshot.context.constraints.map((item) => <li key={`constraint:${item}`}><strong>{t("Constraint:", "限制：")}</strong> {item}</li>)}
                {snapshot.context.concerns.map((item) => <li key={`concern:${item}`}><strong>{t("Concern:", "顾虑：")}</strong> {item}</li>)}
              </ul>
            ) : null}
          </div>
        ) : null}
        <div className="mt-6 rounded-2xl border border-[var(--gold)]/30 bg-[rgba(235,178,85,0.06)] px-5 py-4 text-sm leading-7 text-white" data-why-this-interpretation>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--gold-2)]">
            {t("Why this interpretation", "为什么这样解读")}
          </p>
          <p className="mt-1 text-sm text-[var(--ink-2)]">{whySummary}</p>
        </div>
        <p className="mt-6 text-xs leading-6 text-[var(--ink-3)]">
          {t("This is a conditional interpretation for reflection. It does not predict a certain outcome or replace qualified professional advice.", "这是一种用于反思的条件性解读，不是确定预测，也不能替代合格专业人士的建议。")}
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <ReportSection title={t("Direct answer", "直接回应")}>{report.directAnswer}</ReportSection>
        <ReportSection title={t("How your situation maps to the cast", "你的处境如何对应卦象")}>{report.situationMapping}</ReportSection>
      </div>

      <ReportSection title={t("Key tensions", "关键张力")}>
        <ul className="list-disc space-y-2 pl-5">{report.keyTensions.map((item, index) => <li key={`${index}:${item}`}>{item}</li>)}</ul>
      </ReportSection>

      <div className="grid gap-4 md:grid-cols-2">
        <ReportSection title={t("Possible direction, depending on conditions", "取决于现实条件的可能走向")}>{report.conditionalDirection}</ReportSection>
        <ReportSection title={t("Signals to watch", "接下来可以观察的信号")}>
          <ul className="list-disc space-y-2 pl-5">{report.signalsToWatch.map((item, index) => <li key={`${index}:${item}`}>{item}</li>)}</ul>
        </ReportSection>
      </div>

      <ReportSection title={t("Practical reflection", "现实反思与下一步")}>{report.practicalReflection}</ReportSection>
      <ReportSection title={t("What is known, interpreted, and still uncertain", "已知材料、解释与未知信息")}>{report.uncertaintyAndBoundaries}</ReportSection>

      <ReportSection title={t("Interpretive evidence", "解读依据")}>
        {!snapshot ? (
          <p data-evidence-restoring>{t("Restoring the saved evidence bundle…", "正在恢复已保存的解读依据…")}</p>
        ) : (
          <ul className="space-y-4">
            {report.interpretiveBasisReferences.map(({ evidenceId }) => {
              const evidence = evidenceById.get(evidenceId);
              if (!evidence) return <li key={evidenceId} className="font-mono text-xs text-[var(--danger)]">{t("Unresolved evidence reference:", "无法解析的依据编号：")} {evidenceId}</li>;
              const hexagramName = evidence.hexagramNumber === snapshot.knowledge.primary.number
                ? snapshot.knowledge.primary.name
                : snapshot.knowledge.relating?.name;
              return (
                <li key={evidenceId} className="border-l-2 border-[var(--gold)]/45 pl-4" data-evidence-id={evidenceId}>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--cyan)]">
                    {hexagramName ? `${t("Hexagram", "卦")} ${evidence.hexagramNumber} · ${hexagramName}` : `${t("Hexagram", "卦")} ${evidence.hexagramNumber}`}
                    {evidence.linePosition ? ` · ${t("Line", "第")} ${evidence.linePosition}${zh ? "爻" : ""}` : ""}
                    {` · ${sourceName(evidence.source, zh)}`}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-[var(--ink-2)]">{evidence.content}</p>
                </li>
              );
            })}
          </ul>
        )}
      </ReportSection>

      <p className="px-2 text-xs leading-6 text-[var(--ink-3)]">{report.disclaimer}</p>
    </section>
  );
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
