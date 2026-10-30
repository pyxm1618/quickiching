"use client";
import React, { useState } from "react";
import Link from "next/link";
import { FileText, ScrollText, UserRound, Trash2, TriangleAlert, ChevronRight, Diamond } from "lucide-react";
import { DeleteAccountControl } from "@/app/(default)/account/delete-account-control";
export function SettingsView({ deleting, onDeleteView, zh, onClose }: { deleting: boolean; onDeleteView: (value: boolean) => void; zh: boolean; onClose: () => void }) {
  const t = (en: string, cn: string) => zh ? cn : en;
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function signOut() {
    if (signingOut) return;
    setSigningOut(true); setError(null);
    try {
      const response = await fetch("/api/auth/sign-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!response.ok) throw new Error("SIGN_OUT_FAILED");
      window.location.assign(zh ? "/zh" : "/");
    } catch { setError(t("Sign out could not be completed. Please try again.", "退出登录未完成，请重试。")); setSigningOut(false); }
  }
  if (deleting) return <section className="qic-account-paper qic-account-secondary qic-account-delete-view"><button className="qic-account-back" onClick={() => onDeleteView(false)}>{t("← Back to Settings", "← 返回设置")}</button><DeleteAccountControl locale={zh ? "zh-Hans" : "en"} presentation="modal" /></section>;
  return <div className="qic-account-settings-primary">
    <section className="qic-account-paper qic-settings-privacy"><h2><Diamond aria-hidden="true" />{t("Privacy & Data", "隐私与数据")}</h2><Link href={zh ? "/zh/privacy" : "/privacy"} onClick={onClose}><FileText aria-hidden="true" /><span><strong>{t("Privacy Policy", "隐私政策")}</strong><small>{t("Learn how Quick I Ching handles your data.", "了解 Quick I Ching 如何处理你的数据。")}</small></span><ChevronRight aria-hidden="true" /></Link><Link href={zh ? "/zh/terms" : "/terms"} onClick={onClose}><ScrollText aria-hidden="true" /><span><strong>{t("Terms of Service", "服务条款")}</strong><small>{t("Review the terms for using Quick I Ching.", "查看 Quick I Ching 使用条款。")}</small></span><ChevronRight aria-hidden="true" /></Link></section>
    <section className="qic-account-paper qic-settings-actions"><h2><UserRound aria-hidden="true" />{t("Account Actions", "账户操作")}</h2><div className="qic-settings-action-row"><UserRound aria-hidden="true" /><span><strong>{t("Sign Out", "退出登录")}</strong><small>{t("Sign out of Quick I Ching on this device.", "在此设备上退出 Quick I Ching。")}</small></span><button disabled={signingOut} onClick={signOut} className="qic-account-outline-button">{signingOut ? t("Signing out…", "正在退出…") : t("Sign Out", "退出登录")}</button></div>{error && <p role="alert">{error}</p>}</section>
    <section className="qic-account-paper qic-settings-danger"><h2><TriangleAlert aria-hidden="true" />{t("Danger Zone", "危险区域")}</h2><div className="qic-settings-action-row"><Trash2 aria-hidden="true" /><span><strong>{t("Delete Account", "删除账户")}</strong><small>{t("This will permanently delete your account and all related reading data and account content. Certain financial or security records may be retained as required by law.", "此操作会永久删除账户及其相关解读数据和账户内容。依法保留必要的财务或安全记录。")}</small></span><button className="qic-account-danger-button" onClick={() => onDeleteView(true)}>{t("Delete Account", "删除账户")}</button></div></section>
  </div>;
}
