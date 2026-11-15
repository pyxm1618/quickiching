import { useEffect, useRef } from "react";
import type { PublicReadingMethod } from "@/domain/public-reading/types";
import type { ContentLocale } from "@/i18n/config";
import { completedThreeCoinSteps, readThreeCoinQuestionState, readThreeCoinSession } from "@/lib/three-coin-session";
import { readPublicReadingSession, readPublicReadingSessionState } from "@/lib/public-reading-session";
import {
  MANUAL_SESSION_STORAGE_KEY,
  MEI_HUA_SESSION_STORAGE_KEY,
  YARROW_SESSION_STORAGE_KEY,
} from "@/lib/method-session-retirement";
import { readManualCastDraft } from "@/lib/manual-cast-draft";

/**
 * C1 — Passive Resume Authority.
 *
 * Persistence is not automatic resume, and a passive restore is not UI stage
 * authority. Every method component asks this owner what is resumable, renders
 * its normal entry state, and only restores the exact partial state after an
 * explicit user Resume action.
 */

export type ReadingResumeUnit = "lines" | "changes" | "steps" | "draft";

export type ReadingResumePartial = {
  completed: number;
  total: number;
  unit: ReadingResumeUnit;
};

export type ReadingResumeStage = "question-confirm" | "ritual" | "draft";

export type ReadingResumeState =
  | { kind: "none" }
  | {
      kind: "partial";
      method: PublicReadingMethod;
      readingId: string;
      progress: ReadingResumePartial;
      stage?: ReadingResumeStage;
    }
  | {
      /** A completed-but-not-durable cast. Never resumable; handoff retry only. */
      kind: "sealed";
      method: PublicReadingMethod;
      readingId: string;
    };

export const NO_READING_RESUME: ReadingResumeState = { kind: "none" };

/**
 * The single resume decision rule used by all four methods.
 *
 * Sealed completion outranks any leftover draft: a completed cast must never be
 * presented as a resumable partial casting flow.
 */
export function decideReadingResume(input: {
  method: PublicReadingMethod;
  partial: ReadingResumePartial | null;
  partialReadingId?: string | null;
  sealedReadingId?: string | null;
  stage?: ReadingResumeStage;
}): ReadingResumeState {
  const sealedId = input.sealedReadingId?.trim();
  if (sealedId) return { kind: "sealed", method: input.method, readingId: sealedId };

  const partialId = input.partialReadingId?.trim();
  const partial = input.partial;
  if (!partialId || !partial) return NO_READING_RESUME;
  if (!Number.isFinite(partial.completed) || !Number.isFinite(partial.total)) return NO_READING_RESUME;
  if (partial.total <= 0) return NO_READING_RESUME;
  if (partial.unit === "draft") {
    return { kind: "partial", method: input.method, readingId: partialId, progress: partial, stage: "draft" };
  }
  if (partial.completed <= 0 && input.stage !== "question-confirm") return NO_READING_RESUME;
  if (partial.completed >= partial.total) return NO_READING_RESUME;

  return {
    kind: "partial",
    method: input.method,
    readingId: partialId,
    progress: partial,
    ...(input.stage ? { stage: input.stage } : {}),
  };
}

/** Three Coin adapter: 1..5 stored lines are resumable, 6 are sealed completion. */
export function threeCoinResumeState(): ReadingResumeState {
  try {
    const session = readThreeCoinSession();
    if (!session) return NO_READING_RESUME;
    const steps = session.data?.steps ?? [];
    if (completedThreeCoinSteps(steps)) {
      return { kind: "sealed", method: "three-coin", readingId: session.id };
    }
    const questionState = readThreeCoinQuestionState();
    if (steps.length === 0 && !questionState.started && !questionState.question) return NO_READING_RESUME;
    return {
      kind: "partial",
      method: "three-coin",
      readingId: session.id,
      progress: {
        completed: steps.length,
        total: 6,
        unit: "lines",
      },
      stage: questionState.coreQuestionFrozenAtCast || steps.length > 0 ? "ritual" : "question-confirm",
    };
  } catch {
    return NO_READING_RESUME;
  }
}

/** Yarrow adapter: 1..17 stored changes are resumable, 18 are sealed completion. */
export function yarrowResumeState(): ReadingResumeState {
  try {
    const session = readPublicReadingSession(YARROW_SESSION_STORAGE_KEY, (value): { changes: readonly unknown[] } | null => {
      const raw = Array.isArray(value)
        ? value
        : value && typeof value === "object" && Array.isArray((value as { changes?: unknown }).changes)
          ? (value as { changes: unknown[] }).changes
          : null;
      if (!raw || raw.length > 18) return null;
      if (!raw.every((entry) => entry !== null && typeof entry === "object"
        && Number.isInteger((entry as { lineIndex?: unknown }).lineIndex)
        && Number.isInteger((entry as { changeIndex?: unknown }).changeIndex))) return null;
      return { changes: raw };
    });
    if (!session) return NO_READING_RESUME;
    const count = session.data?.changes.length ?? 0;
    return decideReadingResume({
      method: "yarrow-stalks",
      partial: { completed: count, total: 18, unit: "changes" },
      partialReadingId: session.id,
      sealedReadingId: count === 18 ? session.id : null,
      stage: count > 0 ? "ritual" : "question-confirm",
    });
  } catch {
    return NO_READING_RESUME;
  }
}

/** Manual adapter: sealed facts are recovery-only; a saved draft is resumable. */
export function manualResumeState(): ReadingResumeState {
  try {
    const session = readPublicReadingSession(MANUAL_SESSION_STORAGE_KEY, (value): { sealed: true } | null => {
      if (!value || typeof value !== "object") return null;
      const candidate = value as { mode?: unknown; lineValuesBottomUp?: unknown };
      const validMode = candidate.mode === "line-values" || candidate.mode === "primary-changing";
      return validMode && Array.isArray(candidate.lineValuesBottomUp) && candidate.lineValuesBottomUp.length === 6
        ? { sealed: true }
        : null;
    });
    if (session?.data) {
      return decideReadingResume({ method: "manual", partial: null, sealedReadingId: session.id });
    }
    const question = readPublicReadingSessionState(MANUAL_SESSION_STORAGE_KEY).question;
    const draft = readManualCastDraft(question ?? null);
    return decideReadingResume({
      method: "manual",
      partial: draft ? { completed: 0, total: 1, unit: "draft" } : null,
      partialReadingId: draft ? "manual-draft" : null,
      stage: "draft",
    });
  } catch {
    return NO_READING_RESUME;
  }
}

/** One detection owner for QuestionFirst-wrapped methods. */
export function detectMethodResume(method?: PublicReadingMethod | null): ReadingResumeState {
  if (method === "yarrow-stalks") return yarrowResumeState();
  if (method === "manual") return manualResumeState();
  return NO_READING_RESUME;
}

export function resumeProgressLabel(state: ReadingResumeState, zh: boolean): string {
  if (state.kind !== "partial") return "";
  const { completed, total, unit } = state.progress;
  if (unit === "draft") return zh ? "已保存的草稿" : "saved draft";
  if (state.stage === "question-confirm" && completed === 0) return zh ? "已保存问题" : "question saved";
  if (unit === "changes") return zh ? `${completed} / ${total} 变` : `${completed} / ${total} changes`;
  if (unit === "steps") return zh ? `第 ${completed} / ${total} 步` : `step ${completed} / ${total}`;
  return zh ? `${completed} / ${total} 爻` : `${completed} / ${total} lines`;
}


/**
 * C9 — Active-Flow Locale Continuation Intent.
 *
 * R1 C1 remains authoritative: persisted progress is passive until an explicit
 * activation boundary runs. This one-shot intent exists only to distinguish an
 * explicit locale switch made from a currently active flow from a refresh,
 * direct open, or a modified-click new tab.
 */
export const LOCALE_CONTINUATION_STORAGE_KEY = "quickiching:public-v1:locale-continuation";
export const LOCALE_CONTINUATION_TTL_MS = 60_000;
const LOCALE_CONTINUATION_SCHEMA_VERSION = 1 as const;
const CONTINUATION_RECORD_KEYS = [
  "issuedAt",
  "method",
  "nonce",
  "readingId",
  "schemaVersion",
  "targetLocale",
] as const;

export type LocaleContinuationRecord = {
  schemaVersion: typeof LOCALE_CONTINUATION_SCHEMA_VERSION;
  nonce: string;
  method: PublicReadingMethod;
  readingId: string;
  targetLocale: ContentLocale;
  issuedAt: number;
};

const PUBLIC_READING_METHODS: readonly PublicReadingMethod[] = [
  "three-coin",
  "yarrow-stalks",
  "mei-hua-yi-shu",
  "manual",
];

let continuationNonceCounter = 0;

function continuationStorage(): Storage {
  if (typeof window === "undefined" || !window.sessionStorage) {
    throw new Error("LOCALE_CONTINUATION_UNAVAILABLE");
  }
  return window.sessionStorage;
}

function makeContinuationNonce(): string {
  try {
    if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  } catch {
    // A per-runtime monotonic suffix is sufficient for this short-lived intent.
  }
  continuationNonceCounter += 1;
  return "lc-" + Date.now().toString(36) + "-" + continuationNonceCounter.toString(36);
}

function parseContinuationRecord(raw: string): LocaleContinuationRecord | null {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    if (keys.length !== CONTINUATION_RECORD_KEYS.length
      || keys.some((key, index) => key !== CONTINUATION_RECORD_KEYS[index])) return null;
    if (record.schemaVersion !== LOCALE_CONTINUATION_SCHEMA_VERSION) return null;
    if (typeof record.nonce !== "string" || record.nonce.length === 0 || record.nonce.length > 128) return null;
    if (!PUBLIC_READING_METHODS.includes(record.method as PublicReadingMethod)) return null;
    if (typeof record.readingId !== "string" || record.readingId.trim().length === 0 || record.readingId.length > 256) return null;
    if (record.targetLocale !== "en" && record.targetLocale !== "zh-Hans") return null;
    if (typeof record.issuedAt !== "number" || !Number.isFinite(record.issuedAt)) return null;
    return {
      schemaVersion: LOCALE_CONTINUATION_SCHEMA_VERSION,
      nonce: record.nonce,
      method: record.method as PublicReadingMethod,
      readingId: record.readingId,
      targetLocale: record.targetLocale,
      issuedAt: record.issuedAt,
    };
  } catch {
    return null;
  }
}

export function issueLocaleContinuationIntent(input: {
  method: PublicReadingMethod;
  readingId: string;
  targetLocale: ContentLocale;
}): boolean {
  try {
    const readingId = input.readingId.trim();
    if (!readingId || readingId.length > 256) return false;
    const record: LocaleContinuationRecord = {
      schemaVersion: LOCALE_CONTINUATION_SCHEMA_VERSION,
      nonce: makeContinuationNonce(),
      method: input.method,
      readingId,
      targetLocale: input.targetLocale,
      issuedAt: Date.now(),
    };
    continuationStorage().setItem(LOCALE_CONTINUATION_STORAGE_KEY, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

/**
 * One-shot semantics are deliberately destructive:
 * read -> validate -> DELETE FIRST -> return.
 * Any malformed, expired, or mismatched intent is deleted and fails closed.
 */
export function consumeLocaleContinuation(input: {
  method: PublicReadingMethod;
  locale: ContentLocale;
  sessionId: string | null;
}): boolean {
  let raw: string | null;
  try {
    raw = continuationStorage().getItem(LOCALE_CONTINUATION_STORAGE_KEY);
  } catch {
    return false;
  }
  if (raw === null) return false;

  const record = parseContinuationRecord(raw);
  const now = Date.now();
  const valid = record !== null
    && input.sessionId !== null
    && input.sessionId.length > 0
    && record.method === input.method
    && record.readingId === input.sessionId
    && record.targetLocale === input.locale
    && now >= record.issuedAt
    && now - record.issuedAt <= LOCALE_CONTINUATION_TTL_MS;

  try {
    continuationStorage().removeItem(LOCALE_CONTINUATION_STORAGE_KEY);
  } catch {
    // One-shot deletion is part of the authorization. If deletion cannot be
    // proven, continuation is not authorized.
    return false;
  }
  return valid;
}

/** Read-only test/diagnostic view; it never authorizes continuation. */
export function readLocaleContinuationRecord(): LocaleContinuationRecord | null {
  try {
    const raw = continuationStorage().getItem(LOCALE_CONTINUATION_STORAGE_KEY);
    return raw === null ? null : parseContinuationRecord(raw);
  } catch {
    return null;
  }
}

/**
 * Exact authoritative identity for the current method session. This never
 * guesses from a rendered result or chooses a "latest" reading.
 */
export function currentMethodSessionId(method: PublicReadingMethod): string | null {
  try {
    if (method === "three-coin") return readThreeCoinSession()?.id ?? null;
    const key = method === "yarrow-stalks"
      ? YARROW_SESSION_STORAGE_KEY
      : method === "mei-hua-yi-shu"
        ? MEI_HUA_SESSION_STORAGE_KEY
        : MANUAL_SESSION_STORAGE_KEY;
    const session = readPublicReadingSession(key, (value) => ({ raw: value }));
    return session?.id ?? null;
  } catch {
    return null;
  }
}

export type LiveFlowRegistration = {
  method: PublicReadingMethod;
  readingId: string;
  locale: ContentLocale;
  active: true;
};

let liveFlowRegistration: LiveFlowRegistration | null = null;

export function registerLiveFlow(input: {
  method: PublicReadingMethod;
  readingId: string;
  locale: ContentLocale;
}): void {
  const readingId = input.readingId.trim();
  if (!readingId) return;
  liveFlowRegistration = {
    method: input.method,
    readingId,
    locale: input.locale,
    active: true,
  };
}

export function registerLiveFlowFromSession(method: PublicReadingMethod, locale: ContentLocale): void {
  const readingId = currentMethodSessionId(method);
  if (readingId) registerLiveFlow({ method, readingId, locale });
}

export function getLiveFlowRegistration(): LiveFlowRegistration | null {
  return liveFlowRegistration ? { ...liveFlowRegistration } : null;
}

export function clearLiveFlowRegistration(): void {
  liveFlowRegistration = null;
}

function clearLiveFlowRegistrationForLocale(locale: ContentLocale): void {
  if (liveFlowRegistration?.locale === locale) liveFlowRegistration = null;
}

/**
 * StrictMode-safe unmount cleanup. React's development Strict Mode performs a
 * setup -> cleanup -> setup probe; the microtask/generation guard prevents
 * that probe from clearing a still-mounted flow. The locale guard also stops
 * the old locale's unmount from clearing a newly activated target-locale flow.
 */
export function useLiveFlowUnmountCleanup(locale: ContentLocale): void {
  const generationRef = useRef(0);
  useEffect(() => {
    generationRef.current += 1;
    const generation = generationRef.current;
    return () => {
      queueMicrotask(() => {
        if (generationRef.current === generation) clearLiveFlowRegistrationForLocale(locale);
      });
    };
  }, [locale]);
}

export type LocaleContinuationClickDecision = "ignore" | "cancel" | "navigate";

/**
 * Only an unmodified primary-button click can authorize C9. Modified/middle
 * activation remains ordinary browser behavior and never writes an intent.
 * If an active-flow write fails, navigation is cancelled fail-closed.
 */
export function prepareLocaleContinuationClick(input: {
  event: {
    button: number;
    metaKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
  };
  targetLocale: ContentLocale;
  liveFlow: LiveFlowRegistration | null;
  issueIntent: (intent: {
    method: PublicReadingMethod;
    readingId: string;
    targetLocale: ContentLocale;
  }) => boolean;
}): LocaleContinuationClickDecision {
  const { event } = input;
  const plainLeftClick = event.button === 0
    && !event.metaKey
    && !event.ctrlKey
    && !event.shiftKey
    && !event.altKey;
  if (!plainLeftClick) return "ignore";

  const live = input.liveFlow;
  if (!live?.active || live.locale === input.targetLocale) return "navigate";
  return input.issueIntent({
    method: live.method,
    readingId: live.readingId,
    targetLocale: input.targetLocale,
  }) ? "navigate" : "cancel";
}

/**
 * Validated locale continuation and explicit Resume converge on the same
 * method-owned activation callback. The key guard permits a future locale
 * transition while preventing React Strict Mode from consuming a one-shot
 * record twice for the same method/locale mount.
 */
export function useLocaleContinuationActivation(input: {
  method: PublicReadingMethod | null;
  locale: ContentLocale;
  activate: () => void;
}): void {
  const attemptedKeyRef = useRef<string | null>(null);
  const activateRef = useRef(input.activate);
  activateRef.current = input.activate;
  const { method, locale } = input;

  useEffect(() => {
    if (method === null) return;
    const attemptKey = method + ":" + locale;
    if (attemptedKeyRef.current === attemptKey) return;
    attemptedKeyRef.current = attemptKey;
    const sessionId = currentMethodSessionId(method);
    if (!sessionId) return;
    if (consumeLocaleContinuation({ method, locale, sessionId })) {
      activateRef.current();
    }
  }, [method, locale]);
}
