"use client";

import { useRouter } from "next/navigation";
import { openPrivacySettings } from "@/components/consent-adapter";
import type { ContentLocale } from "@/i18n/config";

export function PrivacySettingsButton({
  locale = "en",
}: {
  locale?: ContentLocale;
}) {
  const router = useRouter();
  const isChinese = locale === "zh-Hans";

  const handleClick = () => {
    if (openPrivacySettings()) return;
    router.push(isChinese ? "/zh/privacy?privacy-settings=1" : "/privacy?privacy-settings=1");
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex min-h-11 items-center text-[var(--ink-3)] transition-colors hover:text-[var(--jade)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cinnabar)]"
    >
      {isChinese ? "隐私与 Cookie 设置" : "Privacy & cookie settings"}
    </button>
  );
}
