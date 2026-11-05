import type { Metadata } from "next";
import { headers } from "next/headers";
import { QuickIChingNotFound } from "@/components/not-found/quick-iching-not-found";
import { NotFoundDocumentTitle } from "@/components/not-found/not-found-document-title";
import { fontVariableClassNames } from "./fonts";
import { localizedFontVariableClassNames } from "./localized-fonts";
import "./globals.css";

const EN_METADATA: Metadata = {
  title: "Page Not Found | Quick I Ching",
  description: "The requested Quick I Ching page could not be found.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Page Not Found | Quick I Ching",
    description: "The requested Quick I Ching page could not be found.",
    type: "website",
    siteName: "Quick I Ching",
  },
};

const ZH_METADATA: Metadata = {
  title: "页面不存在 | Quick I Ching",
  description: "你请求的中文 Quick I Ching 页面不存在。",
  robots: { index: false, follow: false },
  openGraph: {
    title: "页面不存在 | Quick I Ching",
    description: "你请求的中文 Quick I Ching 页面不存在。",
    type: "website",
    siteName: "Quick I Ching",
    locale: "zh_CN",
  },
};

async function getNotFoundLocale(): Promise<"en" | "zh"> {
  const pathname = (await headers()).get("x-quickiching-pathname") ?? "";
  return pathname === "/zh" || pathname.startsWith("/zh/") ? "zh" : "en";
}

export const metadata: Metadata = EN_METADATA;

export default async function GlobalNotFound() {
  const locale = await getNotFoundLocale();
  const zh = locale === "zh";

  return (
    <html
      lang={zh ? "zh-Hans" : "en"}
      className={zh ? localizedFontVariableClassNames : fontVariableClassNames}
    >
      <body className="min-h-screen bg-[var(--bg)] text-[var(--ink)] antialiased">
        <NotFoundDocumentTitle title={zh ? "页面不存在 | Quick I Ching" : "Page Not Found | Quick I Ching"} />
        <QuickIChingNotFound locale={locale} />
      </body>
    </html>
  );
}
