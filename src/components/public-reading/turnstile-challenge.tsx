"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

type TurnstileWidgetId = string | number;
type TurnstileOptions = {
  sitekey: string;
  size: "invisible";
  execution: "execute";
  action: string;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileOptions) => TurnstileWidgetId;
  execute: (widgetId: TurnstileWidgetId) => void;
  reset: (widgetId: TurnstileWidgetId) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export type TurnstileChallengeHandle = {
  getToken: (signal?: AbortSignal) => Promise<string | null>;
  cancel: () => void;
};

const TURNSTILE_SCRIPT_SELECTOR = "script[data-quickiching-turnstile]";
let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(TURNSTILE_SCRIPT_SELECTOR);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("TURNSTILE_SCRIPT_FAILED")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.quickichingTurnstile = "true";
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("TURNSTILE_SCRIPT_FAILED")), { once: true });
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export const TurnstileChallenge = forwardRef<TurnstileChallengeHandle, { siteKey?: string }>(function TurnstileChallenge({ siteKey }, ref) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<TurnstileWidgetId | null>(null);
  const pendingRef = useRef<{ resolve: (token: string | null) => void; timeout: ReturnType<typeof setTimeout>; abortCleanup?: () => void } | null>(null);
  const resolvedSiteKey = siteKey?.trim() || process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || "";

  function finish(value: string | null) {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    clearTimeout(pending.timeout);
    pending.abortCleanup?.();
    pending.resolve(value);
    const widgetId = widgetIdRef.current;
    if (widgetId !== null) {
      try {
        window.turnstile?.reset(widgetId);
      } catch {
        // A challenge reset is best effort after a token expires or is cancelled.
      }
    }
  }

  useEffect(() => {
    if (!resolvedSiteKey || !containerRef.current) return;
    let active = true;
    void loadTurnstileScript()
      .then(() => {
        if (!active || !containerRef.current || !window.turnstile || widgetIdRef.current !== null) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: resolvedSiteKey,
          size: "invisible",
          execution: "execute",
          action: "personalized-interpretation",
          callback: (token) => finish(token),
          "expired-callback": () => finish(null),
          "error-callback": () => finish(null),
        });
      })
      .catch(() => {
        // Missing Turnstile is a deliberate static fallback, not a casting failure.
      });
    return () => {
      active = false;
      finish(null);
    };
  }, [resolvedSiteKey]);

  useImperativeHandle(ref, () => ({
    async getToken(signal?: AbortSignal) {
      if (!resolvedSiteKey) return null;
      try {
        await loadTurnstileScript();
        const widgetId = widgetIdRef.current;
        if (widgetId === null || !window.turnstile || pendingRef.current || signal?.aborted) return null;
        return await new Promise<string | null>((resolve) => {
          const timeout = setTimeout(() => finish(null), 8_000);
          const pending: { resolve: (token: string | null) => void; timeout: ReturnType<typeof setTimeout>; abortCleanup?: () => void } = { resolve, timeout };
          if (signal) {
            const onAbort = () => finish(null);
            signal.addEventListener("abort", onAbort, { once: true });
            pending.abortCleanup = () => signal.removeEventListener("abort", onAbort);
          }
          pendingRef.current = pending;
          try {
            window.turnstile?.execute(widgetId);
          } catch {
            finish(null);
          }
        });
      } catch {
        return null;
      }
    },
    cancel() {
      finish(null);
    },
  }), [resolvedSiteKey]);

  if (!resolvedSiteKey) return null;
  return <div ref={containerRef} aria-hidden="true" data-turnstile-challenge className="min-h-0" />;
});
