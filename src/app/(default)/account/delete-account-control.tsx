"use client";

import React, { useState } from "react";
import { createAuthClient } from "better-auth/client";
import { Button } from "@/components/ui/button";
import { THREE_COIN_BACKUP_STORAGE_KEY, THREE_COIN_SESSION_STORAGE_KEY } from "@/lib/three-coin-session";

const authClient = createAuthClient({ basePath: "/api/auth" });

function clearQuickIChingAccountStorage(): void {
  try {
    window.localStorage.removeItem(THREE_COIN_BACKUP_STORAGE_KEY);
  } catch {
    // Storage cleanup is best-effort after server-side deletion succeeds.
  }
  try {
    window.sessionStorage.removeItem(THREE_COIN_SESSION_STORAGE_KEY);
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith("quickiching:deep-reading-context:")) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch {
    // Storage cleanup is best-effort after server-side deletion succeeds.
  }
}

export function DeleteAccountControl({ locale = "en" }: { locale?: "en" | "zh-Hans" }) {
  const zh = locale === "zh-Hans";
  const t = (en: string, cn: string) => zh ? cn : en;
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expectedConfirmation = "DELETE";
  const confirmed = confirmation === expectedConfirmation;

  async function deleteAccount() {
    if (!confirmed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/account/delete", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw new Error("ACCOUNT_DELETE_FAILED");
      clearQuickIChingAccountStorage();
      await authClient.signOut().catch(() => undefined);
      window.location.assign(zh ? "/zh" : "/");
    } catch {
      setError(t("Account deletion could not be completed. No deletion is assumed; please try again.", "账户删除未完成；页面不会假设已经删除，请重试。"));
      setSubmitting(false);
    }
  }

  return (
    <div className="qic-account-delete-form">
      <h3 className="font-display text-lg font-medium">{t("Delete Account", "删除账户")}</h3>
      <p className="qic-account-permanent">{t("This action is permanent and cannot be undone.", "此操作为永久操作，无法撤销。")}</p>
      <div className="qic-account-deletion-summary"><strong>{t("Deleting your account will permanently delete:", "删除账户将永久删除：")}</strong><ul><li>{t("Stored reading data", "已保存的解读数据")}</li><li>{t("Stored question text", "已保存的问题文本")}</li><li>{t("Generated Deep Reading content", "已生成的深度解读内容")}</li><li>{t("Account profile information", "账户资料")}</li></ul><p>{t("Certain financial and security records may be retained as required by law.", "依法保留必要的财务和安全记录。")}</p></div>
      <label className="mt-4 block text-sm font-medium" htmlFor="delete-account-confirmation">
        {zh ? `输入 ${expectedConfirmation} 确认` : "Type DELETE to confirm"}
      </label>
      <input
        id="delete-account-confirmation"
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        autoComplete="off"
        placeholder={expectedConfirmation}
        spellCheck={false}
        className="mt-2 w-full rounded-md border border-[var(--line)] bg-transparent px-3 py-2 font-mono text-sm"
      />
      <Button className="mt-3" variant="outline" disabled={!confirmed || submitting} onClick={deleteAccount}>
        {submitting ? t("Deleting…", "正在删除…") : t("Permanently Delete Account", "永久删除账户")}
      </Button>
      {error && <p role="alert" className="mt-2 text-sm text-[var(--danger)]">{error}</p>}
    </div>
  );
}
