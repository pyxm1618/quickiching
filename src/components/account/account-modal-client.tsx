"use client";

import dynamic from "next/dynamic";
import type { ContentLocale } from "@/i18n/config";

const AccountModalHost = dynamic(() => import("./account-modal-host").then(m => m.AccountModalHost), { ssr: false });

export function AccountModalClient({ locale }: { locale?: ContentLocale }) {
  return <AccountModalHost locale={locale} />;
}
