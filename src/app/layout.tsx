import type { Metadata } from "next";
import { Fraunces, Instrument_Sans, IBM_Plex_Mono, Noto_Serif_SC } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

/* 「明室 · 暗室」字体系统 —— 详见 phototype/UI设计方案.md §3 */
const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-fraunces",
});
const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex",
});
const notoSerifSC = Noto_Serif_SC({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-noto-sc",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "I Ching Coin — Understand where you are",
    template: "%s · I Ching Coin",
  },
  description:
    "A multi-method I Ching reflection tool. Cast with coins, yarrow stalks, or the current time, then reveal your hexagram and an optional deep reading.",
  keywords: ["i ching coin", "three coin method", "yarrow stalk i ching", "mei hua yi shu", "i ching reading"],
  openGraph: {
    title: "I Ching Coin",
    description: "Understand where you are, how it may be changing, and what to watch before you act.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${instrument.variable} ${plexMono.variable} ${notoSerifSC.variable}`}
    >
      <body className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
