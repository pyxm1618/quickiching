import type { Metadata } from "next";
import { QuickIChingNotFound } from "@/components/not-found/quick-iching-not-found";
import "./globals.css";

export const metadata: Metadata = {
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

export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--bg)] text-[var(--ink)] antialiased">
        <QuickIChingNotFound locale="en" />
      </body>
    </html>
  );
}
