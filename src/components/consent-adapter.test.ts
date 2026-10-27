import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkAndSyncConsentMode,
  getConsentSnapshot,
  getServerConsentSnapshot,
  openPrivacySettings,
  resetConsentStateForTesting,
} from "./consent-adapter";
import { GOOGLE_PUBLISHER_SCRIPT_ID } from "@/lib/privacy-route-policy";

describe("Google CMP consent adapter", () => {
  beforeEach(() => {
    resetConsentStateForTesting();
    vi.unstubAllGlobals();
    vi.stubGlobal("window", {
      localStorage: { removeItem: vi.fn() },
    });
  });

  it("fails closed until Google CMP provides consent mode values", () => {
    expect(getServerConsentSnapshot()).toEqual({
      essential: true,
      analytics: false,
      advertising: false,
    });
    expect(getConsentSnapshot()).toEqual({
      essential: true,
      analytics: false,
      advertising: false,
    });
  });

  it("maps Google consent mode values into independent analytics and advertising consent", () => {
    window.googlefc = {
      getGoogleConsentModeValues: vi.fn().mockReturnValue({
        analytics_storage: "granted",
        ad_storage: "denied",
      }),
    };
    checkAndSyncConsentMode();
    expect(getConsentSnapshot()).toEqual({
      essential: true,
      analytics: true,
      advertising: false,
    });

    window.googlefc.getGoogleConsentModeValues = vi.fn().mockReturnValue({
      analytics_storage: "denied",
      ad_storage: "granted",
    });
    checkAndSyncConsentMode();
    expect(getConsentSnapshot()).toEqual({
      essential: true,
      analytics: false,
      advertising: true,
    });
  });

  it("reopens Google privacy settings when the CMP runtime is ready", () => {
    const showRevocationMessage = vi.fn();
    window.googlefc = { showRevocationMessage };
    expect(openPrivacySettings()).toBe(true);
    expect(showRevocationMessage).toHaveBeenCalledTimes(1);
  });

  it("does not pretend privacy settings opened on a private route without publisher runtime", () => {
    window.googlefc = { callbackQueue: [] };
    vi.stubGlobal("document", { getElementById: vi.fn().mockReturnValue(null) });
    expect(openPrivacySettings()).toBe(false);
  });

  it("queues revocation when the publisher script exists but Google CMP is still initializing", () => {
    const callbackQueue: Array<(() => void) | Record<string, () => void>> = [];
    window.googlefc = { callbackQueue };
    vi.stubGlobal("document", {
      getElementById: vi.fn((id: string) => id === GOOGLE_PUBLISHER_SCRIPT_ID ? {} : null),
    });

    expect(openPrivacySettings()).toBe(true);
    expect(callbackQueue).toHaveLength(1);

    const showRevocationMessage = vi.fn();
    window.googlefc.showRevocationMessage = showRevocationMessage;
    const queued = callbackQueue[0];
    if (typeof queued === "function") queued();
    expect(showRevocationMessage).toHaveBeenCalledTimes(1);
  });
});
