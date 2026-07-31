"use client";

import { useEffect, useRef } from "react";

type TurnstileApi = {
  render(container: HTMLElement, options: {
    sitekey: string;
    action: string;
    callback(token: string): void;
    "expired-callback"(): void;
    "error-callback"(): void;
    theme: "auto";
    appearance: "interaction-only";
  }): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_ID = "cloudflare-turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  return new Promise((resolve, reject) => {
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    const ready = () => window.turnstile ? resolve(window.turnstile) : reject(new Error("TURNSTILE_UNAVAILABLE"));
    script.addEventListener("load", ready, { once: true });
    script.addEventListener("error", () => reject(new Error("TURNSTILE_UNAVAILABLE")), { once: true });
    if (window.turnstile) ready();
  });
}

export function TurnstileChallenge(props: {
  action: string;
  resetKey?: number;
  onToken(token: string | null): void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey || !containerRef.current) {
      props.onToken(null);
      return;
    }
    let cancelled = false;
    void loadTurnstile().then((turnstile) => {
      if (cancelled || !containerRef.current) return;
      widgetIdRef.current = turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action: props.action,
        callback: (token) => props.onToken(token),
        "expired-callback": () => props.onToken(null),
        "error-callback": () => props.onToken(null),
        theme: "auto",
        appearance: "interaction-only",
      });
    }).catch(() => props.onToken(null));
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    };
  }, [props.action, props.onToken, siteKey]);

  useEffect(() => {
    if (props.resetKey === undefined || !widgetIdRef.current || !window.turnstile) return;
    props.onToken(null);
    window.turnstile.reset(widgetIdRef.current);
  }, [props.onToken, props.resetKey]);

  if (!siteKey) return null;
  return <div ref={containerRef} className="min-h-16" aria-label="Security verification" />;
}
