"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

type TurnstileApi = {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
      theme: "auto";
    },
  ): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_ID = "quickiching-turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (typeof window === "undefined") return Promise.reject(new Error("TURNSTILE_BROWSER_REQUIRED"));
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");

    const resolveApi = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error("TURNSTILE_UNAVAILABLE"));
    };
    const rejectApi = () => reject(new Error("TURNSTILE_UNAVAILABLE"));

    script.addEventListener("load", resolveApi, { once: true });
    script.addEventListener("error", rejectApi, { once: true });

    if (!existing) {
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }).catch((error) => {
    scriptPromise = null;
    throw error;
  });

  return scriptPromise;
}

export type TurnstileWidgetHandle = {
  reset(): void;
};

export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, {
  siteKey: string;
  onToken(token: string | null): void;
}>(function TurnstileWidget({ siteKey, onToken }, forwardedRef) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useImperativeHandle(forwardedRef, () => ({
    reset() {
      const widgetId = widgetIdRef.current;
      if (widgetId && window.turnstile) {
        window.turnstile.reset(widgetId);
      }
      onTokenRef.current(null);
    },
  }), []);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    let cancelled = false;

    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !containerRef.current) return;
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
          theme: "auto",
        });
      })
      .catch(() => onTokenRef.current(null));

    return () => {
      cancelled = true;
      const widgetId = widgetIdRef.current;
      widgetIdRef.current = null;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
      onTokenRef.current(null);
    };
  }, [siteKey]);

  if (!siteKey) return null;
  return <div ref={containerRef} data-turnstile-widget />;
});
