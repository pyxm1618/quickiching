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

  it("keeps only modal Refund/Delete controls while preserving recovery cleanup", () => {
    const refund = read("../../app/(default)/account/refund-request-control.tsx");
    expect(refund).toContain('className="qic-account-refund-form"');
    expect(refund).not.toContain("presentation");

    const deletion = read("../../app/(default)/account/delete-account-control.tsx");
    expect(deletion).toContain('className="qic-account-delete-form"');
    expect(deletion).not.toContain("presentation");
    expect(deletion).toContain("THREE_COIN_BACKUP_STORAGE_KEY");
    expect(deletion).toContain("THREE_COIN_SESSION_STORAGE_KEY");
    expect(deletion).toContain("quickiching:deep-reading-context:");
    expect(deletion).not.toContain("HISTORY_STORAGE_KEY");
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
