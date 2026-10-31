"use client";
import React from "react";
import Link from "next/link";
import { Mail, Diamond } from "lucide-react";
import { RefundRequestControl } from "@/app/(default)/account/refund-request-control";
import type { loadAccountModal } from "@/server/account/modal-loader";
import { AccountScrollRegion } from "./account-scroll-region";
import type { AccountPurchase } from "@/server/account/purchase-loader";
export type AccountModalData = Awaited<ReturnType<typeof loadAccountModal>>;
export function purchaseDate(date: Date, zh = false) {
  return new Date(date).toLocaleDateString(zh ? "zh-CN" : "en-US", { month: "short", day: "2-digit", year: "numeric", timeZone: "UTC" });
}
export function purchasePack(purchase: AccountPurchase, zh = false) {
  return zh ? `${purchase.quantity} 次深度解读` : `${purchase.quantity} Deep Reading${purchase.quantity === 1 ? "" : "s"}`;
}
export function canRequestRefund(purchase: AccountPurchase, now = Date.now()) {
  const age = purchase.paidAt ? now - new Date(purchase.paidAt).getTime() : NaN;
  return purchase.status === "paid" && !purchase.refund && Number.isFinite(age) && age >= 0 && age <= 7 * 24 * 60 * 60 * 1000;
}
export function PurchaseView({ account, selectedPurchase, onSelectPurchase, zh, onClose, onRefundRecorded }: {
  account: AccountModalData; selectedPurchase: AccountPurchase | null;
  onSelectPurchase: (purchase: AccountPurchase | null) => void; zh: boolean; onClose: () => void; onRefundRecorded?: () => void;
}) {
  const t = (en: string, cn: string) => zh ? cn : en;
  if (selectedPurchase) return <section className="qic-account-paper qic-account-secondary">
    <button className="qic-account-back" onClick={() => onSelectPurchase(null)}>{t("← Back to My Account", "← 返回我的账户")}</button>
    <h2>{t("Request a Refund", "申请退款")}</h2>
    <p className="qic-account-rule">{t("Requests must be submitted within 7 days. Submission starts review only; it does not issue a refund automatically.", "退款申请须在购买后 7 天内提交。提交只会进入审核流程，不会自动发出退款。")}</p>
    <dl className="qic-refund-purchase"><dt>{t("Purchase Date", "购买日期")}</dt><dd>{purchaseDate(selectedPurchase.paidAt ?? selectedPurchase.createdAt, zh)}</dd><dt>{t("Pack", "套餐")}</dt><dd>{purchasePack(selectedPurchase, zh)}</dd><dt>{t("Amount", "金额")}</dt><dd>US${(selectedPurchase.amountMinor / 100).toFixed(2)}</dd></dl>
    <RefundRequestControl key={selectedPurchase.id} orderId={selectedPurchase.id} orderStatus={selectedPurchase.status} existingRefund={selectedPurchase.refund} locale={zh ? "zh-Hans" : "en"} presentation="modal" onRecorded={onRefundRecorded} />
  </section>;
  return <div className="qic-account-primary">
    <section className="qic-account-paper qic-account-identity"><h2><Diamond aria-hidden="true" />{t("Account", "账户")}</h2><dl><div><dt>{t("Email", "邮箱")}</dt><dd><Mail aria-hidden="true" />{account.email}</dd></div><div><dt>{t("Sign-in method", "登录方式")}</dt><dd>{account.signInMethods.length ? account.signInMethods.join(" + ") : t("Unknown", "未知")}</dd></div></dl></section>
    <section className="qic-account-credits"><h2><Diamond aria-hidden="true" />{t("Reading Credits", "解读次数")}</h2><div className="qic-account-credit-row"><strong>{account.balance.available}</strong><span>{t("Deep Readings available", "次可用深度解读")}</span><Link href={zh ? "/zh/pricing" : "/pricing"} onClick={onClose} className="qic-account-gold-button">{t("Buy More", "购买更多")} <span aria-hidden="true">→</span></Link></div></section>
    <section className="qic-account-paper qic-account-purchases"><h2><Diamond aria-hidden="true" />{t("Purchase History", "购买记录")}</h2>
      <AccountScrollRegion className="qic-account-purchase-region" scrollClassName="qic-account-purchase-scroll" ariaLabel={t("Purchase History", "购买记录")}>
        {account.purchases.length === 0 ? <p>{t("No purchases yet.", "还没有购买记录。")}</p> : <table><thead><tr><th>{t("Date", "日期")}</th><th>{t("Pack", "套餐")}</th><th>{t("Amount", "金额")}</th><th>{t("Status", "状态")}</th><th><span className="sr-only">{t("Request Refund", "申请退款")}</span></th></tr></thead><tbody>{account.purchases.map(purchase => <tr key={purchase.id}><td>{purchaseDate(purchase.paidAt ?? purchase.createdAt, zh)}</td><td>{purchasePack(purchase, zh)}</td><td>US${(purchase.amountMinor / 100).toFixed(2)}</td><td className="qic-account-purchase-status" data-paid={!purchase.refund && purchase.status === "paid"}>{(purchase.refund?.status ?? purchase.status).replace(/_/g, " ")}</td><td>{canRequestRefund(purchase) && <button className="qic-account-refund-link" onClick={() => onSelectPurchase(purchase)}>{t("Request Refund", "申请退款")}</button>}</td></tr>)}</tbody></table>}
      </AccountScrollRegion>
    </section>
  </div>;
}
