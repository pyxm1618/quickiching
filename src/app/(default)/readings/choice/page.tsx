import type { Metadata } from "next";
import { ResultChoicePage } from "@/components/reading-result/result-choice-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Choose Your Reading",
  description: "Choose Free Reading or Deep Reading for this completed Quick I Ching cast.",
  openGraph: {
    title: "Choose Your Reading",
    description: "Choose Free Reading or Deep Reading for this completed Quick I Ching cast.",
  },
  robots: { index: false, follow: true },
};

export default function Page(props: { searchParams?: Promise<{ session?: string }> }) {
  return <ResultChoicePage {...props} locale="en" />;
}
