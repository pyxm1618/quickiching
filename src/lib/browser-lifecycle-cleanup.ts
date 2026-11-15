import { CHECKOUT_REQUEST_IDENTITY_KEY_PREFIX } from "@/app/(default)/pricing/checkout-request-identity";
import { CHECKOUT_RETURN_CONTEXT_KEY } from "@/app/(default)/pricing/checkout-return-context";
import { MANUAL_CAST_DRAFT_STORAGE_KEY } from "@/lib/manual-cast-draft";
import {
  MANUAL_SESSION_STORAGE_KEY,
  MEI_HUA_SESSION_STORAGE_KEY,
  YARROW_SESSION_STORAGE_KEY,
} from "@/lib/method-session-retirement";
import { PENDING_COMPLETED_READING_KEY_PREFIX } from "@/lib/pending-completed-reading";
import {
  clearLiveFlowRegistration,
  getLiveFlowRegistration,
  LOCALE_CONTINUATION_STORAGE_KEY,
} from "@/lib/reading-resume";
import { THREE_COIN_SESSION_STORAGE_KEY } from "@/lib/three-coin-session";

export const RETIRED_COMPLETED_READING_STORAGE_KEY = "quickiching:public-v1:completed-reading";
export const RETIRED_THREE_COIN_BACKUP_STORAGE_KEY = "quickiching:public-v1:three-coin-completed-backup";
export const DEEP_READING_CONTEXT_STORAGE_PREFIX = "quickiching:deep-reading-context:";

type CleanupArea = "sessionStorage" | "localStorage" | "memory";

export type BrowserLifecycleCleanupFailure = {
  area: CleanupArea;
  owner: string;
  code: "STORAGE_UNAVAILABLE" | "ENUMERATION_FAILED" | "REMOVE_FAILED" | "REMOVE_UNVERIFIED" | "MEMORY_CLEAR_FAILED";
};

export type BrowserLifecycleCleanupReport = {
  ok: boolean;
  removed: string[];
  failures: BrowserLifecycleCleanupFailure[];
};

type CleanupStorage = Pick<Storage, "getItem" | "removeItem" | "key" | "length">;

type CleanupDependencies = {
  sessionStorage?: CleanupStorage;
  localStorage?: CleanupStorage;
};

const PUBLIC_METHOD_SESSION_KEYS = [
  THREE_COIN_SESSION_STORAGE_KEY,
  YARROW_SESSION_STORAGE_KEY,
  MEI_HUA_SESSION_STORAGE_KEY,
  MANUAL_SESSION_STORAGE_KEY,
  MANUAL_CAST_DRAFT_STORAGE_KEY,
] as const;

const SIGN_OUT_SESSION_EXACT_KEYS = [
  LOCALE_CONTINUATION_STORAGE_KEY,
  CHECKOUT_RETURN_CONTEXT_KEY,
] as const;

const SIGN_OUT_SESSION_PREFIXES = [
  CHECKOUT_REQUEST_IDENTITY_KEY_PREFIX,
  DEEP_READING_CONTEXT_STORAGE_PREFIX,
] as const;

const DELETE_LOCAL_EXACT_KEYS = [
  RETIRED_COMPLETED_READING_STORAGE_KEY,
  RETIRED_THREE_COIN_BACKUP_STORAGE_KEY,
] as const;

function browserStorage(area: "sessionStorage" | "localStorage", provided?: CleanupStorage): CleanupStorage {
  if (provided) return provided;
  if (typeof window === "undefined") throw new Error("STORAGE_UNAVAILABLE");
  const storage = area === "sessionStorage" ? window.sessionStorage : window.localStorage;
  if (!storage) throw new Error("STORAGE_UNAVAILABLE");
  return storage;
}

function removeExact(
  storage: CleanupStorage,
  area: Exclude<CleanupArea, "memory">,
  key: string,
  removed: string[],
  failures: BrowserLifecycleCleanupFailure[],
): void {
  try {
    const existed = storage.getItem(key) !== null;
    storage.removeItem(key);
    if (storage.getItem(key) !== null) {
      failures.push({ area, owner: key, code: "REMOVE_UNVERIFIED" });
      return;
    }
    if (existed) removed.push(key);
  } catch {
    failures.push({ area, owner: key, code: "REMOVE_FAILED" });
  }
}

function removePrefix(
  storage: CleanupStorage,
  area: Exclude<CleanupArea, "memory">,
  prefix: string,
  removed: string[],
  failures: BrowserLifecycleCleanupFailure[],
): void {
  const keys: string[] = [];
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(prefix)) keys.push(key);
    }
  } catch {
    failures.push({ area, owner: prefix + "*", code: "ENUMERATION_FAILED" });
    return;
  }
  for (const key of keys) removeExact(storage, area, key, removed, failures);
}

function clearLiveRegistration(
  removed: string[],
  failures: BrowserLifecycleCleanupFailure[],
): void {
  try {
    const existed = getLiveFlowRegistration() !== null;
    clearLiveFlowRegistration();
    if (getLiveFlowRegistration() !== null) {
      failures.push({ area: "memory", owner: "live-flow-registration", code: "MEMORY_CLEAR_FAILED" });
      return;
    }
    if (existed) removed.push("memory:live-flow-registration");
  } catch {
    failures.push({ area: "memory", owner: "live-flow-registration", code: "MEMORY_CLEAR_FAILED" });
  }
}

function sessionCleanup(
  dependencies: CleanupDependencies,
  includePublicReading: boolean,
  removed: string[],
  failures: BrowserLifecycleCleanupFailure[],
): void {
  let storage: CleanupStorage;
  try {
    storage = browserStorage("sessionStorage", dependencies.sessionStorage);
  } catch {
    failures.push({ area: "sessionStorage", owner: "owned-session-state", code: "STORAGE_UNAVAILABLE" });
    return;
  }

  for (const key of SIGN_OUT_SESSION_EXACT_KEYS) removeExact(storage, "sessionStorage", key, removed, failures);
  for (const prefix of SIGN_OUT_SESSION_PREFIXES) removePrefix(storage, "sessionStorage", prefix, removed, failures);

  if (includePublicReading) {
    for (const key of PUBLIC_METHOD_SESSION_KEYS) removeExact(storage, "sessionStorage", key, removed, failures);
  }
}

function deleteLocalCleanup(
  dependencies: CleanupDependencies,
  removed: string[],
  failures: BrowserLifecycleCleanupFailure[],
): void {
  let storage: CleanupStorage;
  try {
    storage = browserStorage("localStorage", dependencies.localStorage);
  } catch {
    failures.push({ area: "localStorage", owner: "owned-local-state", code: "STORAGE_UNAVAILABLE" });
    return;
  }

  removePrefix(storage, "localStorage", PENDING_COMPLETED_READING_KEY_PREFIX, removed, failures);
  for (const key of DELETE_LOCAL_EXACT_KEYS) removeExact(storage, "localStorage", key, removed, failures);
}

/**
 * R3 Sign Out authority:
 * - preserve browser-local public reading recovery (method sessions, Manual draft, Pending[*]);
 * - clear transient active-navigation state and account/commercial recovery state;
 * - clear memory-only live-flow registration.
 *
 * Better Auth's current Magic Link / OAuth continuation authority is URL +
 * database/cookie based; there is no app-owned persistent browser auth key to
 * remove. Any future app-owned auth browser key must be added to this owner.
 */
export function cleanupBrowserStateAfterSignOut(
  dependencies: CleanupDependencies = {},
): BrowserLifecycleCleanupReport {
  const removed: string[] = [];
  const failures: BrowserLifecycleCleanupFailure[] = [];
  sessionCleanup(dependencies, false, removed, failures);
  clearLiveRegistration(removed, failures);
  return { ok: failures.length === 0, removed, failures };
}

/**
 * R3 Delete Account authority. Called only after the server has confirmed that
 * account deletion succeeded. It clears every Quick I Ching reading/account/
 * auth-commercial lifecycle record owned by this browser without touching
 * unrelated preferences or consent.
 */
export function cleanupBrowserStateAfterDeleteAccount(
  dependencies: CleanupDependencies = {},
): BrowserLifecycleCleanupReport {
  const removed: string[] = [];
  const failures: BrowserLifecycleCleanupFailure[] = [];
  sessionCleanup(dependencies, true, removed, failures);
  deleteLocalCleanup(dependencies, removed, failures);
  clearLiveRegistration(removed, failures);
  return { ok: failures.length === 0, removed, failures };
}
