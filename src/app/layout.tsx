import type { Metadata } from "next";
import { Fraunces, Instrument_Sans, IBM_Plex_Mono, Noto_Serif_SC } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HOME_DESCRIPTION, HOME_TITLE, SITE_ORIGIN } from "@/lib/seo";

const fraunces = Fraunces({ subsets: ["latin"], style: ["normal"], axes: ["opsz"], variable: "--font-fraunces" });
const instrument = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex", preload: false });
const notoSerifSC = Noto_Serif_SC({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-noto-sc", preload: false });

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
    <html lang="en" className={`${fraunces.variable} ${instrument.variable} ${plexMono.variable} ${notoSerifSC.variable}`}>
      <body className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
