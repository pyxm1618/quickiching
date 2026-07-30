"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  createCastingSessionAction,
  getCastingSummaryAction,
  submitQuestionAction,
  generateThreeCoinLineAction,
  generateYarrowChangeAction,
  completeYarrowAction,
  createMeiHuaResultAction,
  revealCastingAction,
  startPreviewAction,
  startDeepReadingAction,
} from "@/app/actions";
import { SCENES, INTERPRETATION_GOALS, QUESTION_MIN_CHARS, QUESTION_MAX_CHARS, type CastingMethod } from "@/domain/casting/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { HexagramDisplay } from "@/components/cast/hexagram-display";
import { SealMark } from "@/components/hex/seal-mark";

/**
 * 暗室仪式（phototype/UI设计方案.md §6.2）：
 * input / ritual / reveal 三阶段进入全屏暗室（data-realm="chamber"），
 * 导航退隐、一次只给一个动作；result / crisis 回到明室。
 * 状态机与动作调用与重构前完全一致。
 */

const METHOD_META: Record<CastingMethod, { en: string; zh: string }> = {
  three_coin: { en: "Three-Coin Method", zh: "三枚铜钱" },
  yarrow_stalk: { en: "Yarrow Stalk Method", zh: "蓍草" },
  mei_hua_current_time: { en: "Mei Hua Yi Shu", zh: "梅花易数" },
};

const ORDINAL_EN = ["first", "second", "third", "fourth", "fifth", "sixth"] as const;
const CJK_NUM = ["一", "二", "三", "四", "五", "六"] as const;

const selectClass =
  "h-11 w-full rounded border border-[var(--line)] bg-[var(--paper-raised)] px-4 text-sm text-[var(--ink)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cinnabar)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--paper)]";

type ResultInfo = {
  primaryName: string;
  primaryNumber: number;
  movingLinePositions: number[];
  relatingName: string | null;
  relatingNumber: number | null;
  lineValues: number[];
  algorithmVersion: string;
  classicMappingVersion: string;
};

type Phase = "input" | "ritual" | "reveal" | "result" | "crisis";

/** 进度刻痕：每爻一格，烛金为已成。 */
function ProgressTicks({ total, done, group = 1 }: { total: number; done: number; group?: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-[3px] w-[20px] rounded-full",
            i < done ? "bg-[var(--bronze)]" : "bg-[var(--line)]",
            group > 1 && i % group === 0 && i > 0 && "ml-2",
          )}
        />
      ))}
    </div>
  );
}

export function CastingWizard({ method }: { method: CastingMethod }) {
  const [phase, setPhase] = useState<Phase>("input");
  const [castingId, setCastingId] = useState<string | null>(null);
  const [scene, setScene] = useState<string>(SCENES[0]);
  const [goal, setGoal] = useState<string>(INTERPRETATION_GOALS[0]);
  const [context, setContext] = useState("");
  const [riskStatus, setRiskStatus] = useState<string>("");
  const [result, setResult] = useState<ResultInfo | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [readingReport, setReadingReport] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Three-coin state
  const [coinLines, setCoinLines] = useState<boolean[]>(Array(6).fill(false));
  // Yarrow state (18 changes)
  const [yarrowChanges, setYarrowChanges] = useState<boolean[]>(Array(18).fill(false));
  // Mei hua
  const [ianaTimeZone, setIanaTimeZone] = useState<string>("");

  const chamber = phase === "input" || phase === "ritual" || phase === "reveal";

  // 暗室期间锁定底层页面滚动
  useEffect(() => {
    if (!chamber) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [chamber]);

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) setIanaTimeZone(tz);
    } catch {
      setIanaTimeZone("America/New_York");
    }
  }, []);

  // Resume from sessionStorage
  useEffect(() => {
    const raw = sessionStorage.getItem("iching_cast_snapshot");
    if (!raw) return;
    try {
      const snap = JSON.parse(raw);
      if (snap.method !== method) return;
      setCastingId(snap.castingId);
      setResult(snap.result ?? null);
      setPreviewText(snap.previewText ?? null);
      setReadingReport(snap.readingReport ?? null);
      setRiskStatus(snap.riskStatus ?? "");
      setPhase(snap.phase ?? "ritual");
    } catch {
      /* ignore */
    }
  }, [method]);

  function persist(extra: Record<string, unknown> = {}) {
    if (!castingId) return;
    sessionStorage.setItem(
      "iching_cast_snapshot",
      JSON.stringify({ castingId, method, result, previewText, readingReport, riskStatus, phase, ...extra }),
    );
  }

  async function submitQuestion(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const created = await createCastingSessionAction({ method, scene, interpretationGoal: goal });
    if (!created.ok) {
      setError(created.error.message);
      setPending(false);
      return;
    }
    const cid = created.value.castingId;
    setCastingId(cid);
    const sub = await submitQuestionAction({ castingId: cid, context });
    if (!sub.ok) {
      setError(sub.error.message);
      setPending(false);
      return;
    }
    setRiskStatus(sub.value.riskStatus);
    setPending(false);
    if (sub.value.emergency) {
      setPhase("crisis");
      return;
    }
    setPhase("ritual");
    persist({ phase: "ritual" });
  }

  async function castCoin() {
    if (!castingId) return;
    const idx = coinLines.findIndex((done) => !done);
    if (idx < 0) return;
    setPending(true);
    setError(null);
    const res = await generateThreeCoinLineAction({ castingId, lineIndex: idx });
    setPending(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    const next = [...coinLines];
    next[idx] = true;
    setCoinLines(next);
    if (res.value.completed) {
      setPhase("reveal");
      persist({ phase: "reveal" });
    }
  }

  async function yarrowNext() {
    if (!castingId) return;
    const idx = yarrowChanges.findIndex((done) => !done);
    if (idx < 0) return;
    setPending(true);
    setError(null);
    const res = await generateYarrowChangeAction({
      castingId,
      lineIndex: Math.floor(idx / 3),
      changeIndex: idx % 3,
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    const next = [...yarrowChanges];
    next[idx] = true;
    setYarrowChanges(next);
    if (idx === 17) {
      const done = await completeYarrowAction({ castingId });
      if (!done.ok) {
        setError(done.error.message);
        return;
      }
      setPhase("reveal");
      persist({ phase: "reveal" });
    }
  }

  async function castMeiHua() {
    if (!castingId) return;
    setPending(true);
    setError(null);
    const res = await createMeiHuaResultAction({ castingId, ianaTimeZone });
    setPending(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setPhase("reveal");
    persist({ phase: "reveal" });
  }

  async function doReveal(e: React.FormEvent) {
    e.preventDefault();
    if (!castingId) return;
    setPending(true);
    setError(null);
    const email = (document.getElementById("reveal-email") as HTMLInputElement).value;
    const res = await revealCastingAction({ castingId, email });
    setPending(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    if (res.value.duplicate) {
      setError("This question was already cast within the last 72 hours and remains locked to its first result.");
      return;
    }
    const summary = await getCastingSummaryAction({ castingId });
    if (!summary.ok || !summary.value?.hasResult || summary.value.primaryNumber == null || !summary.value.primaryName) {
      setError(summary.ok ? "The revealed result could not be loaded." : summary.error.message);
      return;
    }
    setResult({
      primaryName: summary.value.primaryName,
      primaryNumber: summary.value.primaryNumber,
      movingLinePositions: summary.value.movingLinePositions,
      relatingName: summary.value.relatingName,
      relatingNumber: summary.value.relatingNumber,
      lineValues: summary.value.lineValues,
      algorithmVersion: summary.value.algorithmVersion,
      classicMappingVersion: summary.value.classicMappingVersion,
    });
    setPhase("result");
    persist({ phase: "result" });
  }

  async function doPreview() {
    if (!castingId) return;
    setPending(true);
    setError(null);
    const res = await startPreviewAction({ castingId });
    setPending(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setPreviewText(res.value.relevanceStatement);
    persist({ previewText: res.value.relevanceStatement });
  }

  async function doReading() {
    if (!castingId) return;
    setPending(true);
    setError(null);
    const res = await startDeepReadingAction({ castingId });
    setPending(false);
    if (!res.ok) {
      if (res.error.code === "ENTITLEMENT_NOT_AVAILABLE") {
        setError("You have no available reading credit. Purchase one to continue.");
      } else {
        setError(res.error.message);
      }
      return;
    }
    setReadingReport(res.value.report as Record<string, unknown>);
    persist({ readingReport: res.value.report });
  }

  // ---------- 明室：结果与危机时刻 ----------

  if (phase === "result" && result) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-6 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--ink-3)]">
          <span>Ritual complete · Revealed</span>
          <span>
            {result.algorithmVersion} · {result.classicMappingVersion}
          </span>
        </div>

        {error && (
          <div className="mb-4 rounded border border-[var(--danger)] bg-[var(--danger-wash)] px-4 py-3 text-sm text-[var(--danger)]">
            {error}
          </div>
        )}

        <HexagramDisplay
          lineValues={result.lineValues}
          primaryName={result.primaryName === "hexagram" ? `Hexagram ${result.primaryNumber}` : result.primaryName}
          primaryNumber={result.primaryNumber}
          movingLinePositions={result.movingLinePositions}
          relatingName={result.relatingName}
          relatingNumber={result.relatingNumber}
          algorithmVersion={result.algorithmVersion}
          classicMappingVersion={result.classicMappingVersion}
        />

        {riskStatus === "professional_decision_blocked" ? (
          <Card className="mt-6 border-l-4 border-l-[var(--jade)]">
            <CardContent className="pt-6">
              <h3 className="font-display text-lg font-medium">A personalized reading isn’t available for this question</h3>
              <p className="mt-2 text-sm text-[var(--ink-2)]">
                This product doesn’t provide personalized advice on medical treatment, legal action,
                or specific investment transactions. You can still keep your hexagram as a cultural
                reflection. For those topics, please consult a licensed professional.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-6 grid items-start gap-6 md:grid-cols-2">
            <Card className="relative">
              <div className="absolute -top-3 right-5">
                <SealMark char="固" size="sm" tilt />
              </div>
              <CardContent className="pt-6">
                <h3 className="font-display text-lg font-medium">Your fixed preview</h3>
                {previewText ? (
                  <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink-2)]">{previewText}</p>
                ) : (
                  <div className="mt-3">
                    <Button onClick={doPreview} disabled={pending} size="sm">
                      {pending ? "Generating…" : "Generate preview"}
                    </Button>
                  </div>
                )}
                <p className="mt-4 font-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--ink-3)]">
                  Fixed for this hexagram · refreshing will not rewrite it
                </p>
              </CardContent>
            </Card>

            <div className="rounded-lg bg-[#221c12] p-6 text-[#f0e7d2]">
              <h3 className="font-display text-lg font-medium">Unlock the deep reading</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[#c9bb9c]">
                Ten modules written for this exact situation — current stage, mechanism of change,
                turning conditions. A fixed, re-openable report.
              </p>
              {!readingReport && (
                <div className="mt-4 flex items-center gap-4">
                  <Button onClick={doReading} disabled={pending} size="sm">
                    {pending ? "Generating…" : "Use 1 credit"}
                  </Button>
                  <Link href="/pricing" className="text-sm font-medium text-[#d9a95c] hover:underline">
                    Need credits?
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {readingReport && (
          <Card className="mt-6">
            <CardContent className="pt-6">
              <h3 className="font-display text-lg font-medium">Deep reading</h3>
              <ReadingReportView report={readingReport} />
            </CardContent>
          </Card>
        )}

        <div className="mt-8 text-center">
          <Link href="/account" className="text-sm font-medium text-[var(--jade)] hover:underline">
            View in my history →
          </Link>
        </div>
      </div>
    );
  }

  if (phase === "crisis") {
    return (
      <div className="mx-auto max-w-xl px-4 py-20">
        {/* 安全时刻退出设计语言：明室浅底 + 左朱砂边条，最大可读性 */}
        <div className="rounded-lg border-l-4 border-[var(--danger)] bg-[var(--paper-raised)] p-8">
          <h1 className="font-display text-2xl font-medium">Please reach out for support</h1>
          <p className="mt-4 text-sm leading-relaxed text-[var(--ink-2)]">
            If you are thinking about harming yourself or someone else, you are not alone and help is
            available. In the United States, you can call or text <strong>988</strong> (Suicide &amp;
            Crisis Lifeline) at any time. If you are in immediate danger, call <strong>911</strong>.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-[var(--ink-2)]">
            This tool is paused for this question. It is not a substitute for professional care.
          </p>
        </div>
      </div>
    );
  }

  // ---------- 暗室：问事 / 仪式 / 揭示 ----------

  const coinDone = coinLines.filter(Boolean).length;

  const yarrowDone = yarrowChanges.filter(Boolean).length;
  const yarrowDoneLines = Math.floor(yarrowDone / 3);
  const yarrowCurrentLine = Math.min(yarrowDoneLines + 1, 6);
  const yarrowCurrentChange = (yarrowDone % 3) + 1;

  return (
    <div data-realm="chamber" className="chamber-bg fixed inset-0 z-50 overflow-y-auto text-[var(--ink)]">
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-5">
        {/* 仪式顶栏：导航退隐，只留方法名与封存状态 */}
        <header className="flex items-center justify-between py-5 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--ink-3)]">
          <span className="flex items-center gap-2.5">
            <SealMark size="sm" />
            <span>
              {METHOD_META[method].en} · <span className="font-cjk normal-case">{METHOD_META[method].zh}</span>
            </span>
          </span>
          <span>{castingId ? "Question sealed ✓" : "Preparing"}</span>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center py-8">
          {error && (
            <div className="mb-6 w-full max-w-md rounded border border-[var(--danger)] bg-[var(--danger-wash)] px-4 py-3 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          {phase === "input" && (
            <form onSubmit={submitQuestion} className="w-full max-w-md">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--bronze)]">
                The Question · 问事
              </p>
              <h1 className="mt-3 font-display text-3xl font-medium tracking-[-0.01em] sm:text-4xl">
                What would you like clarity on?
              </h1>
              <div className="mt-8 space-y-5">
                <div>
                  <Label htmlFor="scene">Situation</Label>
                  <select id="scene" value={scene} onChange={(e) => setScene(e.target.value)} className={selectClass}>
                    {SCENES.map((s) => (
                      <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="goal">Interpretation goal</Label>
                  <select id="goal" value={goal} onChange={(e) => setGoal(e.target.value)} className={selectClass}>
                    {INTERPRETATION_GOALS.map((g) => (
                      <option key={g} value={g}>{g.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="context">Your specific situation</Label>
                  <Textarea
                    id="context"
                    rows={4}
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="Describe the situation in your own words. Don't include names, addresses, or account numbers."
                    maxLength={QUESTION_MAX_CHARS}
                  />
                  <p className="mt-1 font-mono text-[11px] text-[var(--ink-3)]">
                    {context.length}/{QUESTION_MAX_CHARS} · min {QUESTION_MIN_CHARS}
                  </p>
                </div>
                <p className="border-l-2 border-[var(--cinnabar)] py-1 pl-4 text-sm leading-relaxed text-[var(--ink-2)]">
                  Casting is free. Sign in after completing the ritual to reveal and save your result.
                </p>
                <Button type="submit" size="lg" disabled={pending || context.length < QUESTION_MIN_CHARS}>
                  {pending ? "Preparing ritual…" : "Begin the ritual"}
                </Button>
              </div>
            </form>
          )}

          {phase === "ritual" && method === "three_coin" && (
            <div className="flex w-full max-w-md flex-col items-center text-center">
              <div className="mb-8 flex flex-wrap items-center justify-center gap-2 font-mono text-[11px] tracking-[0.06em] text-[var(--ink-3)]">
                <span className="rounded-full border border-[var(--line)] px-3 py-1 text-[var(--ink-2)]">
                  {scene.replace(/_/g, " ")}
                </span>
                <span>{goal.replace(/_/g, " ")}</span>
              </div>

              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--bronze)]">
                {coinDone < 6
                  ? `Round ${coinDone + 1} of 6 · 第${CJK_NUM[coinDone]}爻`
                  : "Six lines complete · 六爻已成"}
              </p>

              <p className="mt-7 max-w-sm text-sm leading-relaxed text-[var(--ink-2)]">
                Each completed line is sealed on the server. Its value remains hidden until sign-in and reveal.
              </p>

              <Button onClick={castCoin} disabled={pending || coinDone >= 6} size="lg" className="mt-10">
                {pending ? "Casting…" : coinDone >= 6 ? "Completed" : `Cast the ${ORDINAL_EN[coinDone]} line`}
              </Button>

              <div className="mt-6">
                <ProgressTicks total={6} done={coinDone} />
              </div>
              <p className="mt-5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--line-strong)]">
                Each line is sealed the moment it is cast · 不可撤销 · 不可重来
              </p>
            </div>
          )}

          {phase === "ritual" && method === "yarrow_stalk" && (
            <div className="flex w-full max-w-md flex-col items-center text-center">
              <div className="mb-8 flex flex-wrap items-center justify-center gap-2 font-mono text-[11px] tracking-[0.06em] text-[var(--ink-3)]">
                <span className="rounded-full border border-[var(--line)] px-3 py-1 text-[var(--ink-2)]">
                  {scene.replace(/_/g, " ")}
                </span>
                <span>{goal.replace(/_/g, " ")}</span>
              </div>

              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--bronze)]">
                {yarrowDone < 18
                  ? `Line ${yarrowCurrentLine} of 6 · Change ${yarrowCurrentChange} of 3 · 第${CJK_NUM[yarrowCurrentLine - 1]}爻${CJK_NUM[yarrowCurrentChange - 1]}变`
                  : "Six lines complete · 六爻已成"}
              </p>

              <p className="mt-7 max-w-sm text-sm leading-relaxed text-[var(--ink-2)]">
                Each completed change is sealed on the server. No line values are shown before reveal.
              </p>

              <Button onClick={yarrowNext} disabled={pending || yarrowDone >= 18} size="lg" className="mt-10">
                {pending ? "Dividing…" : yarrowDone >= 18 ? "Finalizing…" : "Divide the stalks"}
              </Button>

              <div className="mt-6">
                <ProgressTicks total={18} done={yarrowDone} group={3} />
              </div>
              <p className="mt-5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--line-strong)]">
                49 stalks · three changes per line · 大衍之数五十，其用四十有九
              </p>
            </div>
          )}

          {phase === "ritual" && method === "mei_hua_current_time" && (
            <div className="w-full max-w-md text-center">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--bronze)]">
                Current-Time Casting · 时间起卦
              </p>
              <p className="mt-4 text-sm leading-relaxed text-[var(--ink-2)]">
                The hexagram is formed from the current time in your confirmed timezone. The timestamp
                is taken on the server at the moment you confirm — it cannot be edited afterwards.
              </p>
              <div className="mt-6 rounded border border-[var(--line)] bg-[var(--paper-raised)] p-5 text-left">
                <Label htmlFor="tz">Your timezone (IANA)</Label>
                <Input
                  id="tz"
                  value={ianaTimeZone}
                  onChange={(e) => setIanaTimeZone(e.target.value)}
                  placeholder="America/New_York"
                />
                <p className="mt-2 font-mono text-[11px] text-[var(--ink-3)]">
                  Detected automatically · MEI-HUA-V1 · 子时 rollover applies
                </p>
              </div>
              <Button onClick={castMeiHua} disabled={pending} size="lg" className="mt-8">
                {pending ? "Casting…" : "Cast with the current time"}
              </Button>
            </div>
          )}

          {phase === "reveal" && (
            <div className="flex w-full max-w-sm flex-col items-center text-center">
              <SealMark char="封" size="lg" tilt />
              <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--bronze)]">
                The ritual is complete
              </p>
              <h2 className="mt-3 font-display text-3xl font-medium tracking-[-0.01em]">Reveal your result</h2>

              {/* 封存预告：统一暗条，不泄露阴阳动爻 */}
              <div className="mt-7 flex w-40 flex-col gap-2" aria-hidden>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-2 rounded-[1px] bg-[var(--line-strong)]/60" />
                ))}
              </div>

              <p className="mt-6 text-sm leading-relaxed text-[var(--ink-2)]">
                Sign in to reveal the full pattern and save it to your account.
              </p>
              <form onSubmit={doReveal} className="mt-5 w-full space-y-4 text-left">
                <div>
                  <Label htmlFor="reveal-email">Email</Label>
                  <Input id="reveal-email" type="email" placeholder="you@example.com" required />
                </div>
                <Button type="submit" disabled={pending} size="lg" className="w-full">
                  {pending ? "Revealing…" : "Sign in & reveal"}
                </Button>
              </form>
              <p className="mt-4 font-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--ink-3)]">
                Free to reveal · saved permanently · 72h same-question lock applies
              </p>
            </div>
          )}
        </div>

        <footer className="py-5 text-center">
          <Link
            href="/"
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--ink-3)] transition-colors hover:text-[var(--ink)]"
          >
            ← Leave the ritual
          </Link>
        </footer>
      </div>
    </div>
  );
}

const MODULE_TITLES: Record<string, string> = {
  coreSummary: "Core Summary",
  currentStage: "Current Stage",
  primaryHexagramPattern: "Primary Hexagram & Current Pattern",
  changeMechanism: "Changing Lines & Mechanism of Change",
  possibleDirection: "Relating Hexagram & Possible Direction",
  obstaclesAndBlindSpots: "Obstacles & Blind Spots",
  turningConditions: "Turning Conditions",
  conditionalActionDirection: "Conditional Direction for Action",
  uncertaintyAndBoundaries: "Uncertainty & Boundaries",
  interpretiveBasisReferences: "Interpretive Basis",
};

function ReadingReportView({ report }: { report: Record<string, unknown> }) {
  const refs = report.interpretiveBasisReferences as
    | Array<{ source: string; hexagramNumber: number; linePosition?: number; status: string }>
    | undefined;
  return (
    <div className="mt-4 space-y-5">
      {Object.entries(report)
        .filter(([k]) => k !== "readingVariant" && k !== "interpretiveBasisReferences")
        .map(([key, value]) => (
          <div key={key}>
            <h4 className="font-display text-[15px] font-medium">{MODULE_TITLES[key] ?? key}</h4>
            <p className="mt-1 text-sm leading-relaxed text-[var(--ink-2)]">{String(value)}</p>
          </div>
        ))}
      {refs && (
        <div>
          <h4 className="font-display text-[15px] font-medium">{MODULE_TITLES.interpretiveBasisReferences}</h4>
          <p className="mt-1 text-sm leading-relaxed text-[var(--ink-2)]">
            References to classic text are pending licensed import (G-02):{" "}
            {refs
              .map((r) => `hex ${r.hexagramNumber}${r.linePosition ? ` line ${r.linePosition}` : ""}`)
              .join(", ")}
            .
          </p>
        </div>
      )}
      <p className="rounded bg-[var(--cinnabar-wash)] px-3 py-2 font-mono text-[11px] text-[var(--ink-3)]">
        Generated by the offline demo model. Production uses a reviewed AI pipeline (G-06 pending).
        This is reflection, not professional advice.
      </p>
    </div>
  );
}
