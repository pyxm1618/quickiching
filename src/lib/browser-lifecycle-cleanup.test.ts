import { afterEach, describe, expect, it, vi } from "vitest";
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
  getLiveFlowRegistration,
  LOCALE_CONTINUATION_STORAGE_KEY,
  registerLiveFlow,
} from "@/lib/reading-resume";
import { THREE_COIN_SESSION_STORAGE_KEY } from "@/lib/three-coin-session";
import {
  cleanupBrowserStateAfterDeleteAccount,
  cleanupBrowserStateAfterSignOut,
  DEEP_READING_CONTEXT_STORAGE_PREFIX,
  RETIRED_COMPLETED_READING_STORAGE_KEY,
  RETIRED_THREE_COIN_BACKUP_STORAGE_KEY,
} from "./browser-lifecycle-cleanup";

class MemoryStorage implements Storage {
  #data = new Map<string, string>();
  clearCalls = 0;
  failRemoveFor: string | null = null;
  get length() { return this.#data.size; }
  clear() { this.clearCalls += 1; this.#data.clear(); }
  getItem(key: string) { return this.#data.get(key) ?? null; }
  key(index: number) { return [...this.#data.keys()][index] ?? null; }
  removeItem(key: string) {
    if (key === this.failRemoveFor) throw new Error("blocked");
    this.#data.delete(key);
  }
  setItem(key: string, value: string) { this.#data.set(key, value); }
}

const pendingKey = PENDING_COMPLETED_READING_KEY_PREFIX + "reading-e";
const requestKey = CHECKOUT_REQUEST_IDENTITY_KEY_PREFIX + "one";
const deepKey = DEEP_READING_CONTEXT_STORAGE_PREFIX + "reading-a";

function seed() {
  const session = new MemoryStorage();
  const local = new MemoryStorage();
  for (const key of [
    THREE_COIN_SESSION_STORAGE_KEY,
    YARROW_SESSION_STORAGE_KEY,
    MEI_HUA_SESSION_STORAGE_KEY,
    MANUAL_SESSION_STORAGE_KEY,
    MANUAL_CAST_DRAFT_STORAGE_KEY,
    LOCALE_CONTINUATION_STORAGE_KEY,
    CHECKOUT_RETURN_CONTEXT_KEY,
    requestKey,
    deepKey,
    RETIRED_COMPLETED_READING_STORAGE_KEY,
    RETIRED_THREE_COIN_BACKUP_STORAGE_KEY,
  ]) session.setItem(key, "owned");
  session.setItem("quickiching:appearance", "dark");
  session.setItem("unrelated:preference", "keep");

  local.setItem(pendingKey, "pending");
  local.setItem(RETIRED_COMPLETED_READING_STORAGE_KEY, "legacy");
  local.setItem(RETIRED_THREE_COIN_BACKUP_STORAGE_KEY, "legacy");
  local.setItem("quickiching:analytics-consent", "granted");
  local.setItem("quickiching:language", "zh-Hans");
  return { session, local };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("R3 browser lifecycle cleanup authority", () => {
  it("Sign Out preserves public reading recovery but clears transient/account-commercial state", () => {
    const { session, local } = seed();
    registerLiveFlow({ method: "three-coin", readingId: "reading-a", locale: "en" });

    const report = cleanupBrowserStateAfterSignOut({ sessionStorage: session, localStorage: local });

    expect(report.ok).toBe(true);
    for (const key of [
      THREE_COIN_SESSION_STORAGE_KEY,
      YARROW_SESSION_STORAGE_KEY,
      MEI_HUA_SESSION_STORAGE_KEY,
      MANUAL_SESSION_STORAGE_KEY,
      MANUAL_CAST_DRAFT_STORAGE_KEY,
    ]) expect(session.getItem(key)).toBe("owned");
    expect(local.getItem(pendingKey)).toBe("pending");

    for (const key of [LOCALE_CONTINUATION_STORAGE_KEY, CHECKOUT_RETURN_CONTEXT_KEY, requestKey, deepKey]) {
      expect(session.getItem(key)).toBeNull();
    }
    expect(getLiveFlowRegistration()).toBeNull();
    expect(session.getItem("unrelated:preference")).toBe("keep");
    expect(local.getItem("quickiching:analytics-consent")).toBe("granted");
    expect(session.clearCalls).toBe(0);
    expect(local.clearCalls).toBe(0);
  });

  it("Delete Account clears every owned lifecycle state and preserves unrelated preferences", () => {
    const { session, local } = seed();
    registerLiveFlow({ method: "manual", readingId: "reading-manual", locale: "en" });

    const report = cleanupBrowserStateAfterDeleteAccount({ sessionStorage: session, localStorage: local });

    expect(report.ok).toBe(true);
    for (const key of [
      THREE_COIN_SESSION_STORAGE_KEY,
      YARROW_SESSION_STORAGE_KEY,
      MEI_HUA_SESSION_STORAGE_KEY,
      MANUAL_SESSION_STORAGE_KEY,
      MANUAL_CAST_DRAFT_STORAGE_KEY,
      LOCALE_CONTINUATION_STORAGE_KEY,
      CHECKOUT_RETURN_CONTEXT_KEY,
      requestKey,
      deepKey,
      RETIRED_COMPLETED_READING_STORAGE_KEY,
      RETIRED_THREE_COIN_BACKUP_STORAGE_KEY,
    ]) expect(session.getItem(key)).toBeNull();
    for (const key of [
      pendingKey,
      RETIRED_COMPLETED_READING_STORAGE_KEY,
      RETIRED_THREE_COIN_BACKUP_STORAGE_KEY,
    ]) expect(local.getItem(key)).toBeNull();

    expect(getLiveFlowRegistration()).toBeNull();
    expect(session.getItem("quickiching:appearance")).toBe("dark");
    expect(session.getItem("unrelated:preference")).toBe("keep");
    expect(local.getItem("quickiching:analytics-consent")).toBe("granted");
    expect(local.getItem("quickiching:language")).toBe("zh-Hans");
    expect(session.clearCalls).toBe(0);
    expect(local.clearCalls).toBe(0);
  });

  it("reports cleanup failure, keeps trying other owned keys, and never uses Storage.clear()", () => {
    const { session, local } = seed();
    session.failRemoveFor = CHECKOUT_RETURN_CONTEXT_KEY;

    const report = cleanupBrowserStateAfterDeleteAccount({ sessionStorage: session, localStorage: local });

    expect(report.ok).toBe(false);
    expect(report.failures).toContainEqual({
      area: "sessionStorage",
      owner: CHECKOUT_RETURN_CONTEXT_KEY,
      code: "REMOVE_FAILED",
    });
    expect(session.getItem(LOCALE_CONTINUATION_STORAGE_KEY)).toBeNull();
    expect(local.getItem(pendingKey)).toBeNull();
    expect(session.clearCalls).toBe(0);
    expect(local.clearCalls).toBe(0);
  });
});
