"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import { buildFreeReading } from "@/domain/interpretation/v2/build-free-reading";
import { loadHexagramInterpretation } from "@/domain/interpretation/v2/load-interpretation";
import type { FreeReading } from "@/domain/interpretation/v2/types";
import type { CommercialReadingReport } from "@/domain/generation/schemas";
import {
  clearThreeCoinReading,
  completedThreeCoinSteps,
  readThreeCoinSession,
} from "@/lib/three-coin-session";
import { buildPricingHref, buildResultSigninHref } from "@/lib/commercial-navigation";
import { ReadingResultView } from "./reading-result-view";
import { CommercialReadingReportView } from "./commercial-reading-report-view";
import styles from "./result-page.module.css";

export type ThreeCoinResultClientProps = {
  initialSessionId?: string;
  initialUser?: { id: string; email: string } | null;
  initialCredits?: number;
  initialCastingView?: {
    castingId: string;
    context: string;
    lineValuesBottomUp: number[] | null;
    readingReport: CommercialReadingReport | null;
    owns: boolean;
  } | null;
};

type ResultState =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "ready"; reading: FreeReading; lineValues: number[]; question?: string }
  | { kind: "error"; code: string };

type DeepStatus = "idle" | "generating" | "completed" | "failed";

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
}: ThreeCoinResultClientProps) {
  const [state, setState] = useState<ResultState>({ kind: "loading" });
  const [clearError, setClearError] = useState<string | null>(null);
  const [clientCastingId, setClientCastingId] = useState<string | null>(null);

  const [castingId, setCastingId] = useState<string | null>(
    initialCastingView?.castingId ?? initialSessionId ?? null,
  );
  const [user] = useState<{ id: string; email: string } | null>(initialUser);
  const [credits, setCredits] = useState<number>(initialCredits);
  const [deepStatus, setDeepStatus] = useState<DeepStatus>(
    initialCastingView?.readingReport ? "completed" : "idle",
  );
  const [deepReport, setDeepReport] = useState<CommercialReadingReport | null>(
    initialCastingView?.readingReport ?? null,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // 1. 初始化起卦数据（服务端优先 -> 本地 sessionStorage 降级）
  useEffect(() => {
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
        });
      }
    }

    void init().catch((err) => {
      if (active) setState({ kind: "error", code: errorCode(err) });
    });

    return () => {
      active = false;
    };
  }, [initialCastingView]);

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
        window.location.assign(buildResultSigninHref(currentBrowserReturnPath()));
        return null;
      }
      if (!res.ok) {
        if (showError) setActionError("保存本次起卦失败，请稍后重试");
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

  // 3. 检查是否有后台运行中或已完成的 deep reading
  useEffect(() => {
    const activeId = castingId;
    if (!activeId || deepStatus === "completed" || !user) return;

    let active = true;

    async function checkDeepStatus() {
      try {
        const res = await fetch(`/api/readings/${activeId}/deep`);
        if (!res.ok) return;
        const data = await res.json() as {
          status: "not_started" | "queued" | "running" | "completed" | "failed";
          output?: CommercialReadingReport;
        };
        if (!active) return;
        if (data.status === "completed" && data.output) {
          setDeepReport(data.output);
          setDeepStatus("completed");
        } else if (data.status === "queued" || data.status === "running") {
          setDeepStatus("generating");
          if (activeId) startPolling(activeId);
        }
      } catch {
        // 忽略探测异常
      }
    }

    void checkDeepStatus();

    return () => {
      active = false;
    };
  }, [castingId, deepStatus, user]);

  function startPolling(targetCastingId: string) {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/readings/${targetCastingId}/deep`);
        if (!res.ok) return;
        const data = await res.json() as {
          status: "not_started" | "queued" | "running" | "completed" | "failed";
          output?: CommercialReadingReport;
        };
        if (data.status === "completed" && data.output) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setDeepReport(data.output);
          setDeepStatus("completed");
          setCredits((prev) => Math.max(0, prev - 1));
        } else if (data.status === "failed") {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setDeepStatus("failed");
          setActionError("深度解读生成未完成，已为您全额保留解读次数。请随时重试。");
        }
      } catch {
        // 轮询重试
      }
    }, 2000);
  }

  async function handleUnlockDeepReading() {
    if (state.kind !== "ready") return;
    setActionError(null);

    const activeCastingId = await persistCurrentReading(true);
    if (!activeCastingId) return;

    setDeepStatus("generating");

    try {
      const res = await fetch(`/api/readings/${activeCastingId}/deep`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 402) {
        setDeepStatus("idle");
        setActionError("您的解读次数不足，请先获取次数包");
        return;
      }

      if (res.status === 401) {
        setDeepStatus("idle");
        window.location.assign(buildResultSigninHref(currentBrowserReturnPath()));
        return;
      }

      if (!res.ok) {
        setDeepStatus("failed");
        setActionError("发起生成失败，请重试");
        return;
      }

      const data = await res.json() as {
        status: "queued" | "running" | "completed";
        output?: CommercialReadingReport;
      };

      if (data.status === "completed" && data.output) {
        setDeepReport(data.output);
        setDeepStatus("completed");
        setCredits((prev) => Math.max(0, prev - 1));
      } else {
        startPolling(activeCastingId);
      }
    } catch {
      setDeepStatus("failed");
      setActionError("网络请求中断，已为您保留解读次数，请点击重试");
    }
  }

  async function handleOpenPricing() {
    setActionError(null);
    const activeCastingId = await persistCurrentReading(true);
    if (!activeCastingId) return;

    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set("session", activeCastingId);
    const returnPath = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
    window.location.assign(buildPricingHref(returnPath));
  }

  function startNewReading() {
    try {
      clearThreeCoinReading();
      setClearError(null);
      window.location.assign("/#three-coin-reading");
    } catch (error: unknown) {
      setClearError(errorCode(error));
    }
  }

  if (state.kind === "loading") {
    return (
      <div className={`${styles.page} mx-auto min-h-[100svh] w-full max-w-[1180px] px-4 sm:px-6`}>
        <div className={styles.loadingState} role="status" aria-label="Loading your completed reading">
          <p className="mystic-kicker">Three-Coin Method</p>
          <p className="mt-3 font-display text-3xl font-normal text-white">Restoring your sealed reading…</p>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">
            The result is rebuilt from the six completed lines.
          </p>
        </div>
      </div>
    );
  }

  if (state.kind === "empty") {
    return (
      <div className={`${styles.page} mx-auto w-full max-w-[1180px] px-4 sm:px-6`}>
        <section className={styles.emptyState} aria-labelledby="empty-reading-title">
          <p className="mystic-kicker">Three-Coin Result</p>
          <h1 id="empty-reading-title" className="mt-3 font-display text-4xl font-normal tracking-[-0.04em] text-white sm:text-5xl">
            No completed reading found
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-[var(--ink-2)] sm:text-base">
            Complete a six-line Three-Coin reading before opening a result.
          </p>
          <Link href="/#three-coin-reading" className={`${styles.newReadingButton} mt-7`}>
            Start a Three-Coin Reading
          </Link>
        </section>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className={`${styles.page} mx-auto w-full max-w-[1180px] px-4 sm:px-6`}>
        <section className={styles.emptyState} aria-labelledby="reading-error-title">
          <p className="mystic-kicker">Reading unavailable</p>
          <h1 id="reading-error-title" className="mt-3 font-display text-4xl font-normal tracking-[-0.04em] text-white sm:text-5xl">
            The sealed reading could not be interpreted
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-[var(--ink-2)]">
            Error: <code className="font-mono text-[var(--cyan)]">{state.code}</code>
          </p>
          <Link href="/#three-coin-reading" className={`${styles.newReadingButton} mt-7`}>
            Return to Three-Coin Reading
          </Link>
        </section>
      </div>
    );
  }

  const signinHref = buildResultSigninHref(currentBrowserReturnPath());

  return (
    <>
      <ReadingResultView reading={state.reading} onStartNewReading={startNewReading}>
        {/* AI 深度解读商业版板块 */}
        <section className="mt-12" aria-labelledby="commercial-deep-section">
          {deepStatus === "completed" && deepReport ? (
            <>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--gold)]/30 bg-[rgba(235,178,85,0.06)] px-5 py-3 text-xs text-[var(--ink-2)]">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[var(--jade)]" />
                  本报告已安全永久保存至您的账户
                </span>
                <Link href="/account" className="font-semibold text-[var(--gold-2)] hover:underline">
                  查看账户与历史记录 →
                </Link>
              </div>
              <CommercialReadingReportView report={deepReport} />
            </>
          ) : deepStatus === "generating" ? (
            <div className="rounded-3xl border border-[var(--gold)]/30 bg-[rgba(235,178,85,0.06)] p-8 text-center sm:p-12">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[var(--gold)]/40 bg-[var(--gold)]/15">
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[var(--gold)] border-t-transparent" />
              </div>
              <h3 className="mt-4 font-display text-2xl font-normal text-white sm:text-3xl">正在生成十模块深度解读报告…</h3>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[var(--ink-2)]">
                AI 正在结合您的卦象格局、动爻演变与现实决策维度进行深层义理推演。大约需要 15~30 秒，请稍候。
              </p>
            </div>
          ) : !user ? (
            <div className="rounded-3xl border border-white/[0.12] bg-white/[0.03] p-8 sm:p-10 text-center">
              <p className="mystic-kicker">AI 深度解读 · 商业专业版</p>
              <h3 className="mt-2 font-display text-2xl font-normal text-white sm:text-3xl">登录以保存本次起卦并解锁深度解读</h3>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[var(--ink-2)]">
                当前浏览器内的起卦已妥善保留。登录后可永久保存至您的账户历史，并开启十模块全面义理与决策深度剖析。
              </p>
              <div className="mt-6 flex justify-center">
                <Link href={signinHref} className="mystic-button">
                  登录并保存起卦
                </Link>
              </div>
            </div>
          ) : credits <= 0 ? (
            <div className="rounded-3xl border border-[var(--gold)]/30 bg-[rgba(235,178,85,0.05)] p-8 sm:p-10 text-center">
              <p className="mystic-kicker">AI 深度解读 · 商业专业版</p>
              <h3 className="mt-2 font-display text-2xl font-normal text-white sm:text-3xl">获取深度解读次数包</h3>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[var(--ink-2)]">
                深度解读涵盖核心摘要、卦象格局、动爻机理、走向推演、盲区防范及行动方向等十模块。单次消耗 1 次额度。
              </p>
              {actionError ? (
                <p className="mt-3 text-sm font-semibold text-[var(--danger)]">{actionError}</p>
              ) : null}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
                <button type="button" onClick={handleOpenPricing} className="mystic-button">
                  获取解读次数
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-[var(--gold)]/40 bg-gradient-to-b from-[rgba(235,178,85,0.09)] to-transparent p-8 sm:p-10 text-center shadow-xl">
              <p className="mystic-kicker">已拥有解读权益</p>
              <h3 className="mt-2 font-display text-2xl font-normal text-white sm:text-3xl">解锁本次起卦的 AI 深度解读</h3>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[var(--ink-2)]">
                您当前拥有 <strong className="text-[var(--gold-2)]">{credits}</strong> 次可用解读次数。生成将消耗 1 次额度，生成失败全额保留。
              </p>
              {actionError ? (
                <p className="mt-3 text-sm font-semibold text-[var(--danger)]">{actionError}</p>
              ) : null}
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={handleUnlockDeepReading}
                  className="mystic-button"
                >
                  立即解锁深度解读报告（消耗 1 次）
                </button>
              </div>
            </div>
          )}
        </section>
      </ReadingResultView>

      {clearError ? (
        <div
          role="alert"
          data-three-coin-clear-error={clearError}
          className="fixed bottom-5 left-1/2 z-50 w-[min(92vw,620px)] -translate-x-1/2 rounded-2xl border border-[rgba(239,129,112,0.42)] bg-[rgba(23,14,25,0.96)] px-5 py-4 shadow-2xl"
        >
          <p className="text-sm font-semibold text-[var(--danger)]">
            The sealed reading could not be cleared, so Quick I Ching kept this result open.
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-2)]">
            No new reading has started. You can retry the button after browser session storage becomes available.
          </p>
          <p className="mt-2 font-mono text-xs text-[var(--ink-3)]">{clearError}</p>
        </div>
      ) : null}
    </>
  );
}
