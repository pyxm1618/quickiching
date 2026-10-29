"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import type { ContentLocale } from "@/i18n/config";
import { fetchAccountModal } from "./fetch-account-modal";
import type { AccountPurchase } from "@/server/account/purchase-loader";
import { ACCOUNT_OPEN_EVENT, type AccountSurface } from "./account-events";
import { AccountHeading } from "./account-heading";
import { PurchaseView, type AccountModalData } from "./purchase-view";
import { SettingsView } from "./settings-view";
import "./account.css";

export function AccountModalHost({ locale = "en" }: { locale?: ContentLocale }) {
  const [surface, setSurface] = useState<AccountSurface | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const close = useCallback(() => setSurface(null), []);
  useEffect(() => {
    setPortalRoot(document.body);
    function open(event: Event) {
      const requested = (event as CustomEvent<unknown>).detail;
      if (requested === "account" || requested === "settings") setSurface(requested);
    }
    window.addEventListener(ACCOUNT_OPEN_EVENT, open);
    const url = new URL(window.location.href);
    if (url.searchParams.get("account") === "open") {
      setSurface("account");
      url.searchParams.delete("account");
      window.history.replaceState(window.history.state, "", url);
    }
    return () => window.removeEventListener(ACCOUNT_OPEN_EVENT, open);
  }, []);
  useEffect(() => {
    if (previousPath.current !== pathname) close();
    previousPath.current = pathname;
  }, [pathname, close]);
  return portalRoot && surface ? createPortal(<AccountDialog key={surface} surface={surface} locale={locale} onClose={close} />, portalRoot) : null;
}

function AccountDialog({ surface, locale, onClose }: { surface: AccountSurface; locale: ContentLocale; onClose: () => void }) {
  const zh = locale === "zh-Hans";
  const t = (en: string, cn: string) => zh ? cn : en;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [account, setAccount] = useState<AccountModalData | null>(null);
  const [failed, setFailed] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<AccountPurchase | null>(null);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      if (previousFocus?.isConnected) previousFocus.focus();
      else [...document.querySelectorAll<HTMLElement>("[data-user-nav-menu-button]")].find(element => element.getClientRects().length)?.focus();
    };
  }, []);
  useEffect(() => {
    if (surface !== "account") return;
    let cancelled = false;
    fetchAccountModal().then(result => { if (!cancelled) setAccount(result); }, () => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [surface]);
  return <dialog ref={dialogRef} className="qic-account-dialog" data-account-surface={surface} onKeyDown={event => {
    if (event.key !== "Tab") return;
    const stops = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(element => element.getClientRects().length);
    const first = stops[0]; const last = stops.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }} aria-labelledby="qic-account-title" aria-describedby="qic-account-subtitle" onCancel={onClose} onClose={onClose}>
    <div className="qic-account-frame">
      <button autoFocus className="qic-account-close" aria-label={t("Close", "关闭")} onClick={onClose}>×</button>
      <AccountHeading id="qic-account-title" title={surface === "account" ? t("My Account", "我的账户") : t("Settings", "设置")} subtitle={surface === "account" ? t("Manage your account and reading credits.", "管理你的账户和解读次数。") : t("Manage your privacy and account controls.", "管理你的隐私和账户操作。")} />
      <div className="qic-account-body">
        {surface === "settings" ? <SettingsView deleting={deleting} onDeleteView={setDeleting} zh={zh} onClose={onClose} /> : account ? <PurchaseView account={account} selectedPurchase={selectedPurchase} onSelectPurchase={setSelectedPurchase} zh={zh} onClose={onClose} onRefundRecorded={() => {
          fetchAccountModal().then(setAccount, () => { setAccount(null); setFailed(true); });
        }} /> : <div className="qic-account-paper qic-account-load" role={failed ? "alert" : "status"}>{failed ? t("Account could not be loaded. Please close and try again.", "无法加载账户，请关闭后重试。") : t("Loading…", "正在加载…")}</div>}
      </div>
    </div>
  </dialog>;
}
