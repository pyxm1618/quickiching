"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function DeleteAccountControl({ locale = "en" }: { locale?: "en" | "zh-Hans" }) {
  const zh = locale === "zh-Hans";
  const t = (en: string, cn: string) => zh ? cn : en;
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expectedConfirmation = zh ? "删除账户" : "DELETE";
  const confirmed = confirmation.trim() === expectedConfirmation;

  async function deleteAccount() {
    if (!confirmed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/account/delete", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw new Error("ACCOUNT_DELETE_FAILED");
      window.location.assign(zh ? "/zh" : "/");
    } catch {
      setError(t("Account deletion could not be completed. No deletion is assumed; please try again.", "账户删除未完成；页面不会假设已经删除，请重试。"));
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--line)] p-4">
      <h3 className="font-display text-lg font-medium">{t("Delete account", "删除账户")}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--ink-3)]">
        {t("This permanently removes stored question text and generated reading content, signs you out, and anonymizes your account. Required financial and security records may be retained without your profile details.", "此操作会永久删除已存储的问题文本和生成的解读内容、退出登录并匿名化账户。依法或为财务与安全审计所需的记录可能在不保留个人资料关联的情况下继续保存。")}
      </p>
      <label className="mt-4 block text-sm font-medium" htmlFor="delete-account-confirmation">
        {zh ? "输入“删除账户”确认" : "Type DELETE to confirm"}
      </label>
      <input
        id="delete-account-confirmation"
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        autoComplete="off"
        className="mt-2 w-full rounded-md border border-[var(--line)] bg-transparent px-3 py-2 font-mono text-sm"
      />
      <Button className="mt-3" variant="outline" disabled={!confirmed || submitting} onClick={deleteAccount}>
        {submitting ? t("Deleting…", "正在删除…") : t("Permanently delete account", "永久删除账户")}
      </Button>
      {error && <p role="alert" className="mt-2 text-sm text-[var(--cinnabar)]">{error}</p>}
    </div>
  );
}
