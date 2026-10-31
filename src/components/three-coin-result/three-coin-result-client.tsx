"use client";

import Link from "next/link";
import { Check, ArrowRight, UserRound } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import { buildPublicReading } from "@/domain/public-reading/reading";
import { RitualRevealTransition } from "@/components/public-reading/ritual-reveal-transition";
import { PublicReadingResult } from "@/components/public-reading/public-reading-result";
import { HexagramLines } from "@/components/hex/hexagram-lines";
import type { LocalizedReadingContent } from "@/content/mei-hua-yi-shu/types";
import type { HexagramInterpretationBundle } from "@/domain/interpretation/v2/types";
import { loadHexagramInterpretation } from "@/domain/interpretation/v2/load-interpretation";
import { EN_UI_DICTIONARY } from "@/i18n/dictionaries/en";
import { ZH_HANS_UI_DICTIONARY } from "@/i18n/dictionaries/zh-Hans";
import {
  deepReadingContextSnapshotSchema,
  readingReportSchema as activeReadingReportSchema,
  legacyDeepReadingReportSchema,
  type DeepReadingContextSnapshot,
} from "@/domain/generation/deep-reading-contract";
import {
  readingReportSchema as legacyReadingReportSchema,
  type CommercialReadingReport,
} from "@/domain/generation/schemas";
import {
  completedThreeCoinSteps,
  readThreeCoinSession,
} from "@/lib/three-coin-session";
import { buildPricingHref, buildResultSigninHref } from "@/lib/commercial-navigation";
import { evaluateRisk } from "@/domain/risk/engine";
import { AiDeepReadingResult, AiDeepReadingState } from "./ai-deep-reading-result";
import styles from "./result-page.module.css";
import { z } from "zod";
import { readCompletedPublicReading, publicReadingSaveInput, clearCompletedReadingForRestart } from "@/lib/completed-public-reading";
import type { PublicReading, PublicReadingMethod } from "@/domain/public-reading/types";
const readingReportSchema = z.union([activeReadingReportSchema, legacyDeepReadingReportSchema]);
type ReadableDeepReport = z.infer<typeof readingReportSchema>;

export type ResultState =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "ready"; lineValues: number[]; question?: string; createdAt?: string }
  | { kind: "error"; code: string };

export type ThreeCoinResultClientProps = {
  initialSessionId?: string;
  pageMode?: "free" | "deep";
  initialUser?: { id: string; email: string } | null;
  initialCredits?: number;
  locale?: "en" | "zh-Hans";
  initialState?: ResultState;
  initialInterpretationBundles?: { primary?: HexagramInterpretationBundle; relating?: HexagramInterpretationBundle | null };
  initialLocalizedContent?: LocalizedReadingContent;
  initialCastingView?: {
    castingId: string;
    method?: "three_coin" | "yarrow_stalk" | "mei_hua_current_time";
    algorithmVersion?: string;
    createdAt?: string;
    context: string;
    lineValuesBottomUp: number[] | null;
    readingReport: unknown;
    deepSnapshot?: unknown;
    owns: boolean;
  } | null;
};

type DeepStatus = "idle" | "generating" | "completed" | "failed";
type PersistenceStatus = "idle" | "saving" | "saved" | "error";
export type ResultRevealGate = "auth-required" | "saving" | "save-error" | "reveal";

export function getResultRevealGate(input: {
  authenticated: boolean;
  castingId: string | null;
  persistenceStatus: PersistenceStatus;
}): ResultRevealGate {
  if (!input.authenticated) return "auth-required";
  if (input.castingId && input.persistenceStatus === "saved") return "reveal";
  if (input.persistenceStatus === "error") return "save-error";
  return "saving";
}
type DeepReadingStatusPayload = {
  status: "not_started" | "queued" | "running" | "completed" | "failed" | "timed_out";
  output?: unknown;
  snapshot?: unknown;
  availableCredits?: unknown;
  errorCode?: string;
};

export function getTerminalCreditReconciliation(
  status: DeepReadingStatusPayload["status"],
  availableCredits: unknown,
  reservedCreditCastingId: string | null,
  targetCastingId: string,
): { authoritativeCredits: number | null; clearReservationRef: boolean } {
  if (status !== "failed" && status !== "timed_out") {
    return { authoritativeCredits: null, clearReservationRef: false };
  }
  const authoritativeCredits = typeof availableCredits === "number"
    && Number.isSafeInteger(availableCredits)
    && availableCredits >= 0
    ? availableCredits
    : null;
  return {
    authoritativeCredits,
    clearReservationRef: reservedCreditCastingId === targetCastingId,
  };
}

function errorCode(error: unknown): string {
  return error instanceof Error ? error.message : "THREE_COIN_READING_UNAVAILABLE";
}

export function hasRequiredInterpretationBundles(
  primaryHexagram: number,
  relatingHexagram: number | null,
  bundles?: { primary?: HexagramInterpretationBundle; relating?: HexagramInterpretationBundle | null },
): boolean {
  const primaryReady = bundles?.primary?.hexagram.number === primaryHexagram;
  const relatingReady = relatingHexagram === null
    ? bundles?.relating === null
    : bundles?.relating?.hexagram.number === relatingHexagram;
  return Boolean(primaryReady && relatingReady);
}

function currentBrowserReturnPath(): string {
  if (typeof window === "undefined") return "/readings/three-coin/result";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}


export function ThreeCoinResultClient({
  initialSessionId,
  pageMode = "free",
  initialUser = null,
  initialCredits = 0,
  initialInterpretationBundles,
  initialLocalizedContent,
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
  const [completedReading, setCompletedReading] = useState<PublicReading | null>(null);
  const [clearError, setClearError] = useState<string | null>(null);
  const [clientCastingId, setClientCastingId] = useState<string | null>(null);
  const [browserInterpretationBundles, setBrowserInterpretationBundles] = useState<
    { primary?: HexagramInterpretationBundle; relating?: HexagramInterpretationBundle | null } | undefined
  >(undefined);
  const [failedBrowserInterpretationKey, setFailedBrowserInterpretationKey] = useState<string | null>(null);

  const [castingId, setCastingId] = useState<string | null>(
    initialCastingView?.owns ? initialCastingView.castingId : null,
  );
  const [persistenceStatus, setPersistenceStatus] = useState<PersistenceStatus>(
    initialCastingView?.owns ? "saved" : "idle",
  );
  const [user] = useState<{ id: string; email: string } | null>(initialUser);
  const [credits, setCredits] = useState<number>(initialCredits);
  const ownedInitialCastingView = initialCastingView?.owns ? initialCastingView : null;
  const initialReport = readingReportSchema.safeParse(ownedInitialCastingView?.readingReport);
  const initialLegacyReport = legacyReadingReportSchema.safeParse(ownedInitialCastingView?.readingReport);
  const initialSnapshot = deepReadingContextSnapshotSchema.safeParse(ownedInitialCastingView?.deepSnapshot);
  const [deepStatus, setDeepStatus] = useState<DeepStatus>(initialReport.success || initialLegacyReport.success ? "completed" : "idle");
  const [deepReport, setDeepReport] = useState<ReadableDeepReport | null>(initialReport.success ? initialReport.data : null);
  const [legacyReport, setLegacyReport] = useState<CommercialReadingReport | null>(initialLegacyReport.success ? initialLegacyReport.data : null);
  const [deepSnapshot, setDeepSnapshot] = useState<DeepReadingContextSnapshot | null>(initialSnapshot.success ? initialSnapshot.data : null);
  const reservedCreditCastingRef = useRef<string | null>(null);
  const [legacyReadOnly, setLegacyReadOnly] = useState(initialSnapshot.success && initialSnapshot.data.schemaVersion === "deep-reading-context-v1");
  const [actionError, setActionError] = useState<string | null>(null);
  const deepRisk = useMemo(() => evaluateRisk(deepSnapshot?.coreQuestionAtCast ?? (state.kind === "ready" ? state.question ?? "" : "")), [state, deepSnapshot]);
  const deepRiskBlocked = deepRisk.status !== "allowed";
  const deepRiskMessage = deepRisk.status === "emergency_blocked"
    ? t("Deep Reading cannot handle an immediate safety crisis. If there is immediate danger, contact local emergency services now. In the U.S., call or text 988 for crisis support, or call 911 for immediate emergency help.", "深度解读无法处理紧急安全危机。如果存在即时危险，请立即联系当地紧急服务。在美国，可拨打或短信联系 988 获取危机支持；如需紧急救援请拨打 911。")
    : deepRisk.status === "needs_clarification"
      ? t("Deep Reading needs a clearer locked question before it can continue. Make the request more specific, then try again.", "深度解读需要更明确的锁定的问题后才能继续。请把请求说明得更具体，再重试。")
      : t("This question needs qualified professional support. Deep Reading is unavailable for this request; consult a qualified professional for medical, legal, or investment decisions.", "这个问题需要合格专业人士支持，本次无法提供深度解读。涉及医疗、法律或投资决策，请咨询相应的合格专业人士。");
  const resultReading = useMemo(() => {
    if (state.kind !== "ready") return null;
    const id = clientCastingId ?? castingId;
    if (completedReading) return completedReading;
    const method: PublicReadingMethod = initialCastingView?.method === "yarrow_stalk" ? "yarrow-stalks" : initialCastingView?.method === "mei_hua_current_time" ? "mei-hua-yi-shu" : "three-coin";
    return buildPublicReading({
      ...(id ? { id } : {}),
      ...(state.createdAt ? { createdAt: state.createdAt } : {}),
      method,
      methodVersion: initialCastingView?.algorithmVersion,
      question: state.question,
      lineValuesBottomUp: state.lineValues,
      evidence: { kind: "history", originalMethod: method },
    });
  }, [castingId, clientCastingId, state, completedReading, initialCastingView?.method, initialCastingView?.algorithmVersion]);
  const resultRevealGate = getResultRevealGate({
    authenticated: Boolean(user),
    castingId,
    persistenceStatus,
  });
  const revealAllowed = resultRevealGate === "reveal";
  const shouldDeferBrowserInterpretation = revealAllowed
    && !zh
    && initialState === undefined
    && initialCastingView === null
    && initialInterpretationBundles === undefined;
  const effectiveInterpretationBundles = initialInterpretationBundles ?? browserInterpretationBundles;
  const resultInterpretationKey = resultReading
    ? `${resultReading.id}:${resultReading.primaryHexagram}:${resultReading.relatingHexagram ?? "none"}`
    : null;
  const browserInterpretationReady = resultReading
    ? hasRequiredInterpretationBundles(
        resultReading.primaryHexagram,
        resultReading.relatingHexagram,
        effectiveInterpretationBundles,
      )
    : false;
  const browserInterpretationLoadFailed = resultInterpretationKey !== null
    && failedBrowserInterpretationKey === resultInterpretationKey;

  useEffect(() => {
    if (!shouldDeferBrowserInterpretation || !resultReading || browserInterpretationReady || !resultInterpretationKey) return;
    let active = true;
    void Promise.all([
      loadHexagramInterpretation(resultReading.primaryHexagram),
      resultReading.relatingHexagram === null
        ? Promise.resolve(null)
        : loadHexagramInterpretation(resultReading.relatingHexagram),
    ])
      .then(([primary, relating]) => {
        if (active) {
          setBrowserInterpretationBundles({ primary, relating });
          setFailedBrowserInterpretationKey(null);
        }
      })
      .catch(() => {
        if (active) setFailedBrowserInterpretationKey(resultInterpretationKey);
      });
    return () => {
      active = false;
    };
  }, [
    browserInterpretationReady,
    resultInterpretationKey,
    resultReading,
    shouldDeferBrowserInterpretation,
  ]);

  const waitingForBrowserInterpretation = shouldDeferBrowserInterpretation
    && state.kind === "ready"
    && resultReading !== null
    && !browserInterpretationReady
    && !browserInterpretationLoadFailed;

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRunRef = useRef(0);
  const pollInFlightRef = useRef(false);

  const stopPolling = useCallback(() => {
    pollRunRef.current += 1;
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    pollTimerRef.current = null;
  }, []);

  const startPolling = useCallback((targetCastingId: string) => {
    stopPolling();
    const runId = pollRunRef.current;
    let transientFailures = 0;

    const schedule = (delay: number) => {
      if (runId !== pollRunRef.current) return;
      pollTimerRef.current = setTimeout(() => { void poll(); }, delay);
    };

    const poll = async () => {
      pollTimerRef.current = null;
      if (runId !== pollRunRef.current) return;
      if (document.visibilityState === "hidden") {
        schedule(5000);
        return;
      }
      if (pollInFlightRef.current) {
        schedule(2000);
        return;
      }

      pollInFlightRef.current = true;
      let terminal = false;
      try {
        const res = await fetch(`/api/readings/${targetCastingId}/deep`);
        if (runId !== pollRunRef.current) return;
        if (!res.ok) {
          transientFailures += 1;
          return;
        }
        transientFailures = 0;
        const data = await res.json() as DeepReadingStatusPayload;
        if (data.errorCode === "LEGACY_DEEP_READING_READ_ONLY") setLegacyReadOnly(true);
        if (runId !== pollRunRef.current) return;
        const parsedSnapshot = deepReadingContextSnapshotSchema.safeParse(data.snapshot);
        if (parsedSnapshot.success) setDeepSnapshot(parsedSnapshot.data);
        const parsedReport = readingReportSchema.safeParse(data.output);
        if (data.status === "completed") {
          terminal = true;
          if (typeof data.availableCredits === "number" && Number.isInteger(data.availableCredits) && data.availableCredits >= 0) {
            setCredits(data.availableCredits);
          }
          if (parsedReport.success) {
            setDeepReport(parsedReport.data);
            setLegacyReport(null);
            setDeepStatus("completed");
          } else {
            const parsedLegacyReport = legacyReadingReportSchema.safeParse(data.output);
            if (parsedLegacyReport.success) {
              setLegacyReport(parsedLegacyReport.data);
              setDeepStatus("completed");
            } else {
              setDeepStatus("failed");
              setActionError(zh ? "已保存的报告格式无效，请联系支持；不会显示未验证内容。" : "The saved report format is invalid. Contact support; unverified content cannot be displayed.");
            }
          }
          if (reservedCreditCastingRef.current === targetCastingId) {
            reservedCreditCastingRef.current = null;
          }
        } else if (data.status === "failed" || data.status === "timed_out") {
          terminal = true;
          const creditReconciliation = getTerminalCreditReconciliation(
            data.status,
            data.availableCredits,
            reservedCreditCastingRef.current,
            targetCastingId,
          );
          if (creditReconciliation.authoritativeCredits !== null) {
            setCredits(creditReconciliation.authoritativeCredits);
          }
          if (creditReconciliation.clearReservationRef) {
            reservedCreditCastingRef.current = null;
          }
          setDeepStatus("failed");
          setActionError(zh
            ? "解读未能完成，已释放本次预留次数；重试会沿用锁定的问题与卦象。"
            : "The reading did not finish. Your reserved credit has been released; retrying uses the same locked question and cast.");
        }
      } catch {
        transientFailures += 1;
      } finally {
        pollInFlightRef.current = false;
        if (!terminal && runId === pollRunRef.current) {
          schedule(Math.min(2000 * (2 ** transientFailures), 8000));
        }
      }
    };

    schedule(2000);
  }, [stopPolling, zh]);

  useEffect(() => stopPolling, [stopPolling]);

  // 1. 初始化起卦数据（服务端优先 -> 本地 sessionStorage 降级）
  useEffect(() => {
    if (initialState) return;
    let active = true;

    async function init() {
      // 优先从服务端 initialCastingView 恢复
      if (
        initialCastingView?.owns &&
        initialCastingView.lineValuesBottomUp &&
        initialCastingView.lineValuesBottomUp.length === 6
      ) {
        if (active) {
          setState({
            kind: "ready",
            lineValues: initialCastingView.lineValuesBottomUp,
            question: initialCastingView.context || undefined,
            createdAt: initialCastingView.createdAt,
          });
        }
        return;
      }

      // 否则从本地 sessionStorage 恢复，同一个本地 session.id 就是本次起卦的稳定保存身份。
      const completed = readCompletedPublicReading(initialSessionId);
      if (completed) {
        if (active) {
          setCompletedReading(completed);
          setClientCastingId(completed.id);
          setState({kind: "ready", lineValues: [...completed.lineValuesBottomUp], question: completed.question, createdAt: completed.createdAt});
        }
        return;
      }
      const localSession = readThreeCoinSession();
      const completedSteps = initialSessionId && localSession?.id !== initialSessionId ? null : completedThreeCoinSteps(localSession?.data?.steps ?? []);
      if (!completedSteps) {
        if (active) setState({ kind: "empty" });
        return;
      }

      const lineValues = completedSteps.map((s) => s.lineValue);

      if (active) {
        setClientCastingId(localSession?.id ?? null);
        setState({
          kind: "ready",
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
  }, [initialCastingView, initialState, initialSessionId]);

  async function persistCurrentReading(showError: boolean): Promise<string | null> {
    if (castingId) {
      setPersistenceStatus("saved");
      return castingId;
    }
    if (state.kind !== "ready" || !clientCastingId) {
      setPersistenceStatus("error");
      if (showError) setActionError(t("Could not save this completed cast. The same six lines remain preserved for retry.", "无法保存这次已完成起卦；当前六爻会保持不变，可以重试。"));
      return null;
    }

    setPersistenceStatus("saving");
    if (showError) setActionError(null);

    try {
      const res = await fetch("/api/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(completedReading ? publicReadingSaveInput(completedReading) : {
          clientCastingId,
          lineValuesBottomUp: state.lineValues,
          question: state.question,
        }),
      });

      if (res.status === 401) {
        setPersistenceStatus("idle");
        window.location.assign(resultSigninHref());
        return null;
      }
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({})) as { error?: string };
        setPersistenceStatus("error");
        if (errorBody.error === "QUESTION_LOCKED") {
          setActionError(t(
            "This completed cast could not be saved because the existing 72-hour question lock rejected it. The current cast remains unchanged and is not revealed.",
            "现有 72 小时问题锁拒绝了这次已完成起卦的保存。当前六爻会保持不变，也不会提前揭示结果。",
          ));
        } else if (showError) {
          setActionError(t("Could not save this reading. Please try again.", "保存本次起卦失败，请稍后重试。"));
        }
        return null;
      }

      const data = await res.json() as { castingId?: string };
      if (!data.castingId) {
        setPersistenceStatus("error");
        if (showError) setActionError(t("Could not save this reading. Please try again later.", "保存本次起卦失败，请稍后重试。"));
        return null;
      }

      setCastingId(data.castingId);
      setPersistenceStatus("saved");
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set("session", data.castingId);
      window.history.replaceState(null, "", currentUrl.toString());
      return data.castingId;
    } catch {
      setPersistenceStatus("error");
      if (showError) setActionError(t("Network connection failed. Please try again.", "网络连接失败，请重试。"));
      return null;
    }
  }

  // 2. 登录返回后或已登录完成第六爻后，先幂等保存同一 completed cast；保存成功前绝不 reveal。
  useEffect(() => {
    if (!user || castingId || state.kind !== "ready" || !clientCastingId || persistenceStatus !== "idle") return;
    void persistCurrentReading(false);
    // persistCurrentReading intentionally follows the current render state; these are its save prerequisites.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, castingId, state, clientCastingId, persistenceStatus]);

  // Restore the paid result and the exact encrypted input snapshot for this account.
  useEffect(() => {
    const activeId = castingId;
    if (!activeId || !user || pageMode !== "deep") return;

    let active = true;

    async function checkDeepStatus() {
      try {
        const res = await fetch(`/api/readings/${activeId}/deep`);
        if (!res.ok) return;
        const data = await res.json() as DeepReadingStatusPayload;
        if (data.errorCode === "LEGACY_DEEP_READING_READ_ONLY") setLegacyReadOnly(true);
        if (!active) return;
        const parsedSnapshot = deepReadingContextSnapshotSchema.safeParse(data.snapshot);
        if (parsedSnapshot.success) {
          const snapshot = parsedSnapshot.data;
          setDeepSnapshot(snapshot);

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
          } else {
            setDeepStatus("failed");
            setActionError(t("The saved report format is invalid. Contact support.", "已保存的报告格式无效，请联系支持。"));
          }
        } else if (data.status === "queued" || data.status === "running") {
          setDeepStatus("generating");
          if (activeId) startPolling(activeId);
        } else if (data.status === "failed" || data.status === "timed_out") {
          const creditReconciliation = getTerminalCreditReconciliation(
            data.status,
            data.availableCredits,
            reservedCreditCastingRef.current,
            activeId!,
          );
          if (creditReconciliation.authoritativeCredits !== null) {
            setCredits(creditReconciliation.authoritativeCredits);
          }
          if (creditReconciliation.clearReservationRef) {
            reservedCreditCastingRef.current = null;
          }
          setDeepStatus("failed");
        }
      } catch {
        if (active) setActionError(t("Could not load the saved reading status. Reload before retrying.", "无法读取已保存状态，请刷新后再重试。"));
      }
    }

    void checkDeepStatus();

    return () => {
      active = false;
    };
  // Restore once per casting; polling owns subsequent status changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [castingId, startPolling, user, pageMode]);

  async function handleUnlockDeepReading() {
    if (state.kind !== "ready") return;
    setActionError(null);
    if (deepRiskBlocked) return;

    if (!state.question?.trim()) {
      setActionError(t("This cast has no core question. Start a new reading and enter one before the first cast.", "这次起卦没有绑定核心问题。请重新起卦，并在第一次起爻前填写问题。"));
      return;
    }

    const activeCastingId = await persistCurrentReading(true);
    if (!activeCastingId) return;

    setDeepStatus("generating");

    try {
      const res = await fetch(`/api/readings/${activeCastingId}/deep`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
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
        setDeepStatus(error.error === "RISK_PROHIBITED" || error.error === "RISK_NEEDS_CLARIFICATION" ? "idle" : "failed");
        if (error.error === "LEGACY_DEEP_READING_READ_ONLY") setLegacyReadOnly(true);
        const message = error.error === "RISK_NEEDS_CLARIFICATION"
          ? t("Clarify the locked question before requesting Deep Reading. No credit was reserved.", "请先把锁定的问题说明得更明确，再请求深度解读；本次未预留次数。")
          : error.error === "RISK_PROHIBITED"
            ? t("This question needs qualified professional support, so generation was blocked and no credit was reserved.", "这个问题需要合格专业人士支持，因此系统已阻止生成，未预留次数。")
            : t("The request could not start. Check the saved status before retrying.", "暂时无法发起请求；重试前请先检查已保存状态。");
        setActionError(message);
        return;
      }

      const data = await res.json() as {
        status: "queued" | "running" | "completed" | "timed_out";
        output?: unknown;
        snapshot?: unknown;
        creditReservationCreated?: boolean;
      };

      const parsedSnapshot = deepReadingContextSnapshotSchema.safeParse(data.snapshot);
      if (parsedSnapshot.success) setDeepSnapshot(parsedSnapshot.data);
      if (data.creditReservationCreated) {
        reservedCreditCastingRef.current = activeCastingId;
      }
      const parsedReport = readingReportSchema.safeParse(data.output);
      if (data.status === "completed" && parsedReport.success) {
        setDeepReport(parsedReport.data);
        setLegacyReport(null);
        setDeepStatus("completed");
        reservedCreditCastingRef.current = null;
      } else if (data.status === "completed") {
        const parsedLegacyReport = legacyReadingReportSchema.safeParse(data.output);
        if (parsedLegacyReport.success) {
          setLegacyReport(parsedLegacyReport.data);
          setDeepStatus("completed");
        } else {
          setDeepStatus("failed");
          setActionError(t("The saved report format is invalid. Contact support.", "已保存的报告格式无效，请联系支持。"));
        }
      } else if (data.status === "timed_out") {
        setDeepStatus("failed");
        setActionError(t("The previous generation timed out and its reserved credit was released. You may retry.", "上一次生成已超时，预留次数已释放；你可以重试。"));
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
    if (deepRiskBlocked) return;
    const activeCastingId = await persistCurrentReading(true);
    if (!activeCastingId) return;

    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set("session", activeCastingId);
    const returnPath = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
    window.location.assign(pricingHref(returnPath));
  }

  function startNewReading() {
    try {
      const nextHref = clearCompletedReadingForRestart(resultReading?.method ?? "three-coin", zh);
      setClearError(null);
      window.location.assign(nextHref);
    } catch (error: unknown) {
      setClearError(errorCode(error));
    }
  }

  if (state.kind === "loading") {
    return (
      <div
        className={`${styles.page} mx-auto min-h-[100svh] w-full max-w-[1180px] px-4 sm:px-6`}
        data-reading-interpretation-loading={waitingForBrowserInterpretation ? "true" : undefined}
      >
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

  if (!revealAllowed) {
    const gateState = resultRevealGate;
    return (
      <RitualRevealTransition stage="gate"><div
        className="ritual-save-gate"
        data-completed-cast-gate={gateState}
        data-visual-status="in-development"
      >
        <section className="ritual-gate-card" aria-labelledby="completed-cast-title">
          <div className="ritual-gate-complete-mark" aria-hidden="true"><Check /></div>
          <p className="ritual-gate-complete">{t("Your six lines are complete", "六爻已经完成")}</p>
          <h1 id="completed-cast-title">{t("Save Your Reading", "保存本次起卦")}</h1>
          <p className="ritual-gate-description">{!user ? <>{t("Sign in to save this reading and", "登录以保存本次起卦，")}<br />{t("continue to view the full result.", "继续查看完整结果。")}</> : t("Your completed cast is preserved while it is saved to History.", "保存到历史记录期间，同一份已完成起卦始终保留。")}</p>
          <div className="sr-only" data-completed-six-lines><HexagramLines lines={state.lineValues} sealedCount={6} size="lg" showLabels locale={locale} /></div>

          {!user ? (
            <div key="auth-required" className="ritual-gate-action" data-auth-required-before-reveal>
              <Link href={signinHref} prefetch={false} className="ritual-gate-signin" onClick={(event) => { if (event.currentTarget.closest(".ritual-gate-card")?.getAnimations().some(animation => animation.playState === "running")) event.preventDefault(); }} aria-label={t("Sign in to save and reveal this reading", "登录、保存并查看本次卦象")}>
                <UserRound aria-hidden="true" />{t("Sign In to Save & Reveal", "登录、保存并查看")}<ArrowRight aria-hidden="true" />
              </Link>
            </div>
          ) : persistenceStatus === "error" ? (
            <div key="save-error" className="ritual-gate-action ritual-gate-error" data-history-save-error role="alert">
              <p className="text-sm leading-7 text-[var(--danger)]">
                {actionError ?? t(
                  "Saving failed. The same completed cast is still preserved and has not been revealed.",
                  "保存失败。同一份已完成起卦仍然保留，结果尚未揭示。",
                )}
              </p>
              <button type="button" className="mystic-button mt-5" onClick={() => void persistCurrentReading(true)} data-retry-history-save>
                {t("Retry saving this cast", "重试保存本次起卦")}
              </button>
            </div>
          ) : (
            <div key="saving" className="ritual-gate-action" role="status" data-history-saving>
              <p className="text-sm leading-7 text-[var(--ink-2)]">
                {t("Saving this completed cast to your account History before reveal…", "正在先把这次已完成起卦保存到账户历史记录…")}
              </p>
            </div>
          )}
        </section>
      </div></RitualRevealTransition>
    );
  }

  if (waitingForBrowserInterpretation) {
    return <RitualRevealTransition stage="gate"><div className="ritual-save-gate" data-reading-interpretation-loading="true" data-result-reveal-pending="true">
      <section className="ritual-gate-card" role="status" aria-label={t("Preparing your saved reading", "正在准备已保存的起卦结果")}>
        <p className="ritual-gate-complete">{t("Saved to History", "已保存到 History")}</p>
        <h1>{t("Preparing your reading…", "正在准备结果揭示…")}</h1>
      </section>
    </div></RitualRevealTransition>;
  }

  const prefix = zh ? "/zh" : "";
  const freeHref = `${prefix}/readings/result?session=${encodeURIComponent(castingId!)}`;
  const deepHref = `${prefix}/readings/deep?session=${encodeURIComponent(castingId!)}`;
  const deepQuestion = deepSnapshot?.coreQuestionAtCast
    ?? (state.kind === "ready" ? state.question : undefined)
    ?? initialCastingView?.context
    ?? "";
  const deepCreatedAt = initialCastingView?.createdAt
    ?? (state.kind === "ready" ? state.createdAt : undefined)
    ?? deepSnapshot?.snapshotAt;

  const deepBody = deepStatus === "completed" && (deepReport || legacyReport) ? (
    <AiDeepReadingResult
      report={deepReport ?? legacyReport!}
      snapshot={deepSnapshot}
      question={deepQuestion}
      createdAt={deepCreatedAt}
      locale={locale}
      freeHref={freeHref}
    />
  ) : (
    <AiDeepReadingState
      question={deepQuestion}
      createdAt={deepCreatedAt}
      locale={locale}
      freeHref={freeHref}
    >
      {deepStatus === "generating" ? <div role="status" data-deep-reading-state="generating">
        {t("Reading your locked question and this cast…", "正在解读你锁定的问题与本次卦象…")}
      </div> : deepRiskBlocked ? <div role="status" data-deep-reading-blocked="risk">{deepRiskMessage}</div>
      : legacyReadOnly ? <p data-legacy-reading-read-only>{t("This earlier generation is read only and cannot be restarted. Start a new cast to request a new Deep Reading.", "旧版生成仅保留只读，无法重新生成。如需新版深度解读，请重新起卦。")}</p>
      : !deepQuestion.trim() ? <p data-deep-reading-blocked="missing-question">{t("This historical cast has no locked question. Start a new cast with a question to use Deep Reading.", "这次历史起卦没有锁定的问题。如需深度解读，请带着问题重新起卦。")}</p>
      : credits <= 0 ? <div>
        <button type="button" onClick={handleOpenPricing} className="mystic-button">{t("Choose a Deep Reading pack", "选择深度解读次数包")}</button>
        <p>{t("No generation starts until a credit is available.", "获得次数前不会启动生成。")}</p>
      </div> : <div>
        <button type="button" onClick={handleUnlockDeepReading} className="mystic-button" data-start-deep-reading>{deepStatus === "failed" ? t("Retry this reading", "重试本次解读") : t("Get My Deep Reading", "获取我的深度解读")}</button>
        <p>{t(`${credits} credits available. One reserved per generation; released on failure.`, `可用 ${credits} 次；每次生成预留 1 次，失败释放。`)}</p>
      </div>}
      {actionError ? <p role="alert">{actionError}</p> : null}
    </AiDeepReadingState>
  );

  return (
    <RitualRevealTransition stage="result">
      {pageMode === "free" ? <PublicReadingResult
        presentation="ritual"
        reading={resultReading!}
        onNewReading={startNewReading}
        dictionary={resultDictionary}
        localizedContent={zh ? initialLocalizedContent : undefined}
        initialBundles={effectiveInterpretationBundles}
        title={t("Your Free Reading", "免费解卦")}
        headingLevel="h1"
        deepReadingHref={deepHref}
        newReadingLabel={t("Start a New Reading", "重新起一卦")}
      /> : deepBody}


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
    </RitualRevealTransition>
  );
}
