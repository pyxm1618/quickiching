"use client";

import {
  GOOGLE_PUBLISHER_SCRIPT_ID,
} from "@/lib/privacy-route-policy";

export type ConsentState = {
  readonly essential: true;
  readonly analytics: boolean;
  readonly advertising: boolean;
};

export type GoogleConsentModeValues = {
  analytics_storage?: "granted" | "denied";
  ad_storage?: "granted" | "denied";
  ad_user_data?: "granted" | "denied";
  ad_personalization?: "granted" | "denied";
};

declare global {
  interface Window {
    __tcfapi?: (
      command: string,
      version: number,
      callback: (tcData: unknown, success: boolean) => void,
      parameter?: unknown,
    ) => void;
    googlefc?: {
      callbackQueue?: Array<(() => void) | Record<string, () => void>>;
      showRevocationMessage?: () => void;
      getGoogleConsentModeValues?: () => GoogleConsentModeValues | undefined;
    };
  }
}

const LEGACY_ANALYTICS_CONSENT_STORAGE_KEY = "quickiching:analytics-consent:v1";

const DEFAULT_FAIL_CLOSED_STATE: ConsentState = {
  essential: true,
  analytics: false,
  advertising: false,
};

let currentConsent: ConsentState = DEFAULT_FAIL_CLOSED_STATE;
const listeners = new Set<() => void>();
let isSubscribedToCmp = false;

function notifyListeners(): void {
  for (const listener of listeners) listener();
}

function retireLegacyConsentStorage(): void {
  try {
    window.localStorage.removeItem(LEGACY_ANALYTICS_CONSENT_STORAGE_KEY);
  } catch {
    // Storage may be unavailable in hardened/private browsing contexts.
  }
}

function updateFromConsentModeValues(values?: GoogleConsentModeValues): void {
  const nextState: ConsentState = values
    ? {
        essential: true,
        analytics: values.analytics_storage === "granted",
        advertising: values.ad_storage === "granted",
      }
    : DEFAULT_FAIL_CLOSED_STATE;

  if (
    currentConsent.analytics !== nextState.analytics ||
    currentConsent.advertising !== nextState.advertising
  ) {
    currentConsent = nextState;
    notifyListeners();
  }
}

export function checkAndSyncConsentMode(): void {
  if (typeof window === "undefined") return;
  updateFromConsentModeValues(window.googlefc?.getGoogleConsentModeValues?.());
}

function registerCmpListeners(): void {
  if (typeof window === "undefined" || isSubscribedToCmp) return;
  isSubscribedToCmp = true;
  retireLegacyConsentStorage();

  window.googlefc = window.googlefc || {};
  window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
  window.googlefc.callbackQueue.push({
    CONSENT_MODE_DATA_READY: checkAndSyncConsentMode,
    CONSENT_DATA_READY: checkAndSyncConsentMode,
  });

  if (typeof window.__tcfapi === "function") {
    try {
      window.__tcfapi("addEventListener", 2, (tcData, success) => {
        if (success && tcData) checkAndSyncConsentMode();
      });
    } catch {
      // The Google CMP callback queue remains the primary integration path.
    }
  }

  checkAndSyncConsentMode();
}

export function subscribeConsent(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);

  if (typeof window !== "undefined") {
    registerCmpListeners();

    const intervalId = window.setInterval(() => {
      if (typeof window.googlefc?.getGoogleConsentModeValues === "function") {
        checkAndSyncConsentMode();
      }
    }, 200);

    const timeoutId = window.setTimeout(() => {
      window.clearInterval(intervalId);
    }, 5000);

    return () => {
      listeners.delete(onStoreChange);
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }

  return () => {
    listeners.delete(onStoreChange);
  };
}

export function getConsentSnapshot(): ConsentState {
  return currentConsent;
}

export function getServerConsentSnapshot(): ConsentState {
  return DEFAULT_FAIL_CLOSED_STATE;
}

export function openPrivacySettings(): boolean {
  if (typeof window === "undefined") return false;

  if (typeof window.googlefc?.showRevocationMessage === "function") {
    window.googlefc.showRevocationMessage();
    return true;
  }

  const publisherScriptPresent =
    typeof document !== "undefined" &&
    document.getElementById(GOOGLE_PUBLISHER_SCRIPT_ID) !== null;

  if (
    publisherScriptPresent &&
    window.googlefc &&
    Array.isArray(window.googlefc.callbackQueue)
  ) {
    window.googlefc.callbackQueue.push(() => {
      window.googlefc?.showRevocationMessage?.();
    });
    return true;
  }

  return false;
}

export function resetConsentStateForTesting(): void {
  currentConsent = DEFAULT_FAIL_CLOSED_STATE;
  listeners.clear();
  isSubscribedToCmp = false;
}
