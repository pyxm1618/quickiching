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
 * Persistence ≠ Automatic Resume (C1) stays frozen: a passive entry never
 * restores an active cast. But a user who actively switches language mid-flow
 * must land on the same reading at the same partial stage. A one-shot
 * continuation intent bridges exactly that case and nothing else: it is not
 * reading state, it never auto-restores a new tab or a direct entry, and it
 * dies after one consumption or one TTL window.
 */

export const LOCALE_CONTINUATION_STORAGE_KEY = "quickiching:public-v1:locale-continuation";
export const LOCALE_CONTINUATION_TTL_MS = 60_000;
const LOCALE_CONTINUATION_SCHEMA_VERSION = 1 as const;
const LOCALE_CONTINUATION_MAX_SERIALIZED_BYTES = 512;
const ISSUED_AT_MAX_FUTURE_SKEW_MS = 5_000;

/**
 * The frozen minimal intent record. It carries only continuation intent —
 * never a question, cast lines, changes, drafts, hexagrams, completed
 * readings, payment or account data.
 */
export type LocaleContinuationRecord = {
  schemaVersion: typeof LOCALE_CONTINUATION_SCHEMA_VERSION;
  nonce: string;
  method: PublicReadingMethod;
  readingId: string;
  targetLocale: ContentLocale;
  issuedAt: number;
};

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
    // The monotonic fallback keeps the nonce unique without Web Crypto.
  }
  return `lc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const PUBLIC_READING_METHODS: readonly PublicReadingMethod[] = [
  "three-coin",
  "yarrow-stalks",
  "mei-hua-yi-shu",
  "manual",
];

function parseContinuationRecord(raw: string): LocaleContinuationRecord | null {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    if (record.schemaVersion !== LOCALE_CONTINUATION_SCHEMA_VERSION) return null;
    if (typeof record.nonce !== "string" || record.nonce.length === 0) return null;
    if (!PUBLIC_READING_METHODS.includes(record.method as PublicReadingMethod)) return null;
    if (typeof record.readingId !== "string" || record.readingId.trim().length === 0) return null;
    if (record.targetLocale !== "en" && record.targetLocale !== "zh-Hans") return null;
    if (typeof record.issuedAt !== "number" || !Number.isFinite(record.issuedAt)) return null;
    return {
      schemaVersion: LOCALE_CONTINUATION_SCHEMA_VERSION,
      nonce: record.nonce,
      method: record.method as PublicReadingMethod,
      readingId: record.readingId,
      targetLocale: record.targetLocale as ContentLocale,
      issuedAt: record.issuedAt,
    };
  } catch {
    return null;
  }
}

/**
 * Issues the one-shot continuation intent at an active-flow locale click.
 * A write failure is reported to the caller, which must cancel the locale
 * navigation rather than drop the active flow onto the other locale's entry.
 */
export function issueLocaleContinuationIntent(input: {
  method: PublicReadingMethod;
  readingId: string;
  targetLocale: ContentLocale;
}): boolean {
  try {
    const readingId = input.readingId.trim();
    if (!readingId) return false;
    const record: LocaleContinuationRecord = {
      schemaVersion: LOCALE_CONTINUATION_SCHEMA_VERSION,
      nonce: makeContinuationNonce(),
      method: input.method,
      readingId,
      targetLocale: input.targetLocale,
      issuedAt: Date.now(),
    };
    const serialized = JSON.stringify(record);
    if (serialized.length > LOCALE_CONTINUATION_MAX_SERIALIZED_BYTES) return false;
    continuationStorage().setItem(LOCALE_CONTINUATION_STORAGE_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

/**
 * One-shot consumption at the target flow surface:
 * read → validate → DELETE FIRST → return true.
 *
 * Every outcome — invalid schema, expiry, method mismatch, locale mismatch,
 * readingId mismatch — deletes the record and returns false so a bad intent
 * can never survive to hit a later entry. The readingId must equal this tab's
 * current authoritative method session id.
 */
export function consumeLocaleContinuation(input: {
  method: PublicReadingMethod;
  locale: ContentLocale;
  sessionId: string | null;
}): boolean {
  let raw: string | null = null;
  try {
    raw = continuationStorage().getItem(LOCALE_CONTINUATION_STORAGE_KEY);
    if (raw === null) return false;
  } catch {
    return false;
  }

  let valid = false;
  const record = parseContinuationRecord(raw);
  const now = Date.now();
  if (
    record !== null
    && input.sessionId !== null
    && input.sessionId.length > 0
    && record.method === input.method
    && record.targetLocale === input.locale
    && record.readingId === input.sessionId
    && now - record.issuedAt <= LOCALE_CONTINUATION_TTL_MS
    && record.issuedAt - now <= ISSUED_AT_MAX_FUTURE_SKEW_MS
  ) {
    valid = true;
  }

  try {
    continuationStorage().removeItem(LOCALE_CONTINUATION_STORAGE_KEY);
  } catch {
    // A failed delete cannot guarantee one-shot semantics; fail closed.
    return false;
  }
  return valid;
}

export function readLocaleContinuationRecord(): LocaleContinuationRecord | null {
  try {
    const raw = continuationStorage().getItem(LOCALE_CONTINUATION_STORAGE_KEY);
    return raw === null ? null : parseContinuationRecord(raw);
  } catch {
    return null;
  }
}

/**
 * The authoritative session identity used by the intent record and its
 * consumption check. It is the method session's own id — never a rendered or
 * synthesized value — so the continuation can only ever continue the exact
 * reading this tab is already holding.
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

/**
 * C9 — ephemeral, memory-only live-flow registration. It lets the global
 * locale switcher know whether a truly active flow exists. It holds at most
 * method / readingId / locale / active — never question, lines, changes,
 * draft, hexagram, completed or payment state — and it is not a global
 * reading manager.
 */
export type LiveFlowRegistration = {
  method: PublicReadingMethod;
  readingId: string;
  locale: ContentLocale;
  active: true;
};

let liveFlowRegistration: LiveFlowRegistration | null = null;

/**
 * Registers a live flow only after a fresh user-started active flow or an
 * explicit Resume / locale-continuation activation. Passive storage detection
 * must never register (C1).
 */
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

export function clearLiveFlowRegistration(): void {
  liveFlowRegistration = null;
}

export function getLiveFlowRegistration(): LiveFlowRegistration | null {
  return liveFlowRegistration;
}

/**
 * Registers from the authoritative method session. Boundaries call this on
 * fresh user-started activation and on explicit Resume / continuation
 * activation only.
 */
export function registerLiveFlowFromSession(method: PublicReadingMethod, locale: ContentLocale): void {
  const readingId = currentMethodSessionId(method);
  if (readingId) registerLiveFlow({ method, readingId, locale });
}

/**
 * Shared activation boundary for explicit Resume and locale continuation.
 *
 * Both paths end in the exact same R1 Resume / activation boundary owned by
 * each method surface (`requestResume` / `resume`); the only difference is
 * what authorizes activation: a Resume click, or a just-issued, exactly
 * validated one-shot continuation intent. The component ref guard keeps
 * `reactStrictMode`'s effect double-invocation from consuming twice and
 * resetting a just-activated flow, without weakening the one-shot semantics.
 */
export function useLocaleContinuationActivation(input: {
  method: PublicReadingMethod | null;
  locale: ContentLocale;
  activate: () => void;
}): void {
  const attemptedRef = useRef(false);
  const activateRef = useRef(input.activate);
  activateRef.current = input.activate;
  const { method, locale } = input;

  useEffect(() => {
    if (method === null) return;
    if (attemptedRef.current) return;
    attemptedRef.current = true;
    const sessionId = currentMethodSessionId(method);
    if (!sessionId) return;
    const continued = consumeLocaleContinuation({ method, locale, sessionId });
    if (continued) activateRef.current();
  }, [method, locale]);
}
