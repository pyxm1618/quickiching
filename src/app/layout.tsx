import type { Metadata } from "next";
import { Fraunces, Instrument_Sans, IBM_Plex_Mono, Noto_Serif_SC } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-fraunces",
});
const instrument = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument" });
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
  metadataBase: new URL("https://quickiching.com"),
  title: {
    default: "Quick I Ching — Three-Coin Reflection Tool",
    template: "%s · Quick I Ching",
  },
  description:
    "A structured I Ching reflection tool with a free three-coin casting preview. Paid deep readings and accounts are temporarily unavailable.",
  keywords: ["quick i ching", "i ching coin", "three coin method", "i ching reading"],
  openGraph: {
    title: "Quick I Ching",
    description: "Cast six lines with three coins and explore the structure of an I Ching reading.",
    type: "website",
    url: "https://quickiching.com",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${instrument.variable} ${plexMono.variable} ${notoSerifSC.variable}`}
    >
      <body className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
