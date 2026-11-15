import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SCRIPTS_ROOT = fileURLToPath(new URL("../../../scripts/", import.meta.url));
const SELF = fileURLToPath(import.meta.url);

function read(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

function sourceFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(path));
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) files.push(path);
  }
  return files;
}

describe("Account legacy cleanup guard", () => {
  it("removes the browser-only Local History product instead of hiding or redirecting it", () => {
    for (const relative of [
      "../../app/(default)/history/page.tsx",
      "../../app/(localized)/zh/history/page.tsx",
      "../public-reading/history-client.tsx",
      "../../domain/public-reading/history.ts",
    ]) {
      expect(existsSync(new URL(relative, import.meta.url)), relative).toBe(false);
    }

    const forbidden = [
      "/history",
      "/zh/history",
      "HistoryClient",
      "HISTORY_STORAGE_KEY",
      "saveHistoryRecord",
      "quickiching:public-history",
      "getAccountSummary",
      "loadHistory",
      "accountAndHistory",
      "Local History",
      "Browser-only history",
      "View history",
      "Saved in this browser",
      "Save reading",
      "data-save-reading",
      "data-history-",
      "account History",
      "History save",
      "起卦记录",
      "账户与历史记录",
      'kind: "history"',
      'kind === "history"',
    ];

    const offenders: string[] = [];
    for (const [root, label] of [[SRC_ROOT, "src/"], [SCRIPTS_ROOT, "scripts/"]] as const) {
      for (const file of sourceFiles(root)) {
        if (file === SELF) continue;
        const content = readFileSync(file, "utf8");
        for (const token of forbidden) {
          if (content.includes(token)) offenders.push(`${file.replace(root, label)}: ${token}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps Account actions thin and routes lifecycle cleanup through one R3 owner", () => {
    const refund = read("../../app/(default)/account/refund-request-control.tsx");
    expect(refund).toContain('className="qic-account-refund-form"');
    expect(refund).not.toContain("presentation");

    const deletion = read("../../app/(default)/account/delete-account-control.tsx");
    const settings = read("../account/settings-view.tsx");
    const cleanup = read("../../lib/browser-lifecycle-cleanup.ts");

    expect(deletion).toContain('className="qic-account-delete-form"');
    expect(deletion).toContain("cleanupBrowserStateAfterDeleteAccount");
    expect(settings).toContain("cleanupBrowserStateAfterSignOut");
    expect(deletion).not.toContain("localStorage.removeItem");
    expect(deletion).not.toContain("sessionStorage.removeItem");
    expect(settings).not.toContain("localStorage.removeItem");
    expect(settings).not.toContain("sessionStorage.removeItem");

    for (const token of [
      "PENDING_COMPLETED_READING_KEY_PREFIX",
      "THREE_COIN_SESSION_STORAGE_KEY",
      "YARROW_SESSION_STORAGE_KEY",
      "MEI_HUA_SESSION_STORAGE_KEY",
      "MANUAL_SESSION_STORAGE_KEY",
      "MANUAL_CAST_DRAFT_STORAGE_KEY",
      "LOCALE_CONTINUATION_STORAGE_KEY",
      "CHECKOUT_RETURN_CONTEXT_KEY",
      "CHECKOUT_REQUEST_IDENTITY_KEY_PREFIX",
      "quickiching:deep-reading-context:",
      "quickiching:public-v1:completed-reading",
      "quickiching:public-v1:three-coin-completed-backup",
    ]) expect(cleanup).toContain(token);

    expect(cleanup).not.toContain("localStorage.clear()");
    expect(cleanup).not.toContain("sessionStorage.clear()");
    expect(deletion).not.toContain("HISTORY_STORAGE_KEY");
  });

  it("keeps retired completed singleton/backup as cleanup-only, never runtime read/write authorities", () => {
    const allowed = new Set([
      "src/lib/browser-lifecycle-cleanup.ts",
      "src/lib/browser-lifecycle-cleanup.test.ts",
      "src/lib/three-coin-session.ts",
      "src/lib/completed-public-reading.ts",
    ]);
    const retired = [
      "quickiching:public-v1:completed-reading",
      "quickiching:public-v1:three-coin-completed-backup",
    ];
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC_ROOT)) {
      if (file === SELF) continue;
      const relative = file.replace(SRC_ROOT, "src/");
      const content = readFileSync(file, "utf8");
      if (retired.some((key) => content.includes(key)) && !allowed.has(relative)) offenders.push(relative);
    }
    expect(offenders).toEqual([]);

    const cleanup = read("../../lib/browser-lifecycle-cleanup.ts");
    expect(cleanup).toContain("DELETE_LOCAL_EXACT_KEYS");
    expect(cleanup).toContain("removeExact(storage, \"localStorage\"");
  });

  it("keeps My Readings routing aligned with the current account loader scope", () => {
    const loaders = read("../../server/loaders.ts");
    const page = read("./my-readings-page.tsx");
    expect(loaders).not.toContain("s.method = 'three_coin'");
    expect(loaders).toContain("'yarrow_stalk'");
    expect(loaders).toContain("'mei_hua_number_time'");
    expect(page).toContain("/readings/result?session=");
    expect(page).not.toContain("/readings/three-coin/result");
  });
});
