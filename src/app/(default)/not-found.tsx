import type { Metadata } from "next";
import { QuickIChingNotFound } from "@/components/not-found/quick-iching-not-found";

export const metadata: Metadata = {
  title: { absolute: "Page Not Found | Quick I Ching" },
  description: "The requested Quick I Ching page could not be found.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Page Not Found | Quick I Ching",
    description: "The requested Quick I Ching page could not be found.",
    type: "website",
    siteName: "Quick I Ching",
  },
};

export default function NotFound() {
  return <QuickIChingNotFound locale="en" />;
}
