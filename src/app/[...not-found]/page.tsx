import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Page Not Found",
  description: "The requested Quick I Ching page could not be found.",
  robots: {
    index: false,
    follow: true,
  },
  openGraph: {
    title: "Page Not Found",
    description: "The requested Quick I Ching page could not be found.",
    type: "website",
    siteName: "Quick I Ching",
  },
};

export default function UnmatchedRoutePage(): never {
  notFound();
}
