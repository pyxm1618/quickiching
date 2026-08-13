import type { CSSProperties } from "react";
import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SiteAnalytics } from "@/components/site-analytics";
import { HOME_DESCRIPTION, HOME_TITLE, SITE_ORIGIN } from "@/lib/seo";

const systemFontVariables = {
  "--font-fraunces": 'Georgia, "Times New Roman", serif',
  "--font-instrument": 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  "--font-plex": '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
  "--font-noto-sc": '"Songti SC", "STSong", serif',
} as CSSProperties;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: { default: HOME_TITLE, template: "%s | Quick I Ching" },
  description: HOME_DESCRIPTION,
  openGraph: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    type: "website",
    siteName: "Quick I Ching",
    url: SITE_ORIGIN,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={systemFontVariables}>
      <body className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <SiteAnalytics />
      </body>
    </html>
  );
}
