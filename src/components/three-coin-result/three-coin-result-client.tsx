"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import { buildPublicReading } from "@/domain/public-reading/reading";
import { buildFreeReading } from "@/domain/interpretation/v2/build-free-reading";
import { loadHexagramInterpretation } from "@/domain/interpretation/v2/load-interpretation";
import type { FreeReading } from "@/domain/interpretation/v2/types";
import { PublicReadingResult } from "@/components/public-reading/public-reading-result";
import { ZH_HANS_READING_CONTENT } from "@/content/mei-hua-yi-shu/zh-Hans";
import { EN_UI_DICTIONARY } from "@/i18n/dictionaries/en";
import { ZH_HANS_UI_DICTIONARY } from "@/i18n/dictionaries/zh-Hans";
import {
  deepReadingContextEnrichmentSchema,
  deepReadingContextSnapshotSchema,
  readingReportSchema,
  type DeepReadingContextEnrichment,
  type DeepReadingContextSnapshot,
  type DeepReadingReport,
} from "@/domain/generation/deep-reading-contract";
import {
  readingReportSchema as legacyReadingReportSchema,
  type CommercialReadingReport,
} from "@/domain/generation/schemas";
import {
  clearThreeCoinReading,
  completedThreeCoinSteps,
  readThreeCoinSession,
} from "@/lib/three-coin-session";
import { buildPricingHref, buildResultSigninHref } from "@/lib/commercial-navigation";
import { CommercialReadingReportView, LegacyCommercialReadingReportView } from "./commercial-reading-report-view";
import styles from "./result-page.module.css";

export type ResultState =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "ready"; reading: FreeReading; lineValues: number[]; question?: string; createdAt?: string }
  | { kind: "error"; code: string };

export type ThreeCoinResultClientProps = {
  initialSessionId?: string;
  initialUser?: { id: string; email: string } | null;
  initialCredits?: number;
  locale?: "en" | "zh-Hans";
  initialState?: ResultState;
  initialCastingView?: {
    castingId: string;
    createdAt?: string;
    context: string;
    lineValuesBottomUp: number[] | null;
    readingReport: unknown;
    owns: boolean;
  } | null;
};

type DeepStatus = "idle" | "generating" | "completed" | "failed";
type ContextDraft = {
  contextNotes: string;
  optionsText: string;
  constraintsText: string;
  concernsText: string;
  interpretationGoal: DeepReadingContextEnrichment["interpretationGoal"];
};

const EMPTY_CONTEXT_DRAFT: ContextDraft = {
  contextNotes: "",
  optionsText: "",
  constraintsText: "",
  concernsText: "",
  interpretationGoal: "what_do_i_need_to_see_clearly",
};

function listField(value: string): string[] {
  return value.split(/[\n,]/u).map((item) => item.trim()).filter(Boolean);
}

function errorCode(error: unknown): string {
  return error instanceof Error ? error.message : "THREE_COIN_READING_UNAVAILABLE";
}

function currentBrowserReturnPath(): string {
  if (typeof window === "undefined") return "/readings/three-coin/result";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

async function buildFreeReadingFromLines(lineValues: number[]): Promise<FreeReading> {
  const result = buildHexagramResult({
    lineValuesBottomUp: lineValues as any,
    method: "three_coin",
  });
  const [primaryBundle, relatingBundle] = await Promise.all([
    loadHexagramInterpretation(result.primaryHexagramNumber),
    result.relatingHexagramNumber === null
      ? Promise.resolve(null)
      : loadHexagramInterpretation(result.relatingHexagramNumber),
  ]);
  return buildFreeReading(result, primaryBundle, relatingBundle);
}

export function ThreeCoinResultClient({
  initialSessionId,
  initialUser = null,
  initialCredits = 0,
  initialCastingView = null,
  initialState,
  locale = "en",
}: ThreeCoinResultClientProps) {
  const zh = locale === "zh-Hans";
  const t = (en: string, cn: string) => zh ? cn : en;
  const resultSigninHref = () => zh
    ? "/zh/signin?callbackURL=" + encodeURIComponent(currentBrowserReturnPath())
    : buildResultSigninHref(currentBrowserReturnPath());
  const pricingHref = (returnPath: string) => zh
    ? "/zh/pricing?returnUrl=" + encodeURIComponent(returnPath)
    : buildPricingHref(returnPath);
  const [state, setState] = useState<ResultState>(() => initialState ?? { kind: "loading" });
  const [clearError, setClearError] = useState<string | null>(null);
  const [clientCastingId, setClientCastingId] = useState<string | null>(null);

  const [castingId, setCastingId] = useState<string | null>(
    initialCastingView?.castingId ?? initialSessionId ?? null,
  );
  const [user] = useState<{ id: string; email: string } | null>(initialUser);
  const [credits, setCredits] = useState<number>(initialCredits);
  const initialReport = readingReportSchema.safeParse(initialCastingView?.readingReport);
  const initialLegacyReport = legacyReadingReportSchema.safeParse(initialCastingView?.readingReport);
  const [deepStatus, setDeepStatus] = useState<DeepStatus>(initialReport.success || initialLegacyReport.success ? "completed" : "idle");
  const [deepReport, setDeepReport] = useState<DeepReadingReport | null>(initialReport.success ? initialReport.data : null);
  const [legacyReport, setLegacyReport] = useState<CommercialReadingReport | null>(initialLegacyReport.success ? initialLegacyReport.data : null);
  const [deepSnapshot, setDeepSnapshot] = useState<DeepReadingContextSnapshot | null>(null);
  const [contextDraft, setContextDraft] = useState<ContextDraft>(EMPTY_CONTEXT_DRAFT);
  const [actionError, setActionError] = useState<string | null>(null);
  const resultReading = useMemo(() => {
    if (state.kind !== "ready") return null;
    const id = clientCastingId ?? castingId;
    return buildPublicReading({
      ...(id ? { id } : {}),
      ...(state.createdAt ? { createdAt: state.createdAt } : {}),
      method: "three-coin",
      methodVersion: "three-coin-v1",
      question: state.question,
      lineValuesBottomUp: state.lineValues,
      evidence: { kind: "history", originalMethod: "three-coin" },
    });
  }, [castingId, clientCastingId, state]);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startPolling = useCallback((targetCastingId: string) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/readings/${targetCastingId}/deep`);
        if (!res.ok) return;
        const data = await res.json() as {
          status: "not_started" | "queued" | "running" | "completed" | "failed" | "timed_out";
          output?: unknown;
          snapshot?: unknown;
        };
        const parsedSnapshot = deepReadingContextSnapshotSchema.safeParse(data.snapshot);
        if (parsedSnapshot.success) setDeepSnapshot(parsedSnapshot.data);
        const parsedReport = readingReportSchema.safeParse(data.output);
        if (data.status === "completed" && parsedReport.success) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setDeepReport(parsedReport.data);
          setLegacyReport(null);
          setDeepStatus("completed");
          setCredits((prev) => Math.max(0, prev - 1));
        } else if (data.status === "completed") {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          const parsedLegacyReport = legacyReadingReportSchema.safeParse(data.output);
          if (parsedLegacyReport.success) {
            setLegacyReport(parsedLegacyReport.data);
            setDeepStatus("completed");
          }
        } else if (data.status === "failed" || data.status === "timed_out") {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setDeepStatus("failed");
          setActionError(zh
            ? "解读未能完成，已释放本次预留次数；重试会沿用保存的问题与背景。"
            : "The reading did not finish. Your reserved credit has been released; retrying uses the same saved question and context.");
        }
      } catch {
        // 轮询重试
      }
    }, 2000);
  }, [zh]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const ids = [clientCastingId, castingId].filter((id): id is string => Boolean(id));
    for (const id of ids) {
      try {
        const saved = window.sessionStorage.getItem(`quickiching:deep-reading-context:${id}`);
        if (!saved) continue;
        const parsed = JSON.parse(saved) as Partial<ContextDraft>;
        if (typeof parsed.contextNotes === "string") {
          setContextDraft({
            contextNotes: parsed.contextNotes,
            optionsText: typeof parsed.optionsText === "string" ? parsed.optionsText : "",
            constraintsText: typeof parsed.constraintsText === "string" ? parsed.constraintsText : "",
            concernsText: typeof parsed.concernsText === "string" ? parsed.concernsText : "",
            interpretationGoal: parsed.interpretationGoal ?? EMPTY_CONTEXT_DRAFT.interpretationGoal,
          });
          return;
        }
      } catch {
        // The draft is optional; a storage error must not affect the free reading.
        return;
      }
    }
  }, [clientCastingId, castingId]);

  useEffect(() => {
    const ids = [clientCastingId, castingId].filter((id): id is string => Boolean(id));
    try {
      for (const id of ids) {
        window.sessionStorage.setItem(`quickiching:deep-reading-context:${id}`, JSON.stringify(contextDraft));
      }
    } catch {
      // The draft remains available in the current page even when storage is blocked.
    }
  }, [clientCastingId, castingId, contextDraft]);

  // 1. 初始化起卦数据（服务端优先 -> 本地 sessionStorage 降级）
  useEffect(() => {
    if (initialState) return;
    let active = true;

    async function init() {
      // 优先从服务端 initialCastingView 恢复
      if (
        initialCastingView?.lineValuesBottomUp &&
        initialCastingView.lineValuesBottomUp.length === 6
      ) {
        const reading = await buildFreeReadingFromLines(initialCastingView.lineValuesBottomUp);
        if (active) {
          setState({
            kind: "ready",
            reading,
            lineValues: initialCastingView.lineValuesBottomUp,
            question: initialCastingView.context || undefined,
            createdAt: initialCastingView.createdAt,
          });
        }
        return;
      }

      // 否则从本地 sessionStorage 恢复，同一个本地 session.id 就是本次起卦的稳定保存身份。
      const localSession = readThreeCoinSession();
      const completedSteps = completedThreeCoinSteps(localSession?.data?.steps ?? []);
      if (!completedSteps) {
        if (active) setState({ kind: "empty" });
        return;
      }

      const lineValues = completedSteps.map((s) => s.lineValue);
      const reading = await buildFreeReadingFromLines(lineValues);

      if (active) {
        setClientCastingId(localSession?.id ?? null);
        setState({
          kind: "ready",
          reading,
          lineValues,
          question: localSession?.question,
          createdAt: localSession?.createdAt,
        });
      }
    }

    void init().catch((err) => {
      if (active) setState({ kind: "error", code: errorCode(err) });
    });

    return () => {
      active = false;
    };
  }, [initialCastingView, initialState]);

  async function persistCurrentReading(showError: boolean): Promise<string | null> {
    if (castingId) return castingId;
    if (state.kind !== "ready" || !clientCastingId) {
      if (showError) setActionError("保存本次起卦失败，请重新起卦后再试");
      return null;
    }

    try {
      const res = await fetch("/api/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientCastingId,
          lineValuesBottomUp: state.lineValues,
          question: state.question,
        }),
      });

      if (res.status === 401) {
        window.location.assign(resultSigninHref());
        return null;
      }
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({})) as { error?: string; previousCastingId?: string };
        if (errorBody.error === "QUESTION_LOCKED" && errorBody.previousCastingId) {
          setActionError(t("You already have a saved cast for this question in the 72-hour window. Opening that reading.", "这个问题在 72 小时内已有起卦记录，正在打开原解读。"));
          const previousUrl = new URL(window.location.href);
          previousUrl.searchParams.set("session", errorBody.previousCastingId);
          window.location.assign(`${previousUrl.pathname}${previousUrl.search}${previousUrl.hash}`);
          return null;
        }
        if (showError) setActionError(t("Could not save this reading. Please try again.", "保存本次起卦失败，请稍后重试。"));
        return null;
      }

      const data = await res.json() as { castingId?: string };
      if (!data.castingId) {
        if (showError) setActionError("保存本次起卦失败，请稍后重试");
        return null;
      }

      setCastingId(data.castingId);
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set("session", data.castingId);
      window.history.replaceState(null, "", currentUrl.toString());
      return data.castingId;
    } catch {
      if (showError) setActionError("网络连接失败，请重试");
      return null;
    }
  }

  // 2. 如果已登录但尚未持久化起卦，自动将本次起卦幂等保存到后端并替换 URL
  useEffect(() => {
    if (!user || castingId || state.kind !== "ready" || !clientCastingId) return;
    void persistCurrentReading(false);
    // persistCurrentReading intentionally follows the current render state; these are its save prerequisites.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, castingId, state, clientCastingId]);

  // Restore the paid result and the exact encrypted input snapshot for this account.
  useEffect(() => {
    const activeId = castingId;
    if (!activeId || !user) return;

    let active = true;

    async function checkDeepStatus() {
      try {
        const res = await fetch(`/api/readings/${activeId}/deep`);
        if (!res.ok) return;
        const data = await res.json() as {
          status: "not_started" | "queued" | "running" | "completed" | "failed" | "timed_out";
          output?: unknown;
          snapshot?: unknown;
        };
        if (!active) return;
        const parsedSnapshot = deepReadingContextSnapshotSchema.safeParse(data.snapshot);
        if (parsedSnapshot.success) {
          const snapshot = parsedSnapshot.data;
          setDeepSnapshot(snapshot);
          setContextDraft({
            contextNotes: snapshot.context.contextNotes,
            optionsText: snapshot.context.options.join("\n"),
            constraintsText: snapshot.context.constraints.join("\n"),
            concernsText: snapshot.context.concerns.join("\n"),
            interpretationGoal: snapshot.context.interpretationGoal,
          });
        }
        const parsedReport = readingReportSchema.safeParse(data.output);
        if (data.status === "completed" && parsedReport.success) {
          setDeepReport(parsedReport.data);
          setLegacyReport(null);
          setDeepStatus("completed");
        } else if (data.status === "completed") {
          const parsedLegacyReport = legacyReadingReportSchema.safeParse(data.output);
          if (parsedLegacyReport.success) {
            setLegacyReport(parsedLegacyReport.data);
            setDeepStatus("completed");
          }
        } else if (data.status === "queued" || data.status === "running") {
          setDeepStatus("generating");
          if (activeId) startPolling(activeId);
        } else if (data.status === "failed" || data.status === "timed_out") {
          setDeepStatus("failed");
        }
      } catch {
        // 忽略探测异常
      }
    }

    void checkDeepStatus();

    return () => {
      active = false;
    };
  }, [castingId, startPolling, user]);

  async function handleUnlockDeepReading() {
    if (state.kind !== "ready") return;
    setActionError(null);

    if (!state.question?.trim()) {
      setActionError(t("This cast has no core question. Start a new reading and enter one before the first cast.", "这次起卦没有绑定核心问题。请重新起卦，并在第一次起爻前填写问题。"));
      return;
    }

    const submittedContext = deepSnapshot?.context ?? {
      contextNotes: contextDraft.contextNotes,
      options: listField(contextDraft.optionsText),
      constraints: listField(contextDraft.constraintsText),
      concerns: listField(contextDraft.concernsText),
      interpretationGoal: contextDraft.interpretationGoal,
      locale,
    };
    const parsedContext = deepReadingContextEnrichmentSchema.safeParse(submittedContext);
    if (!parsedContext.success) {
      setActionError(t("Add at least 24 characters describing the relevant situation, options, constraints, or concerns.", "请补充至少 24 个字符的相关背景、选项、限制或顾虑。"));
      return;
    }

    const activeCastingId = await persistCurrentReading(true);
    if (!activeCastingId) return;

    setDeepStatus("generating");

    try {
      const res = await fetch(`/api/readings/${activeCastingId}/deep`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedContext.data),
      });

      if (res.status === 402) {
        setDeepStatus("idle");
        setActionError(t("You have no available reading credits. Choose a pack to continue.", "当前没有可用解读次数，请先选择次数包。"));
        return;
      }

      if (res.status === 401) {
        setDeepStatus("idle");
        window.location.assign(resultSigninHref());
        return;
      }

      if (!res.ok) {
        const error = await res.json().catch(() => ({})) as { error?: string };
        setDeepStatus(error.error === "RISK_PROHIBITED" ? "idle" : "failed");
        const message = error.error === "RISK_PROHIBITED"
          ? t("This question needs qualified professional support, so generation was blocked and no credit was reserved.", "这个问题需要合格专业人士支持，因此系统已阻止生成，未预留次数。")
          : error.error === "CONTEXT_INSUFFICIENT"
            ? t("Add enough situation context before generating the reading.", "请先补充足够的现实背景，再生成解读。")
            : t("The request could not start. Check the saved status before retrying.", "暂时无法发起请求；重试前请先检查已保存状态。");
        setActionError(message);
        return;
      }

      const data = await res.json() as {
        status: "queued" | "running" | "completed";
        output?: unknown;
        snapshot?: unknown;
      };

      const parsedSnapshot = deepReadingContextSnapshotSchema.safeParse(data.snapshot);
      if (parsedSnapshot.success) setDeepSnapshot(parsedSnapshot.data);
      const parsedReport = readingReportSchema.safeParse(data.output);
      if (data.status === "completed" && parsedReport.success) {
        setDeepReport(parsedReport.data);
        setLegacyReport(null);
        setDeepStatus("completed");
        setCredits((prev) => Math.max(0, prev - 1));
      } else if (data.status === "completed") {
        const parsedLegacyReport = legacyReadingReportSchema.safeParse(data.output);
        if (parsedLegacyReport.success) {
          setLegacyReport(parsedLegacyReport.data);
          setDeepStatus("completed");
        }
      } else {
        startPolling(activeCastingId);
      }
    } catch {
      setDeepStatus("idle");
      setActionError(t("The network request was interrupted. Check the saved status before retrying to avoid duplicate work.", "网络请求中断。请先检查已保存状态，再重试以避免重复任务。"));
    }
  }

  async function handleOpenPricing() {
    setActionError(null);
    const activeCastingId = await persistCurrentReading(true);
    if (!activeCastingId) return;

    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set("session", activeCastingId);
    const returnPath = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
    window.location.assign(pricingHref(returnPath));
  }

  function startNewReading() {
    try {
      clearThreeCoinReading();
      setClearError(null);
      window.location.assign(zh ? "/zh/methods/three-coin" : "/#three-coin-reading");
    } catch (error: unknown) {
      setClearError(errorCode(error));
    }
  }

  if (state.kind === "loading") {
    return (
      <div className={`${styles.page} mx-auto min-h-[100svh] w-full max-w-[1180px] px-4 sm:px-6`}>
        <div className={styles.loadingState} role="status" aria-label={t("Loading your completed reading", "正在恢复已完成的起卦结果")}>
          <p className="mystic-kicker">{t("Three-Coin Method", "三枚铜钱法")}</p>
          <p className="mt-3 font-display text-3xl font-normal text-white">{t("Restoring your sealed reading…", "正在恢复已经落定的起卦结果…")}</p>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">
            {t("The result is rebuilt from the six completed lines.", "结果会根据已经完成的六爻重新构建。")}
          </p>
        </div>
      </div>
    );
  }

  if (state.kind === "empty") {
    return (
      <div className={`${styles.page} mx-auto w-full max-w-[1180px] px-4 sm:px-6`}>
        <section className={styles.emptyState} aria-labelledby="empty-reading-title">
          <p className="mystic-kicker">{t("Three-Coin Result", "三枚铜钱起卦结果")}</p>
          <h1 id="empty-reading-title" className="mt-3 font-display text-4xl font-normal tracking-[-0.04em] text-white sm:text-5xl">
            {t("No completed reading found", "没有找到已完成的起卦")}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-[var(--ink-2)] sm:text-base">
            {t("Complete a six-line Three-Coin reading before opening a result.", "请先完成六爻三枚铜钱起卦，再打开结果页。")}
          </p>
          <Link href={zh ? "/zh/methods/three-coin" : "/#three-coin-reading"} className={`${styles.newReadingButton} mt-7`}>
            {t("Start a Three-Coin Reading", "开始三枚铜钱起卦")}
          </Link>
        </section>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className={`${styles.page} mx-auto w-full max-w-[1180px] px-4 sm:px-6`}>
        <section className={styles.emptyState} aria-labelledby="reading-error-title">
          <p className="mystic-kicker">{t("Reading unavailable", "起卦结果暂时不可用")}</p>
          <h1 id="reading-error-title" className="mt-3 font-display text-4xl font-normal tracking-[-0.04em] text-white sm:text-5xl">
            {t("The sealed reading could not be interpreted", "无法恢复这次已落定的起卦结果")}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-[var(--ink-2)]">
            {zh ? "请返回三枚铜钱页面重新检查本次起卦。" : <>Error: <code className="font-mono text-[var(--cyan)]">{state.code}</code></>}
          </p>
          <Link href={zh ? "/zh/methods/three-coin" : "/#three-coin-reading"} className={`${styles.newReadingButton} mt-7`}>
            {t("Return to Three-Coin Reading", "返回三枚铜钱起卦")}
          </Link>
        </section>
      </div>
    );
  }

  const signinHref = resultSigninHref();
  const resultDictionary = zh ? ZH_HANS_UI_DICTIONARY : EN_UI_DICTIONARY;

  return (
    <>
      <PublicReadingResult
        reading={resultReading!}
        onNewReading={startNewReading}
        dictionary={resultDictionary}
        localizedContent={zh ? ZH_HANS_READING_CONTENT : undefined}
        title={zh ? "本次三枚铜钱起卦结果" : "Your Three-Coin Reading"}
        headingLevel="h1"
        newReadingLabel={zh ? "重新起一卦" : "Start a New Reading"}
      >
        <section className="mt-6 rounded-3xl border border-[var(--gold)]/25 bg-gradient-to-b from-[rgba(235,178,85,0.07)] to-transparent p-5 sm:p-8" aria-labelledby="commercial-deep-section" data-deep-reading-entry>
          {deepStatus === "completed" && (deepReport || legacyReport) ? (
            <>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--gold)]/30 bg-[rgba(235,178,85,0.06)] px-5 py-3 text-xs text-[var(--ink-2)]">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[var(--jade)]" />
                  {t("Saved to your account history", "已保存到账户历史记录")}
                </span>
                <Link href={zh ? "/zh/account" : "/account"} className="font-semibold text-[var(--gold-2)] hover:underline">
                  {t("Open account history →", "查看账户与历史记录 →")}
                </Link>
              </div>
              {deepReport ? <CommercialReadingReportView report={deepReport} snapshot={deepSnapshot} locale={locale} /> : null}
              {legacyReport ? <LegacyCommercialReadingReportView report={legacyReport} locale={locale} /> : null}
              <a href="#general-cast-interpretation" className="mt-6 inline-flex text-sm font-semibold text-[var(--cyan)] hover:underline">
                {t("Read the full general cast interpretation", "查看完整的通用卦象解读")}
              </a>
            </>
          ) : deepStatus === "generating" ? (
            <div className="p-4 text-center sm:p-8" aria-live="polite" role="status" data-deep-reading-state="generating">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[var(--gold)]/40 bg-[var(--gold)]/15">
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[var(--gold)] border-t-transparent" />
              </div>
              <h3 className="mt-4 font-display text-2xl font-normal text-white sm:text-3xl">{t("Your situation-based reading is in progress…", "正在结合你的处境生成个性化解读…")}</h3>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[var(--ink-2)]">
                {t("The saved question, situation, exact cast, and source material are being reviewed together.", "系统正在结合已保存的问题、现实背景、本次卦象和解释依据进行校验。")}
              </p>
            </div>
          ) : (
            <>
              <p className="mystic-kicker">{t("Free: understand the cast · Paid: relate it to your situation", "免费：理解卦象 · 付费：解读卦象与你处境的关系")}</p>
              <h2 id="commercial-deep-section" className="mt-2 max-w-3xl font-display text-2xl font-normal text-white sm:text-3xl">
                {t("What does this reading mean for your specific situation?", "这次卦象对你的具体处境意味着什么？")}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-2)]">
                {t("Deep Reading uses the question you asked before casting, the context you add here, your exact Three-Coin result, and cited I Ching material. The free cast interpretation remains complete and never calls AI.", "深度解读会结合起卦前提出的问题、你在此补充的现实背景、本次三枚铜钱卦象及可核对的易经材料。免费卦象解读仍然完整，且绝不调用 AI。")}
              </p>

              {!state.question || Array.from(state.question.trim()).length < 8 ? (
                <div className="mt-6 rounded-2xl border border-[var(--gold)]/25 bg-black/15 p-5" data-deep-reading-blocked="missing-question">
                  <p className="text-sm leading-7 text-[var(--ink-2)]">{t("This cast was not bound to a clear question before its first changing line. It stays available as a free reading; start a new cast with one core question to use Deep Reading.", "这次起卦在第一爻落定前没有绑定清晰的核心问题，因此仍可作为免费解读查看；如需深度解读，请带着一个核心问题重新起卦。")}</p>
                  <button type="button" onClick={startNewReading} className="mystic-button mt-5">{t("Start a new reading with a question", "带着问题重新起卦")}</button>
                </div>
              ) : (
                <>
                  <div className="mt-6 rounded-2xl border border-white/[0.09] bg-black/15 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--cyan)]">{t("Core question frozen at cast", "起卦时已锁定的核心问题")}</p>
                    <p className="mt-2 text-sm leading-7 text-white" data-core-question-at-cast>{state.question}</p>
                  </div>

                  {deepSnapshot ? (
                    <p className="mt-5 rounded-xl border border-[var(--gold)]/20 bg-[var(--gold)]/[0.04] p-4 text-sm leading-7 text-[var(--ink-2)]" data-context-snapshot-frozen>
                      {t("This generation already has a saved input snapshot. A retry will reuse the same question and context.", "本次生成已保存输入快照；重试会继续使用相同的问题与背景。")}
                    </p>
                  ) : (
                    <div className="mt-6 grid gap-4 md:grid-cols-2" data-context-enrichment-form>
                      <label className="md:col-span-2">
                        <span className="text-sm font-semibold text-white">{t("Relevant situation", "相关现实背景")}</span>
                        <textarea value={contextDraft.contextNotes} onChange={(event) => setContextDraft((draft) => ({ ...draft, contextNotes: event.target.value }))} maxLength={2000} rows={3} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm leading-6 text-white" placeholder={t("What has happened, and what matters most here?", "目前发生了什么？哪些事实最重要？")} />
                      </label>
                      <label>
                        <span className="text-sm font-semibold text-white">{t("Options", "正在考虑的选项")}</span>
                        <textarea value={contextDraft.optionsText} onChange={(event) => setContextDraft((draft) => ({ ...draft, optionsText: event.target.value }))} rows={2} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm leading-6 text-white" placeholder={t("One option per line (optional)", "每行一个选项（可选）")} />
                      </label>
                      <label>
                        <span className="text-sm font-semibold text-white">{t("Constraints", "现实限制")}</span>
                        <textarea value={contextDraft.constraintsText} onChange={(event) => setContextDraft((draft) => ({ ...draft, constraintsText: event.target.value }))} rows={2} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm leading-6 text-white" placeholder={t("One constraint per line (optional)", "每行一条限制（可选）")} />
                      </label>
                      <label>
                        <span className="text-sm font-semibold text-white">{t("Concerns", "主要顾虑")}</span>
                        <textarea value={contextDraft.concernsText} onChange={(event) => setContextDraft((draft) => ({ ...draft, concernsText: event.target.value }))} rows={2} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm leading-6 text-white" placeholder={t("What are you worried about? (optional)", "你最担心什么？（可选）")} />
                      </label>
                      <label>
                        <span className="text-sm font-semibold text-white">{t("What would you like to understand?", "你最想看清什么？")}</span>
                        <select value={contextDraft.interpretationGoal} onChange={(event) => setContextDraft((draft) => ({ ...draft, interpretationGoal: event.target.value as ContextDraft["interpretationGoal"] }))} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm leading-6 text-white">
                          <option value="what_do_i_need_to_see_clearly">{t("Understand the situation", "理解当前局势")}</option>
                          <option value="what_should_i_pay_attention_to_next">{t("Know what to watch next", "看清接下来应关注什么")}</option>
                          <option value="how_should_i_act">{t("Reflect on a next step", "思考下一步")}</option>
                          <option value="what_is_the_likely_direction">{t("Explore a conditional direction", "理解可能的条件性走向")}</option>
                        </select>
                      </label>
                      <p className="md:col-span-2 text-xs leading-6 text-[var(--ink-3)]">{t("Add at least 24 characters across the situation, options, constraints, and concerns. This context is encrypted with the saved reading and is not used to change its core question.", "请在背景、选项、限制和顾虑中合计补充至少 24 个字符。背景会与起卦结果一并加密保存，不会改变原核心问题。")}</p>
                    </div>
                  )}

                  {actionError ? <p className="mt-4 text-sm font-semibold text-[var(--danger)]" role="alert">{actionError}</p> : null}
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    {!user ? (
                      <Link href={signinHref} className="mystic-button">{t("Sign in to continue", "登录并继续")}</Link>
                    ) : credits <= 0 ? (
                      <button type="button" onClick={handleOpenPricing} className="mystic-button">{t("Choose a Deep Reading pack", "选择深度解读次数包")}</button>
                    ) : (
                      <button type="button" onClick={handleUnlockDeepReading} className="mystic-button" data-start-deep-reading>
                        {deepStatus === "failed" ? t("Retry this reading", "重试本次解读") : t("Read my situation with this cast", "结合本次卦象解读我的处境")}
                      </button>
                    )}
                    {user && credits > 0 ? <span className="text-xs text-[var(--ink-3)]">{t(`${credits} credit${credits === 1 ? "" : "s"} available · one reserved per generation · released if generation fails`, `可用 ${credits} 次 · 每次生成预留 1 次 · 失败则释放`)}</span> : null}
                    {user && credits <= 0 ? <span className="text-xs text-[var(--ink-3)]">{t("Your cast remains free to review. No generation starts until a credit is available.", "你的免费卦象解读仍可查看；获得次数前不会启动生成。")}</span> : null}
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </PublicReadingResult>

      {clearError ? (
        <div
          role="alert"
          data-three-coin-clear-error={clearError}
          className="fixed bottom-5 left-1/2 z-50 w-[min(92vw,620px)] -translate-x-1/2 rounded-2xl border border-[rgba(239,129,112,0.42)] bg-[rgba(23,14,25,0.96)] px-5 py-4 shadow-2xl"
        >
          <p className="text-sm font-semibold text-[var(--danger)]">
            {t("The sealed reading could not be cleared, so Quick I Ching kept this result open.", "无法清除已经落定的起卦，因此 Quick I Ching 保留了当前结果。")}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-2)]">
            {t("No new reading has started. You can retry the button after browser session storage becomes available.", "新的起卦尚未开始。浏览器会话存储恢复后，可以再次尝试重新起卦。")}
          </p>
          {!zh ? <p className="mt-2 font-mono text-xs text-[var(--ink-3)]">{clearError}</p> : null}
        </div>
      ) : null}
    </>
  );
}
