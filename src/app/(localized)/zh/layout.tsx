import { AccountModalHost } from "@/components/account/account-modal-host";
import type { Metadata } from "next";
import "../../globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SiteAnalytics } from "@/components/site-analytics";
import { SITE_ORIGIN } from "@/lib/seo";
import { isAuthCapabilityEnabled } from "@/server/auth/capability";
import { localizedFontVariableClassNames } from "../../fonts";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: { default: "易经在线｜Quick I Ching", template: "%s | Quick I Ching" },
  description: "Quick I Ching 中文入口：使用三枚铜钱、蓍草、梅花易数或手动输入完成起卦，并浏览六十四卦、动爻与之卦的中文解释。",
  openGraph: {
    title: "易经在线｜Quick I Ching",
    description: "使用多种公开起卦方法，并浏览六十四卦、动爻与之卦的中文解释。",
    type: "website",
    siteName: "Quick I Ching",
    locale: "zh_CN",
  },
  robots: { index: true, follow: true },
  other: { "google-adsense-account": "ca-pub-2804737462866511" },
};

export default function LocalizedRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authEnabled = isAuthCapabilityEnabled();
  return (
    <html lang="zh-Hans" className={localizedFontVariableClassNames}>
      <body className="flex min-h-screen flex-col">
        <SiteHeader locale="zh-Hans" authEnabled={authEnabled} />
        <main className="flex-1">{children}</main>
        <SiteFooter locale="zh-Hans" />
        <AccountModalHost locale="zh-Hans" />
        <SiteAnalytics />
      </body>
    </html>
  );
}
