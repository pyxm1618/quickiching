"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HexagramLines } from "@/components/hex/hexagram-lines";
import { EN_UI_DICTIONARY } from "@/i18n/dictionaries/en";
import type { UiDictionary } from "@/i18n/dictionaries/types";
import type { LocalizedReadingContent } from "@/content/mei-hua-yi-shu/types";
import { useRouter } from "next/navigation";
import { completeReadingHandoff, readingHandoffFailureCopy } from "@/lib/reading-handoff";
import { useQuestionFirstContext } from "@/components/public-reading/question-first";
import { generateYarrowChange, type YarrowChange, type YarrowLineResult } from "@/domain/casting/yarrow/algorithm";
import type { LineValue } from "@/domain/casting/types";
import { buildPublicReading } from "@/domain/public-reading/reading";
import type { PublicReading } from "@/domain/public-reading/types";
import { browserRandomInt } from "@/lib/browser-random";
import { clearPublicReadingSession, readPublicReadingSession, restartPublicReadingSession, writePublicReadingSession } from "@/lib/public-reading-session";
import { YARROW_SESSION_STORAGE_KEY } from "@/lib/method-session-retirement";
import {
  NO_READING_RESUME,
  decideReadingResume,
  resumeProgressLabel,
  type ReadingResumeState,
} from "@/lib/reading-resume";

const STORAGE_KEY = YARROW_SESSION_STORAGE_KEY;
type YarrowSessionData = { changes: YarrowChange[] };

function isStoredChange(value: unknown): value is YarrowChange {
  if (!value || typeof value !== "object") return false;
  const change = value as Partial<YarrowChange>;
  return Number.isInteger(change.lineIndex) && Number.isInteger(change.changeIndex) && Number.isInteger(change.startingStalks) && Number.isInteger(change.endingStalks);
}

function parseStoredChanges(value: unknown): YarrowChange[] | null {
  const parsed = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { changes?: unknown }).changes)
      ? (value as { changes: unknown[] }).changes
      : null;
  if (!parsed || parsed.length > 18 || !parsed.every(isStoredChange)) return null;
  for (let index = 0; index < parsed.length; index += 1) {
    if (parsed[index].lineIndex !== Math.floor(index / 3) || parsed[index].changeIndex !== index % 3) return null;
  }
  return parsed;
}

function readYarrowSession() {
  try {
    return readPublicReadingSession(STORAGE_KEY, (value): YarrowSessionData | null => {
      const changes = parseStoredChanges(value);
      return changes ? { changes } : null;
    });
  } catch {
    return null;
  }
}

function completedLineValues(changes: YarrowChange[]): LineValue[] {
  const values: LineValue[] = [];
  for (let index = 2; index < changes.length; index += 3) {
    const value = changes[index].endingStalks / 4;
    if (![6, 7, 8, 9].includes(value)) throw new Error("YARROW_INVALID_STORED_LINE");
    values.push(value as LineValue);
  }
  return values;
}

function yarrowLinesFromChanges(changes: YarrowChange[]): YarrowLineResult[] {
  return Array.from({ length: Math.floor(changes.length / 3) }, (_, index) => {
    const lineChanges = changes.slice(index * 3, index * 3 + 3);
    const finalChange = lineChanges[2];
    if (!finalChange) throw new Error("YARROW_INCOMPLETE_LINE");
    return {
      lineIndex: index as 0 | 1 | 2 | 3 | 4 | 5,
      lineValue: (finalChange.endingStalks / 4) as LineValue,
      changes: lineChanges,
      algorithmVersion: finalChange.algorithmVersion,
    };
  });
}

function sealedReadingFromSession(
  session: { id: string; createdAt: string; question?: string; coreQuestionAtCast?: string } | null,
  changes: YarrowChange[],
): PublicReading | null {
  if (!session || changes.length !== 18) return null;
  try {
    return buildPublicReading({
      id: session.id,
      createdAt: session.createdAt,
      method: "yarrow-stalks",
      question: session.coreQuestionAtCast ?? session.question,
      lineValuesBottomUp: completedLineValues(changes),
      evidence: { kind: "yarrow-stalks", lines: yarrowLinesFromChanges(changes) },
    });
  } catch {
    return null;
  }
}

export function YarrowTool({
  question: questionProp,
  onNewReading: onNewReadingProp,
  dictionary = EN_UI_DICTIONARY,
  localizedContent,
}: {
  question?: string;
  onNewReading?: () => void;
  dictionary?: UiDictionary;
  localizedContent?: LocalizedReadingContent;
}) {
  const router = useRouter();
  const [saveError, setSaveError] = useState("");
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const questionContext = useQuestionFirstContext();
  const question = questionProp ?? questionContext?.question;
  const zh = dictionary.locale === "zh-Hans";
  const t = (en: string, cn: string) => zh ? cn : en;
  const [changes, setChanges] = useState<YarrowChange[]>([]);
  const [readingMeta, setReadingMeta] = useState<{ id: string; createdAt: string } | null>(null);
  const [resumeState, setResumeState] = useState<ReadingResumeState>(NO_READING_RESUME);
  const [resumed, setResumed] = useState(false);
  const [sealedReading, setSealedReading] = useState<PublicReading | null>(null);
  const [freshCompletion, setFreshCompletion] = useState(false);
  const handoffStartedRef = useRef(false);

  // C1: detect, never apply. The normal entry state is the default.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const session = readYarrowSession();
    const stored = session?.data?.changes ?? [];
    const sealed = stored.length === 18;
    setResumeState(decideReadingResume({
      method: "yarrow-stalks",
      partial: { completed: stored.length, total: 18, unit: "changes" },
      partialReadingId: session?.id,
      sealedReadingId: sealed ? session?.id : null,
    }));
    if (sealed) setSealedReading(sealedReadingFromSession(session, stored));
  }, []);

  function resume() {
    const session = readYarrowSession();
    if (!session) {
      setResumeState(NO_READING_RESUME);
      return;
    }
    setChanges(session.data?.changes ?? []);
    setReadingMeta({ id: session.id, createdAt: session.createdAt });
    setResumed(true);
  }

  const lines = useMemo(() => completedLineValues(changes), [changes]);
  const complete = changes.length === 18;
  const yarrowLines = useMemo<YarrowLineResult[]>(() => yarrowLinesFromChanges(changes), [changes]);
  const publicReading = useMemo(() => complete && readingMeta
    ? buildPublicReading({
        id: readingMeta.id,
        createdAt: readingMeta.createdAt,
        method: "yarrow-stalks",
        question,
        lineValuesBottomUp: lines,
        evidence: { kind: "yarrow-stalks", lines: yarrowLines },
      })
    : null, [complete, question, readingMeta, yarrowLines, lines]);

  // C2 / C7: only a cast completed in this mounted flow hands off, exactly once,
  // and always with replace semantics.
  useEffect(() => {
    if (!freshCompletion || !publicReading || handoffStartedRef.current || sealedReading) return;
    handoffStartedRef.current = true;
    const outcome = completeReadingHandoff({ reading: publicReading, zh, router });
    if (outcome.kind === "failed") {
      setSealedReading(publicReading);
      setHandoffError(readingHandoffFailureCopy(outcome, zh));
      handoffStartedRef.current = false;
    }
  }, [freshCompletion, publicReading, router, sealedReading, zh]);

  const latest = changes.at(-1);
  const currentLine = complete ? 6 : Math.floor(changes.length / 3) + 1;
  const currentChange = complete ? 3 : (changes.length % 3) + 1;

  function commitChanges(next: YarrowChange[]) {
    try {
      const session = writePublicReadingSession(STORAGE_KEY, { changes: next });
      setReadingMeta({ id: session.id, createdAt: session.createdAt });
      setSaveError("");
      if (next.length === 18) setFreshCompletion(true);
    } catch {
      setSaveError(t("Unable to save this cast. Enable browser session storage and retry.", "无法保存本次起卦，请允许浏览器会话存储后重试。"));
    }
    setChanges(next);
  }

  function performChange() {
    if (complete) return;
    if (changes.length === 0) {
      // An explicit fresh cast discards an un-resumed partial instead of
      // silently inheriting its reading identity.
      if (resumeState.kind === "partial" && !resumed) {
        try {
          clearPublicReadingSession(STORAGE_KEY);
        } catch {
          // The in-memory reading still starts clean.
        }
        setResumeState(NO_READING_RESUME);
      }
      if (questionContext?.freezeCoreQuestion() === false) return;
    }
    const lineIndex = Math.floor(changes.length / 3) as 0 | 1 | 2 | 3 | 4 | 5;
    const changeIndex = (changes.length % 3) as 0 | 1 | 2;
    const startingStalks = changeIndex === 0 ? 49 : changes[changes.length - 1].endingStalks;
    const next = generateYarrowChange(lineIndex, changeIndex, startingStalks, browserRandomInt);
    commitChanges([...changes, next]);
  }

  function reset(preserveQuestion = false) {
    try {
      if (preserveQuestion) restartPublicReadingSession(STORAGE_KEY);
      else clearPublicReadingSession(STORAGE_KEY);
    } catch {
      // The in-memory reset still gives the user a clean new reading.
    }
    setReadingMeta(null);
    setChanges([]);
    setResumed(false);
    setResumeState(NO_READING_RESUME);
    setSealedReading(null);
    setHandoffError(null);
    setFreshCompletion(false);
    handoffStartedRef.current = false;
  }

  function retrySealedHandoff() {
    if (!sealedReading) return;
    const outcome = completeReadingHandoff({ reading: sealedReading, zh, router });
    if (outcome.kind === "failed") {
      setHandoffError(readingHandoffFailureCopy(outcome, zh));
      return;
    }
    setHandoffError(null);
    setSealedReading(null);
  }

  function discardSealedReading() {
    reset();
  }

  return (
    <section className="mystic-card overflow-hidden p-5 sm:p-8" aria-labelledby="yarrow-tool-title">
      {sealedReading ? (
        <div className="mb-6 rounded-2xl border border-[rgba(239,129,112,0.36)] bg-[rgba(239,129,112,0.08)] p-4" role="alert" data-reading-sealed-recovery={sealedReading.id}>
          <p className="text-sm font-semibold text-[var(--danger)]">{t("This completed cast still has to reach Reading Choice.", "这次已完成的起卦还没有进入解卦选择。")}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-2)]">
            {handoffError ?? t("No change was recast. Retrying reuses the exact same cast.", "没有重新起卦。重试会沿用完全相同的这一次起卦。")}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" className="mystic-button-secondary" onClick={retrySealedHandoff} data-reading-retry-handoff>{t("Retry Handoff", "重试进入解卦")}</button>
            <button type="button" className="mystic-button-secondary" onClick={discardSealedReading} data-reading-start-new>{t("Start New Reading", "重新起卦")}</button>
          </div>
        </div>
      ) : null}
      {resumeState.kind === "partial" && !resumed ? (
        <div className="mb-6 rounded-2xl border border-white/[0.12] bg-white/[0.035] p-4" data-reading-resume="yarrow-stalks">
          <p className="text-sm leading-6 text-[var(--ink-2)]">{t("You have an unfinished yarrow cast.", "你有一段尚未完成的蓍草起卦。")}</p>
          <button type="button" className="mystic-button-secondary mt-3" onClick={resume} data-reading-resume-action>
            {t("Resume", "继续")} · {resumeProgressLabel(resumeState, zh)}
          </button>
        </div>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mystic-kicker">{t("Yarrow Stalk Method", "蓍草起卦")}</p>
          <h2 id="yarrow-tool-title" className="mt-2 font-display text-3xl font-normal tracking-[-.03em]">{t("Complete 18 yarrow changes", "完成蓍草十八变")}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--ink-2)]">{t("Three changes form one line; six lines form the hexagram. Each completed change is saved in this browser session so a refresh can resume the ritual.", "每三变形成一爻，六爻共十八变。每完成一变都会保存到当前浏览器会话，刷新页面后仍可继续。")}</p>
        </div>
        <span className="ritual-progress-badge" style={{ textTransform: "none" }}>{changes.length} / 18 {t("changes", "变")}</span>
      </div>

      <div className="mt-7 grid gap-6 md:grid-cols-[minmax(0,1fr),minmax(15rem,.9fr)] md:items-stretch">
        <div className="mystic-card-soft relative overflow-hidden p-5 sm:p-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_50%_0%,rgba(143,112,255,.16),transparent_70%)]" />
          <div className="relative mx-auto mb-8 flex h-24 max-w-md items-center justify-center overflow-hidden" aria-hidden="true">
            {Array.from({ length: 13 }, (_, index) => (
              <span key={index} className="mx-[2px] h-20 w-px origin-bottom bg-gradient-to-b from-[var(--gold-2)] to-[#7c5d2b] opacity-70" style={{ transform: `rotate(${(index - 6) * 2.2}deg) translateY(${Math.abs(index - 6) * 1.2}px)` }} />
            ))}
          </div>
          <HexagramLines lines={lines} sealedCount={lines.length} animateLast size="lg" showLabels locale={dictionary.locale} />
        </div>

        <div className="mystic-card-soft p-5 text-sm leading-7 text-[var(--ink-2)] sm:p-6">
          <p className="mystic-kicker">{t("Current change", "当前进度")}</p>
          <p className="mt-3"><strong className="text-[var(--ink)]">{t("Current position:", "当前位置：")}</strong> {zh ? `第 ${currentLine} 爻，第 ${currentChange} 变` : `line ${currentLine}, change ${currentChange}`}</p>
          {latest ? (
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
              <dt>{t("Started", "起始蓍草")}</dt><dd className="text-right font-mono text-[var(--gold-2)]">{latest.startingStalks}</dd>
              <dt>{t("Left / right", "左堆 / 右堆")}</dt><dd className="text-right font-mono text-[var(--gold-2)]">{latest.leftGroup} / {latest.rightGroup}</dd>
              <dt>{t("Remainders", "余数")}</dt><dd className="text-right font-mono text-[var(--gold-2)]">{latest.leftRemainder} / {latest.rightRemainder}</dd>
              <dt>{t("Remaining", "剩余蓍草")}</dt><dd className="text-right font-mono text-[var(--gold-2)]">{latest.endingStalks}</dd>
            </dl>
          ) : (
            <p className="mt-4">{t("Begin with 49 working stalks. The digital convention records a valid split and remainder calculation for every change.", "从实际使用的 49 根蓍草开始。每一变都会记录分堆、取余与剩余数量，便于复核。")}</p>
          )}
          <p className="mt-5 text-xs leading-6 text-[var(--ink-3)]">{t("Quick I Ching uses an explicit Zhu Xi-style digital probability convention: the first change removes 5 or 9; later changes remove 4 or 8. This preserves the standard 6/7/8/9 line distribution while keeping every stalk calculation auditable.", "Quick I Ching 使用明确的朱熹式数字化概率约定：每爻第一变去 5 或 9，后两变去 4 或 8，以保留标准的 6、7、8、9 爻值分布，并让每一步蓍草计算都可以复核。")}</p>
        </div>
      </div>

      <div className="mt-7 flex flex-wrap gap-3">
        <button type="button" onClick={performChange} disabled={complete || Boolean(sealedReading)} className="mystic-button">
          {complete ? t("Reading complete", "起卦完成") : (zh ? `进行第 ${changes.length + 1} 变` : `Perform change ${changes.length + 1}`)}
        </button>
        <button type="button" onClick={() => reset(true)} disabled={changes.length === 0 || complete} className="mystic-button-secondary">{t("Restart casting", "重新起卦")}</button>
      </div>

      {saveError ? <div className="mt-4"><p role="alert">{saveError}</p><button type="button" className="mystic-button-secondary mt-3" onClick={() => commitChanges(changes)}>{t("Retry saving", "重新保存")}</button></div> : null}
    </section>
  );
}
