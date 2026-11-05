import type { Metadata } from "next";
import { headers } from "next/headers";
import { QuickIChingNotFound } from "@/components/not-found/quick-iching-not-found";
import { NotFoundDocumentTitle } from "@/components/not-found/not-found-document-title";
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

async function getNotFoundLocale(): Promise<"en" | "zh"> {
  const pathname = (await headers()).get("x-quickiching-pathname") ?? "";
  return pathname === "/zh" || pathname.startsWith("/zh/") ? "zh" : "en";
}

export const metadata: Metadata = EN_METADATA;

export default async function GlobalNotFound() {
  const locale = await getNotFoundLocale();
  const zh = locale === "zh";

  return (
    <html lang={zh ? "zh-Hans" : "en"}>
      <body className="min-h-screen bg-[var(--bg)] text-[var(--ink)] antialiased">
        <NotFoundDocumentTitle title={zh ? "页面不存在 | Quick I Ching" : "Page Not Found | Quick I Ching"} />
        <QuickIChingNotFound locale={locale} />
      </body>
    </html>
  );
}
