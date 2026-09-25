"use client";

import { useEffect, useMemo, useState } from "react";
import { HexagramLines } from "@/components/hex/hexagram-lines";
import { EN_UI_DICTIONARY } from "@/i18n/dictionaries/en";
import type { UiDictionary } from "@/i18n/dictionaries/types";
import type { LocalizedReadingContent } from "@/content/mei-hua-yi-shu/types";
import { PublicReadingResult } from "@/components/public-reading/public-reading-result";
import { useQuestionFirstContext } from "@/components/public-reading/question-first";
import { generateYarrowChange, type YarrowChange, type YarrowLineResult } from "@/domain/casting/yarrow/algorithm";
import type { LineValue } from "@/domain/casting/types";
import { buildPublicReading } from "@/domain/public-reading/reading";
import { browserRandomInt } from "@/lib/browser-random";
import { clearPublicReadingSession, readPublicReadingSession, restartPublicReadingSession, writePublicReadingSession } from "@/lib/public-reading-session";

const STORAGE_KEY = "quickiching:public-v1:yarrow-v2";
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
  const questionContext = useQuestionFirstContext();
  const question = questionProp ?? questionContext?.question;
  const onNewReading = onNewReadingProp ?? questionContext?.restartQuestion;
  const zh = dictionary.locale === "zh-Hans";
  const t = (en: string, cn: string) => zh ? cn : en;
  const [changes, setChanges] = useState<YarrowChange[]>([]);
  const [readingMeta, setReadingMeta] = useState<{ id: string; createdAt: string } | null>(null);

  useEffect(() => {
    const session = readYarrowSession();
    const stored = session?.data?.changes ?? [];
    try {
      const migrated = stored.length > 0 ? writePublicReadingSession(STORAGE_KEY, { changes: stored }) : session;
      setReadingMeta(migrated ? { id: migrated.id, createdAt: migrated.createdAt } : null);
    } catch {
      setReadingMeta(session ? { id: session.id, createdAt: session.createdAt } : null);
    }
    setChanges(stored);
  }, []);

  const lines = useMemo(() => completedLineValues(changes), [changes]);
  const complete = changes.length === 18;
  const yarrowLines = useMemo<YarrowLineResult[]>(() => Array.from({ length: Math.floor(changes.length / 3) }, (_, index) => {
    const lineChanges = changes.slice(index * 3, index * 3 + 3);
    const finalChange = lineChanges[2];
    if (!finalChange) throw new Error("YARROW_INCOMPLETE_LINE");
    return {
      lineIndex: index as 0 | 1 | 2 | 3 | 4 | 5,
      lineValue: (finalChange.endingStalks / 4) as LineValue,
      changes: lineChanges,
      algorithmVersion: finalChange.algorithmVersion,
    };
  }), [changes]);
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
  const latest = changes.at(-1);
  const currentLine = complete ? 6 : Math.floor(changes.length / 3) + 1;
  const currentChange = complete ? 3 : (changes.length % 3) + 1;

  function commitChanges(next: YarrowChange[]) {
    try {
      const session = writePublicReadingSession(STORAGE_KEY, { changes: next });
      setReadingMeta({ id: session.id, createdAt: session.createdAt });
    } catch {
      // The cast stays visible in memory; a later refresh can only resume a durable session.
    }
    setChanges(next);
  }

  function performChange() {
    if (complete) return;
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
  }

  function startNewReading() {
    reset(false);
    onNewReading?.();
  }

  return (
    <section className="mystic-card overflow-hidden p-5 sm:p-8" aria-labelledby="yarrow-tool-title">
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
        <button type="button" onClick={performChange} disabled={complete} className="mystic-button">
          {complete ? t("Reading complete", "起卦完成") : (zh ? `进行第 ${changes.length + 1} 变` : `Perform change ${changes.length + 1}`)}
        </button>
        <button type="button" onClick={() => reset(true)} disabled={changes.length === 0 || complete} className="mystic-button-secondary">{t("Restart casting", "重新起卦")}</button>
      </div>

      {publicReading ? <PublicReadingResult reading={publicReading} onNewReading={startNewReading} dictionary={dictionary} localizedContent={localizedContent} /> : null}
    </section>
  );
}
