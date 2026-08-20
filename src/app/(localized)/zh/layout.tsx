import type { CSSProperties } from "react";
import type { Metadata } from "next";
import "../../globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SiteAnalytics } from "@/components/site-analytics";
import { SITE_ORIGIN } from "@/lib/seo";

const systemFontVariables = {
  "--font-fraunces": 'Georgia, "Times New Roman", serif',
  "--font-instrument": 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  "--font-plex": '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
  "--font-noto-sc": '"Songti SC", "STSong", serif',
} as CSSProperties;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: { default: "易经在线｜Quick I Ching", template: "%s | Quick I Ching" },
  description: "Quick I Ching 中文入口：使用公开说明的公历时间约定进行梅花易数时间起卦，并以本卦、动爻与之卦作为反思框架。",
  openGraph: {
    title: "易经在线｜Quick I Ching",
    description: "使用公开说明的公历时间约定进行梅花易数时间起卦。",
    type: "website",
    siteName: "Quick I Ching",
    locale: "zh_CN",
  },
  robots: { index: true, follow: true },
};

export default function LocalizedRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hans" style={systemFontVariables}>
      <body className="flex min-h-screen flex-col">
        <SiteHeader locale="zh-Hans" />
        <main className="flex-1">{children}</main>
        <SiteFooter locale="zh-Hans" />
        <SiteAnalytics />
      </body>
    </html>
  );
}
